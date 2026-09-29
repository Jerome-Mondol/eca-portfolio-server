/**
 * Pull a JSON value out of a model response that may be fenced, prefixed, or bare.
 *
 * Structured output normally returns clean JSON, but a response that also carries
 * search grounding (research.ts) or an apologetic preamble comes back as prose.
 * Trying the strict parse first keeps the happy path exact and only falls back
 * when the model ignored the format.
 */
export function parseJsonLoose(text) {
    const trimmed = text.trim();
    if (!trimmed)
        return null;
    try {
        return JSON.parse(trimmed);
    }
    catch {
        /* fall through */
    }
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
    if (fenced) {
        try {
            return JSON.parse(fenced[1]);
        }
        catch {
            /* fall through */
        }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
        try {
            return JSON.parse(trimmed.slice(start, end + 1));
        }
        catch {
            /* fall through */
        }
    }
    return null;
}
