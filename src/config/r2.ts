import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "./env.js";

let r2Client: S3Client | null = null;

export function isR2Configured(): boolean {
  return !!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);
}

export function getR2Client(): S3Client | null {
  if (!isR2Configured()) return null;
  if (!r2Client) {
    const endpoint = env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    r2Client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2Client;
}

export function getR2Bucket(): string {
  return env.R2_BUCKET;
}

export function getR2PublicUrl(key: string): string {
  // If R2_PUBLIC_URL is set (e.g. https://bucket.account.r2.dev or custom domain), use it
  if (env.R2_PUBLIC_URL) {
    const base = env.R2_PUBLIC_URL.replace(/\/$/, "");
    return `${base}/${key}`;
  }
  // Fallback: serve via our API proxy /api/upload/r2/:key
  return `/api/upload/r2/${encodeURIComponent(key)}`;
}

// Helper to upload buffer to R2
export async function uploadToR2(key: string, buffer: Buffer, contentType: string): Promise<string> {
  const client = getR2Client();
  if (!client) throw new Error("R2 not configured");
  await client.send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return getR2PublicUrl(key);
}

// Helper to fetch from R2 for proxy
export async function getFromR2(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const client = getR2Client();
  if (!client) return null;
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }));
    const body = res.Body as any;
    const chunks: Buffer[] = [];
    if (body) {
      // Body is a stream
      for await (const chunk of body) {
        chunks.push(Buffer.from(chunk));
      }
    }
    const buffer = Buffer.concat(chunks);
    return { buffer, contentType: res.ContentType ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
