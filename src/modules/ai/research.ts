import { getLlm, getModel } from "../../config/llm.js";
import { parseJsonLoose } from "./json.js";
import {
  RESEARCH_RESPONSE_SCHEMA,
  researchResponseSchema,
  type ExtractedCertificate,
  type ResearchResult,
  type ResearchSource,
} from "./types.js";

function buildPrompt(extracted: ExtractedCertificate): string {
  const org = extracted.organization ?? "(not stated on the document)";
  const url = extracted.credentialUrl;
  const name = extracted.courseName;

  return `You are verifying whether a credential is genuine. Use web search to check these three things.

Issuing organization: ${org}
Credential title: ${name ?? "(not stated)"}
Verification URL on the document: ${url ?? "(none provided)"}

1. Does an organization matching "${org}" actually exist? If the name is generic or matches several unrelated entities, report inconclusive rather than guessing.
2. Is that organization a recognized, accredited, or widely-known provider of this type of credential? Many training providers are legitimate but not accredited — say so plainly instead of calling them fake.
3. ${url ? `Does ${url} resolve to a real credential verification page?` : "No verification URL was provided, so mark the URL check as not_checked."}

Judge only what you can support. If search returns nothing useful, report inconclusive or not_found — do not fill the gap with assumption. Cite the URL behind each finding.`;
}

/** Sources always come from grounding metadata, independent of response format. */
function collectSources(response: any): ResearchSource[] {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];
  for (const chunk of chunks) {
    const url = chunk?.web?.uri;
    if (typeof url !== "string" || seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: chunk?.web?.title ?? null, url });
    if (sources.length >= 6) break;
  }
  return sources;
}

function unavailable(message: string): ResearchResult {
  return {
    issuerStatus: "inconclusive",
    issuerName: null,
    issuerDescription: null,
    accreditation: null,
    credentialUrlStatus: "not_checked",
    evidence: [],
    sources: [],
    unavailable: true,
    error: message,
  };
}

/**
 * Step 2 — research the extracted fields against the live web.
 *
 * Uses Gemini's Google Search grounding. On the free tier this is capped at
 * roughly 500 requests/day, which is the binding limit on the whole feature.
 *
 * Structured output and search grounding do not always combine in one call, so
 * this falls back to parsing a JSON block from the prose response. Sources are
 * read from grounding metadata either way.
 */
export async function researchCertificate(
  extracted: ExtractedCertificate,
): Promise<ResearchResult> {
  // Nothing to research if we could not read an organization off the document.
  if (!extracted.organization) return unavailable("No organization name was readable on the document.");

  const ai = getLlm();
  const prompt = buildPrompt(extracted);
  const base = {
    model: getModel(),
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      temperature: 0,
    },
  };

  let response: any;
  try {
    response = await ai.models.generateContent({
      ...base,
      config: {
        ...base.config,
        responseMimeType: "application/json",
        responseJsonSchema: RESEARCH_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      },
    });
  } catch (err: any) {
    const message = String(err?.message ?? err);
    const incompatible =
      /incompat|not supported|unsupported|response_schema|response_mime_type|json/i.test(message);
    if (!incompatible) throw err;

    // Search grounding won over the response schema — ask for JSON inside prose.
    response = await ai.models.generateContent({
      ...base,
      contents: `${prompt}\n\nRespond with ONLY a JSON object matching this shape, no prose:\n${JSON.stringify(RESEARCH_RESPONSE_SCHEMA)}`,
    });
  }

  const sources = collectSources(response);
  const raw = typeof response?.text === "string" ? response.text : "";
  if (!raw.trim()) return unavailable("Research returned no result.");

  const parsed = researchResponseSchema.safeParse(parseJsonLoose(raw));
  if (!parsed.success) {
    console.error("[ai] research validation failed:", parsed.error.flatten());
    const partial = unavailable("Could not structure the research result.");
    partial.sources = sources;
    return partial;
  }

  const data = parsed.data;
  return {
    issuerStatus: data.issuerStatus,
    issuerName: data.issuerName?.trim() || null,
    issuerDescription: data.issuerDescription?.trim() || null,
    accreditation: data.accreditation?.trim() || null,
    credentialUrlStatus: data.credentialUrlStatus,
    evidence: data.evidence.slice(0, 4),
    sources,
    unavailable: false,
  };
}


