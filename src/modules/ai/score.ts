import {
  CONFIDENCE_FLOOR,
  SCORE_WEIGHTS,
  type CheckResult,
  type ExtractedCertificate,
  type ResearchResult,
  type VerificationStatus,
} from "./types.js";

/**
 * Step 3 — the evidence score. Pure functions, no LLM call, no I/O.
 *
 * The score measures how well-evidenced the document is, never how good the
 * student is. Spec §18 and §23 ban invented proficiency numbers, so every point
 * here traces back to a check we actually ran. When research is unavailable the
 * issuer check fails rather than defaulting to a guess.
 */

const VERIFIED_AT = 70;
const PARTIAL_AT = 40;

export function scoreCertificate(
  extracted: ExtractedCertificate,
  research: ResearchResult,
): { score: number; status: VerificationStatus; checks: CheckResult[] } {
  const checks: CheckResult[] = [
    checkReadable(extracted),
    checkIssuer(extracted, research),
    checkDates(extracted),
    checkUrl(extracted, research),
    checkCredentialId(extracted),
    checkSkills(extracted),
  ];

  const score = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);

  const status: VerificationStatus =
    score >= VERIFIED_AT ? "verified" : score >= PARTIAL_AT ? "partially_verified" : "unverified";

  return { score, status, checks };
}

function checkReadable(e: ExtractedCertificate): CheckResult {
  const w = SCORE_WEIGHTS.readable;
  if (e.legibility >= CONFIDENCE_FLOOR && e.documentType === "certificate") {
    return {
      key: "readable",
      label: "Document readable",
      passed: true,
      weight: w,
      reason: "The document is a clear, legible certificate.",
    };
  }
  if (e.documentType !== "certificate" && e.documentType !== "unknown") {
    return {
      key: "readable",
      label: "Document readable",
      passed: false,
      weight: w,
      reason: `This looks like a ${e.documentType}, not a certificate.`,
    };
  }
  return {
    key: "readable",
    label: "Document readable",
    passed: false,
    weight: w,
    reason: "The document is too blurry or unclear to read confidently. Try a sharper photo.",
  };
}

function checkIssuer(e: ExtractedCertificate, r: ResearchResult): CheckResult {
  const w = SCORE_WEIGHTS.issuerFound;
  if (!e.organization) {
    return {
      key: "issuerFound",
      label: "Issuer found",
      passed: false,
      weight: w,
      reason: "No organization name was readable on the document.",
    };
  }
  if (r.unavailable) {
    return {
      key: "issuerFound",
      label: "Issuer found",
      passed: false,
      weight: w,
      reason: "Issuer could not be checked right now. This is not a sign of anything wrong.",
    };
  }
  if (r.issuerStatus === "found") {
    return {
      key: "issuerFound",
      label: "Issuer found",
      passed: true,
      weight: w,
      reason: r.issuerName
        ? `"${e.organization}" matches ${r.issuerName}, an organization we could confirm exists.`
        : `"${e.organization}" matches an organization we could confirm exists.`,
    };
  }
  if (r.issuerStatus === "not_found") {
    return {
      key: "issuerFound",
      label: "Issuer found",
      passed: false,
      weight: w,
      reason: `We could not find an organization called "${e.organization}". Check the spelling, or add a verification link if the certificate has one.`,
    };
  }
  return {
    key: "issuerFound",
    label: "Issuer found",
    passed: false,
    weight: w,
    reason: `"${e.organization}" is too generic to confirm one way or the other. A verification link would settle it.`,
  };
}

function checkDates(e: ExtractedCertificate): CheckResult {
  const w = SCORE_WEIGHTS.datesSane;
  const raw = e.date;
  if (!raw) {
    return {
      key: "datesSane",
      label: "Dates valid",
      passed: false,
      weight: w,
      reason: "No issue date was found on the document. You can add one manually.",
    };
  }
  if (e.fieldConfidence.date < CONFIDENCE_FLOOR) {
    return {
      key: "datesSane",
      label: "Dates valid",
      passed: false,
      weight: w,
      reason: "A date was detected but not read confidently. Please check it before saving.",
    };
  }

  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return { key: "datesSane", label: "Dates valid", passed: false, weight: w, reason: `The date "${raw}" could not be parsed.` };
  }

  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const year = parsed.getUTCFullYear();
  const futureLimit = new Date(Date.UTC(thisYear, now.getUTCMonth(), now.getUTCDate() + 1));

  if (parsed > futureLimit) {
    return {
      key: "datesSane",
      label: "Dates valid",
      passed: false,
      weight: w,
      reason: `The issue date ${raw} is in the future. Certificates cannot be issued before they are earned.`,
    };
  }
  if (year < 1990) {
    return {
      key: "datesSane",
      label: "Dates valid",
      passed: false,
      weight: w,
      reason: `The issue date ${raw} is implausibly old. Please double-check the document.`,
    };
  }
  return {
    key: "datesSane",
    label: "Dates valid",
    passed: true,
    weight: w,
    reason: `Issued ${raw}, which is a plausible date.`,
  };
}

function checkUrl(e: ExtractedCertificate, r: ResearchResult): CheckResult {
  const w = SCORE_WEIGHTS.urlResolves;
  if (!e.credentialUrl) {
    return {
      key: "urlResolves",
      label: "Verification link works",
      passed: false,
      weight: w,
      reason: "This certificate has no verification link. Adding one makes it far easier to verify.",
    };
  }
  if (r.unavailable) {
    return {
      key: "urlResolves",
      label: "Verification link works",
      passed: false,
      weight: w,
      reason: "The verification link could not be checked right now.",
    };
  }
  if (r.credentialUrlStatus === "resolves") {
    return { key: "urlResolves", label: "Verification link works", passed: true, weight: w, reason: "The verification link loads and appears to be a real credential page." };
  }
  return {
    key: "urlResolves",
    label: "Verification link works",
    passed: false,
    weight: w,
    reason: "The verification link did not resolve to a valid credential page. Check that it is correct.",
  };
}

function checkCredentialId(e: ExtractedCertificate): CheckResult {
  const w = SCORE_WEIGHTS.credentialId;
  if (!e.certificateId) {
    return {
      key: "credentialId",
      label: "Certificate ID present",
      passed: false,
      weight: w,
      reason: "No certificate ID was found. This is common, and not a warning sign on its own.",
    };
  }
  if (e.fieldConfidence.certificateId < CONFIDENCE_FLOOR) {
    return { key: "credentialId", label: "Certificate ID present", passed: false, weight: w, reason: "A certificate ID was detected but not read confidently. Please check it before saving." };
  }
  return { key: "credentialId", label: "Certificate ID present", passed: true, weight: w, reason: `Certificate ID ${e.certificateId} is present.` };
}

function checkSkills(e: ExtractedCertificate): CheckResult {
  const w = SCORE_WEIGHTS.skills;
  if (e.skills.length === 0) {
    return {
      key: "skills",
      label: "Skills listed",
      passed: false,
      weight: w,
      reason: "No skills were listed on the document. You can add them yourself.",
    };
  }
  return { key: "skills", label: "Skills listed", passed: true, weight: w, reason: `${e.skills.length} skill${e.skills.length === 1 ? "" : "s"} listed on the certificate.` };
}
