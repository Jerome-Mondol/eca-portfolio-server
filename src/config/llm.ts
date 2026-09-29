import { GoogleGenAI } from "@google/genai";
import { env } from "./env.js";

let client: GoogleGenAI | null = null;

/**
 * Lazily constructed Gemini client.
 *
 * Only the issuing organization name is ever sent to the model — never the
 * student's name, email, or any other profile field. On the free tier Google may
 * use submitted content to improve its models (the paid tier does not), so keep
 * that in mind before onboarding real users.
 */
export function getLlm(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) {
    throw new Error(
      "AI analysis is not configured. Add GEMINI_API_KEY to server/.env — get a free key at aistudio.google.com",
    );
  }
  if (!client) client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

export function isLlmConfigured(): boolean {
  return !!env.GEMINI_API_KEY;
}

export function getModel(): string {
  return env.GEMINI_MODEL;
}

/**
 * Tried in order when the primary model is overloaded or rate limited.
 *
 * The newest Flash models get capacity-throttled on free keys first, so the
 * older-but-rested models in this list are the ones with headroom exactly when
 * the primary is unavailable. Override the primary with GEMINI_MODEL; the tail
 * stays as insurance.
 */
const FALLBACK_MODELS = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

function modelChain(): string[] {
  const primary = env.GEMINI_MODEL;
  return [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
}

/**
 * True for the transient failures where a different model would probably work.
 * Anything else (bad key, malformed request, safety block) is a real error and
 * should surface immediately rather than burning the whole chain.
 */
function isRetryable(err: unknown): boolean {
  const status = (err as any)?.status ?? (err as any)?.code;
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const message = String((err as any)?.message ?? err).toLowerCase();
  return (
    /unavailable|overloaded|high demand|rate limit|resource[_ ]exhausted|503|429|timeout|etimedout|econnreset|fetch failed|network/.test(
      message,
    )
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a generate call, walking the model chain on transient failures.
 *
 * Returns the response together with the model that actually served it, so the
 * caller can record which model answered rather than claiming the primary did.
 * The last error is rethrown once the chain is exhausted.
 */
export async function generateWithFallback<T>(
  call: (model: string) => Promise<T>,
  opts: { attemptsPerModel?: number } = {},
): Promise<{ result: T; model: string }> {
  const perModel = opts.attemptsPerModel ?? 2;
  const chain = modelChain();
  let lastError: unknown;

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    for (let attempt = 0; attempt < perModel; attempt++) {
      try {
        return { result: await call(model), model };
      } catch (err) {
        lastError = err;
        if (!isRetryable(err)) throw err;
        // Back off a little further on every attempt, but stay well under the
        // 25s budget the whole request is allowed before a proxy gives up.
        await sleep(250 * (attempt + 1) * (i + 1));
      }
    }
    console.warn(`[llm] ${model} unavailable, trying next fallback`);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("The AI service is busy right now. Try again in a minute.");
}
