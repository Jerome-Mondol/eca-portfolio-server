import { getLlm, getModel } from "../../config/llm.js";
import {
  EXTRACT_RESPONSE_SCHEMA,
  extractedCertificateSchema,
  type ExtractedCertificate,
} from "./types.js";

const EXTRACT_PROMPT = `You read certificates, diplomas, and training transcripts from images and PDFs.

Extract only what is printed on the document. Rules:

- Transcribe the organization name exactly as it appears, including any "Pvt. Ltd.", "Inc.", or "University" suffix.
- Format the date as YYYY-MM-DD. If only a month and year are printed, use the first of that month. If no date is printed, return null — never guess.
- List only skills that are explicitly written on the document. Do not infer skills from the course title.
- Copy the certificate ID and verification URL character for character. Return null when absent.
- If the image is too blurry, dark, cropped, or is not a credential at all, set legibility low and return null for fields you cannot read. An honest null is far better than a plausible guess.
- rawTextExcerpt should be a short verbatim excerpt, not a summary.`;

/**
 * Step 1 — read the document and return structured fields.
 *
 * Vision is the OCR here: the file goes to the model as an inline image or PDF
 * part, so decorative fonts, foil borders, and watermarks are read directly
 * rather than through a separate text-extraction round trip.
 */
export async function extractCertificate(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtractedCertificate> {
  const ai = getLlm();

  const response = await ai.models.generateContent({
    model: getModel(),
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: buffer.toString("base64"), mimeType } },
          { text: EXTRACT_PROMPT },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: EXTRACT_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      temperature: 0,
    },
  });

  const raw = response.text;
  if (!raw) {
    throw new Error("The model returned an empty response. Try a clearer image or a different file.");
  }

  const parsed = extractedCertificateSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    console.error("[ai] extract validation failed:", parsed.error.flatten());
    throw new Error("Could not read the certificate structure. Try a clearer image.");
  }

  return normalize(parsed.data);
}

/** Clamp a date to YYYY-MM-DD, tolerating the shapes models occasionally return. */
function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Keep the model honest about its own output before it reaches the scorer. */
function normalize(data: ExtractedCertificate): ExtractedCertificate {
  const fc = data.fieldConfidence;
  return {
    ...data,
    legibility: clamp(data.legibility),
    date: normalizeDate(data.date),
    courseName: data.courseName?.trim() || null,
    organization: data.organization?.trim() || null,
    certificateId: data.certificateId?.trim() || null,
    credentialUrl: data.credentialUrl?.trim() || null,
    skills: (data.skills ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 25),
    rawTextExcerpt: data.rawTextExcerpt?.slice(0, 300) || null,
    fieldConfidence: {
      courseName: clamp(fc.courseName),
      organization: clamp(fc.organization),
      date: clamp(fc.date),
      skills: clamp(fc.skills),
      certificateId: clamp(fc.certificateId),
      credentialUrl: clamp(fc.credentialUrl),
    },
  };
}
