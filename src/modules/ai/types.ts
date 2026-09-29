import { z } from "zod";

/**
 * Shared types + schemas for the AI pipeline (spec §20, §21, §54).
 *
 * The service layer is deliberately provider-agnostic: only extract.ts,
 * research.ts and project.ts know which LLM is in use, so swapping providers
 * touches three files rather than one.
 */

export const CONFIDENCE_FLOOR = 0.5;

/** Weights for the evidence score. Tunable in one place — no logic depends on the numbers. */
export const SCORE_WEIGHTS = {
  readable: 25,
  issuerFound: 25,
  datesSane: 20,
  urlResolves: 15,
  credentialId: 10,
  skills: 5,
} as const;

export type ScoreWeights = typeof SCORE_WEIGHTS;

export type VerificationStatus = "verified" | "partially_verified" | "unverified";

export type CheckKey = keyof ScoreWeights;

// ---------------------------------------------------------------------------
// Step 1 — extraction
// ---------------------------------------------------------------------------

export const extractedCertificateSchema = z.object({
  documentType: z.enum(["certificate", "transcript", "unknown"]),
  legibility: z.number().min(0).max(1),
  courseName: z.string().nullable(),
  organization: z.string().nullable(),
  date: z.string().nullable(),
  skills: z.array(z.string()),
  certificateId: z.string().nullable(),
  credentialUrl: z.string().nullable(),
  rawTextExcerpt: z.string().nullable(),
  fieldConfidence: z.object({
    courseName: z.number().min(0).max(1),
    organization: z.number().min(0).max(1),
    date: z.number().min(0).max(1),
    skills: z.number().min(0).max(1),
    certificateId: z.number().min(0).max(1),
    credentialUrl: z.number().min(0).max(1),
  }),
});

export type ExtractedCertificate = z.infer<typeof extractedCertificateSchema>;

/** JSON Schema handed to Gemini for structured output in step 1. */
export const EXTRACT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    documentType: {
      type: "string",
      enum: ["certificate", "transcript", "unknown"],
      description: "certificate, transcript, or unknown if the document is not a credential.",
    },
    legibility: {
      type: "number",
      description:
        "0 to 1. How readable the document is overall. Low values mean a blurry, dark, or badly cropped photo.",
    },
    courseName: { type: ["string", "null"], description: "Full title of the course or program." },
    organization: {
      type: ["string", "null"],
      description: "The exact issuing organization name as printed on the document.",
    },
    date: {
      type: ["string", "null"],
      description: "Issue or completion date in YYYY-MM-DD format. Null if no date is printed.",
    },
    skills: {
      type: "array",
      items: { type: "string" },
      description: "Skills, tools, or subjects explicitly listed on the document. Never infer skills that are not printed.",
    },
    certificateId: {
      type: ["string", "null"],
      description: "Credential or certificate ID exactly as printed. Null if absent.",
    },
    credentialUrl: {
      type: ["string", "null"],
      description: "Verification URL printed on the document. Null if absent.",
    },
    rawTextExcerpt: {
      type: ["string", "null"],
      description: "Up to 300 characters of verbatim document text, for transparency. Null if unreadable.",
    },
    fieldConfidence: {
      type: "object",
      description: "Your confidence per field, 0 to 1.",
      properties: {
        courseName: { type: "number" },
        organization: { type: "number" },
        date: { type: "number" },
        skills: { type: "number" },
        certificateId: { type: "number" },
        credentialUrl: { type: "number" },
      },
      required: ["courseName", "organization", "date", "skills", "certificateId", "credentialUrl"],
    },
  },
  required: [
    "documentType",
    "legibility",
    "courseName",
    "organization",
    "date",
    "skills",
    "certificateId",
    "credentialUrl",
    "rawTextExcerpt",
    "fieldConfidence",
  ],
} as const;

// ---------------------------------------------------------------------------
// Step 2 — research
// ---------------------------------------------------------------------------

export type IssuerStatus = "found" | "not_found" | "inconclusive";
export type UrlStatus = "resolves" | "not_found" | "not_checked";

export type ResearchSource = { title: string | null; url: string };

export type ResearchResult = {
  issuerStatus: IssuerStatus;
  issuerName: string | null;
  issuerDescription: string | null;
  accreditation: string | null;
  credentialUrlStatus: UrlStatus;
  evidence: { label: string; detail: string; url: string | null }[];
  sources: ResearchSource[];
  /** True when the research call itself failed, so the UI can say so. */
  unavailable: boolean;
  error?: string;
};

