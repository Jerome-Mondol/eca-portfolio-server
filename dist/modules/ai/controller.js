import { analyzeCertificate } from "./service.js";
import { getCertificate, saveCertificateAnalysis } from "../../stores/certificateStore.js";
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
export async function analyzeCertificateHandler(req, res) {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ message: "No file uploaded. Attach a certificate image or PDF." });
    }
    if (!ALLOWED_MIME.includes(file.mimetype)) {
        return res.status(400).json({ message: "That file type is not supported. Use a JPG, PNG, WEBP, GIF, or PDF." });
    }
    if (file.size > MAX_SIZE) {
        return res.status(400).json({ message: "That file is too large. Keep it under 10 MB." });
    }
    const userId = req.user.sub;
    const certificateId = typeof req.body?.certificateId === "string" ? req.body.certificateId : undefined;
    // Ownership check: a student must never be able to attach an analysis to
    // someone else's certificate by guessing an id.
    if (certificateId) {
        const owned = await getCertificate(certificateId, userId);
        if (!owned)
            return res.status(404).json({ message: "Certificate not found" });
    }
    try {
        const result = await analyzeCertificate({
            buffer: file.buffer,
            mimeType: file.mimetype,
            certificateId,
            userId,
            saveAnalysis: saveCertificateAnalysis,
        });
        res.json({ data: result });
    }
    catch (err) {
        const message = err?.message ?? "Could not analyze that certificate";
        // Configuration and validation problems are the caller's to fix, not a 500.
        const status = /not configured|Could not|empty response|too large|not supported/i.test(message) ? 422 : 500;
        if (status === 500)
            console.error("[ai] analyze failed:", err);
        res.status(status).json({ message });
    }
}
