import { getModel } from "../../config/llm.js";
import { extractCertificate } from "./extract.js";
import { researchCertificate } from "./research.js";
import { scoreCertificate } from "./score.js";
import { CONFIDENCE_FLOOR } from "./types.js";
/**
 * extract -> research -> score
 *
 * Research is skipped when the document is too poorly read to identify an
 * organization, which saves a grounded request (the scarcest resource on the
 * free tier). A research failure never loses the extracted fields: the score
 * simply reports the issuer check as unverified and says so.
 */
export async function analyzeCertificate(input) {
    const extracted = await extractCertificate(input.buffer, input.mimeType);
    const worthResearching = !!extracted.organization && extracted.fieldConfidence.organization >= CONFIDENCE_FLOOR;
    const research = worthResearching
        ? await researchCertificate(extracted).catch((err) => {
            console.error("[ai] research step failed:", err?.message ?? err);
            return {
                issuerStatus: "inconclusive",
                issuerName: null,
                issuerDescription: null,
                accreditation: null,
                credentialUrlStatus: "not_checked",
                evidence: [],
                sources: [],
                unavailable: true,
                error: String(err?.message ?? err),
            };
        })
        : {
            issuerStatus: "inconclusive",
            issuerName: null,
            issuerDescription: null,
            accreditation: null,
            credentialUrlStatus: "not_checked",
            evidence: [],
            sources: [],
            unavailable: true,
            error: extracted.organization
                ? "The organization name was not read confidently enough to research."
                : "No organization name was readable on the document.",
        };
    const { score, status, checks } = scoreCertificate(extracted, research);
    const result = {
        type: "certificate",
        version: 1,
        model: getModel(),
        extracted,
        research,
        score,
        status,
        checks,
        analyzedAt: new Date().toISOString(),
    };
    if (input.certificateId) {
        const saved = await input.saveAnalysis(input.certificateId, input.userId, result);
        if (saved)
            result.certificateId = input.certificateId;
    }
    return result;
}