export const RESEARCH_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    issuerStatus: {
      type: "string",
      enum: ["found", "not_found", "inconclusive"],
      description:
        "found = a real organization matching this name exists; not_found = no matching organization; inconclusive = the name is too generic or ambiguous to judge.",
    },
    issuerName: {
      type: ["string", "null"],
      description: "Canonical name of the organization you identified.",
    },
    issuerDescription: {
      type: ["string", "null"],
      description: "One sentence describing what the organization is.",
    },
    accreditation: {
      type: ["string", "null"],
      description:
        "Whether this organization is a recognized, accredited, or widely-known provider of this type of credential. Null if unknown.",
    },
    credentialUrlStatus: {
      type: "string",
      enum: ["resolves", "not_found", "not_checked"],
      description:
        "resolves = the verification URL loads and appears to be a real credential page; not_found = dead or unrelated; not_checked = no URL was provided.",
    },
    evidence: {
      type: "array",
      description: "Up to 4 concrete findings backing the verdict.",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Short label, e.g. 'Official site'." },
          detail: { type: "string", description: "One sentence on what was found." },
          url: { type: ["string", "null"], description: "Supporting URL, if any." },
        },
        required: ["label", "detail", "url"],
      },
    },
  },
  required: [
    "issuerStatus",
    "issuerName",
    "issuerDescription",
    "accreditation",
    "credentialUrlStatus",
    "evidence",
  ],
} as const;

export const researchResponseSchema = z.object({
  issuerStatus: z.enum(["found", "not_found", "inconclusive"]),
  issuerName: z.string().nullable(),
  issuerDescription: z.string().nullable(),
  accreditation: z.string().nullable(),
  credentialUrlStatus: z.enum(["resolves", "not_found", "not_checked"]),
  evidence: z.array(
    z.object({
      label: z.string(),
      detail: z.string(),
      url: z.string().nullable(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Step 3 — score
// ---------------------------------------------------------------------------

export type CheckResult = {
  key: CheckKey;
  label: string;
  passed: boolean;
  weight: number;
  /** Plain-English explanation, shown to the student either way. */
  reason: string;
};

export type AnalysisResult = {
  type: "certificate";
  version: 1;
  model: string;
  extracted: ExtractedCertificate;
  research: ResearchResult;
  score: number;
  status: VerificationStatus;
  checks: CheckResult[];
  /** Set when the analysis was persisted onto a certificate row. */
  certificateId?: string;
  analyzedAt: string;
};

// ---------------------------------------------------------------------------
// Project description improvement (spec §21)
// ---------------------------------------------------------------------------

/**
 * One thing the student did not say, which a generic writer would normally
 * invent. Rendering these as questions is the whole point: the spec bans
 * invented technologies, metrics, outcomes, users and responsibilities, so
 * the model reports the gap instead of filling it (spec §21, §63).
 */
export type MissingInfo = {
  field: "outcome" | "metric" | "role" | "users" | "tech" | "scope" | "link";
  question: string;
  /** Why a reviewer cares about this field. Shown under the question. */
  why: string;
};

export type ProjectSuggestion = {
  /** The rewritten description. Never contains a claim absent from the input. */
  description: string;
  /** Optional title rewrite. Null when the student gave no title to work from. */
  title: string | null;
  /** Only the technologies the student actually named, deduplicated. */
  technologies: string[];
  /** Bullet-ready highlights, each traceable to something the student said. */
  highlights: string[];
  /** Gaps the model refused to invent, ordered by how much they cost the score. */
  missing: MissingInfo[];
  /** 0-1. How much of the input was concrete enough to rewrite confidently. */
  confidence: number;
};

export const projectSuggestionSchema = z.object({
  description: z.string(),
  title: z.string().nullable(),
  technologies: z.array(z.string()),
  highlights: z.array(z.string()),
  missing: z.array(
    z.object({
      field: z.enum(["outcome", "metric", "role", "users", "tech", "scope", "link"]),
      question: z.string(),
      why: z.string(),
    }),
  ),
  confidence: z.number().min(0).max(1),
});

/** JSON Schema handed to the model for step 1 of the project assistant. */
export const PROJECT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    description: {
      type: "string",
      description:
        "The rewritten portfolio description, 1-3 sentences, third person or first person plural as the input uses. Concrete and outcome-shaped, but ONLY using facts present in the input.",
    },
    title: {
      type: ["string", "null"],
      description:
        "A short specific project title, or null when the student did not provide or ask for one. Never generic words like 'Website' or 'Project'.",
    },
    technologies: {
      type: "array",
      items: { type: "string" },
      description:
        "Only tools, languages, or platforms the student explicitly named. Never add a technology they did not mention, and never guess from the project type. Empty array when none were named.",
    },
    highlights: {
      type: "array",
      items: { type: "string" },
      description:
        "Up to 4 short accomplishment statements, each derived from something the student actually said. No invented numbers, no claims of outcomes they did not describe.",
    },
    missing: {
      type: "array",
      description:
        "Details a reviewer expects that the student did not provide. This is where you record what you refused to invent. Order by impact on how convincing the project looks.",
      items: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: ["outcome", "metric", "role", "users", "tech", "scope", "link"],
          },
          question: {
            type: "string",
            description: "A short question the student can answer in one line, e.g. 'How many people used it?'",
          },
          why: {
            type: "string",
            description: "One sentence on why this matters to someone reviewing the project.",
          },
        },
        required: ["field", "question", "why"],
      },
    },
    confidence: {
      type: "number",
      description:
        "0 to 1. How much concrete detail the input contained. Low when the description is vague, since a vague input cannot be honestly improved.",
    },
  },
  required: ["description", "title", "technologies", "highlights", "missing", "confidence"],
} as const;
