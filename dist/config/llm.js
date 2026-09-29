import { GoogleGenAI } from "@google/genai";
import { env } from "./env.js";
let client = null;
/**
 * Lazily constructed Gemini client.
 *
 * Only the issuing organization name is ever sent to the model — never the
 * student's name, email, or any other profile field. On the free tier Google may
 * use submitted content to improve its models (the paid tier does not), so keep
 * that in mind before onboarding real users.
 */
export function getLlm() {
    if (!env.GEMINI_API_KEY) {
        throw new Error("AI analysis is not configured. Add GEMINI_API_KEY to server/.env — get a free key at aistudio.google.com");
    }
    if (!client)
        client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    return client;
}
export function isLlmConfigured() {
    return !!env.GEMINI_API_KEY;
}
export function getModel() {
    return env.GEMINI_MODEL;
}
