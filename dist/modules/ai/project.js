import { generateWithFallback, getLlm, getModel } from "../../config/llm.js";
import { parseJsonLoose } from "./json.js";
import { PROJECT_RESPONSE_SCHEMA, projectSuggestionSchema, } from "./types.js";
const MIN_INPUT = 20;
const MAX_INPUT = 4000;
const IMPROVE_PROMPT = `You improve a student's rough project notes into a portfolio description.

Your single hard rule: you may ONLY use facts the student actually wrote. You improve the writing, never the claims.

Concretely, you must not add:
- a technology, language, or platform they did not name
- a number, metric, or scale ("served 1000 users") they did not give
- an outcome or result they did not describe
- a role, responsibility, or ownership claim they did not make
- any achievement, award, or recognition

If a project is strong on some axis and silent on another, the correct move is to write the strong part well and put the silent part in "missing" as a question the student can answer. A short honest description that scores full marks beats a padded one.

How to write "description":
- 1 to 3 sentences. This is a card preview, not an essay.
- Lead with what it is and what problem it solves, then what the student built.
- Prefer concrete nouns from the input over generic ones. "Registration system for a college club" beats "a web application".
- Keep the student's voice. Do not upgrade casual notes into marketing copy.
- If the input is too vague to improve honestly, return the input lightly tidied and set confidence below 0.4. Do not paper over the vagueness.

How to fill "missing":
- Only include gaps that a recruiter or reviewer would genuinely notice.
- Ask, do not accuse. "How many students used it during the semester?" not "You gave no user count".
- At most 5, ordered by how much each one would strengthen the entry.
- Include a gap only if the student could actually answer it.`;
function buildPrompt(input, title) {
    return `${IMPROVE_PROMPT}

---
Project title the student gave (may be absent):
${title ?? "(none given)"}

Student's own notes:
"""
${input}
"""
---`;
}
function normalize(data) {
    const dedupe = (values) => {
        const seen = new Set();
        return values
            .map((v) => v.trim())
            .filter(Boolean)
            .filter((v) => {
            const key = v.toLowerCase();
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    };
    // Order gaps the way they cost the description the most credibility.
    const order = ["outcome", "metric", "role", "users", "tech", "scope", "link"];
    const missing = [...(data.missing ?? [])]
        .filter((m) => m.question?.trim())
        .sort((a, b) => order.indexOf(a.field) - order.indexOf(b.field))
        .slice(0, 5)
        .map((m) => ({ field: m.field, question: m.question.trim(), why: m.why?.trim() || "" }));
    return {
        description: data.description.trim(),
        title: data.title?.trim() || null,
        technologies: dedupe(data.technologies ?? []).slice(0, 15),
        highlights: dedupe(data.highlights ?? []).slice(0, 4),
        missing,
        confidence: Number.isFinite(data.confidence) ? Math.min(1, Math.max(0, data.confidence)) : 0.5,
    };
}
/**
 * Spec §21 — the AI project assistant.
 *
 * One grounded, structured call. The output is a proposal the student accepts,
 * edits, or rejects; nothing here writes to the database.
 */
export async function improveProjectDescription(input) {
    const text = input.description.trim();
    if (text.length < MIN_INPUT) {
        throw new Error("Write at least a sentence about what you built, in your own words.");
    }
    if (text.length > MAX_INPUT) {
        throw new Error("That is longer than 4000 characters. Keep it to what you actually built.");
    }
    const ai = getLlm();
    const title = input.title?.trim() || null;
    const { result, model } = await generateWithFallback((m) => ai.models.generateContent({
        model: m,
        contents: buildPrompt(text, title),
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: PROJECT_RESPONSE_SCHEMA,
            temperature: 0.4,
        },
    }));
    const raw = typeof result?.text === "string" ? result.text : "";
    if (!raw.trim())
        throw new Error("The model returned an empty response. Try again.");
    const parsed = projectSuggestionSchema.safeParse(parseJsonLoose(raw));
    if (!parsed.success) {
        console.error("[ai] project validation failed:", parsed.error.flatten());
        throw new Error("Could not structure the suggestion. Try rephrasing your notes.");
    }
    const suggestion = normalize(parsed.data);
    // The model returned prose instead of JSON more often than the certificate
    // call does, so a final sanity check beats trusting the shape alone.
    if (!suggestion.description) {
        throw new Error("The model returned an unusable response. Try again.");
    }
    console.log(`[ai] project suggestion served by ${model} (primary ${getModel()})`);
    return suggestion;
}
