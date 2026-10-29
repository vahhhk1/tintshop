import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import { env } from "@/lib/env";

/**
 * Image storage with three drivers:
 *  - local:      writes to /public/uploads (development only; not persistent on serverless hosts)
 *  - cloudinary: signed upload via Cloudinary's REST API
 *  - s3:         any S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2…)
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const SIGNATURES: { type: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    type: "image/webp",
    ext: "webp",
    test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    type: "image/avif",
    ext: "avif",
    test: (b) => String.fromCharCode(...b.slice(4, 8)) === "ftyp" && String.fromCharCode(...b.slice(8, 12)).startsWith("avi"),
  },
];

export class UploadError extends Error {}

export interface StoredFile {
  url: string;
  provider: string;
}

/** Validates by magic bytes (not the client-supplied MIME type) and size. */
export function detectImage(bytes: Uint8Array) {
  return SIGNATURES.find((s) => s.test(bytes)) ?? null;
}

export async function uploadImage(file: File, folder: "gallery" | "services" | "branding" | "technicians" | "uploads"): Promise<StoredFile> {
  if (file.size === 0) throw new UploadError("The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Images must be 8 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImage(bytes);
  if (!kind) throw new UploadError("Only JPEG, PNG, WebP or AVIF images are allowed.");

  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${kind.ext}`;
  const key = `${folder}/${name}`;

  switch (env.storage.provider) {
    case "cloudinary":
      return uploadToCloudinary(bytes, kind.type, folder);
    case "s3":
      return uploadToS3(bytes, kind.type, key);
    default:
      if (env.isProduction && !process.env.ALLOW_LOCAL_UPLOADS) {
        throw new UploadError("Configure STORAGE_PROVIDER (cloudinary or s3) to upload images in production.");
      }
      return uploadToLocal(bytes, key);
  }
}

async function uploadToLocal(bytes: Uint8Array, key: string): Promise<StoredFile> {
  const target = path.join(process.cwd(), "public", "uploads", key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return { url: `/uploads/${key}`, provider: "local" };
}

async function uploadToCloudinary(bytes: Uint8Array, type: string, folder: string): Promise<StoredFile> {
  const cloudName = env.storage.bucket;
  const apiKey = env.storage.apiKey;
  const secret = env.storage.secret;
  if (!cloudName || !apiKey || !secret) throw new UploadError("Cloudinary is not fully configured.");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const fullFolder = `tint-shop/${folder}`;
  const signature = createHash("sha1").update(`folder=${fullFolder}&timestamp=${timestamp}${secret}`).digest("hex");

  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type }));
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("folder", fullFolder);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
  const json = (await res.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || !json.secure_url) throw new UploadError(json.error?.message ?? "Cloudinary upload failed.");
  return { url: json.secure_url, provider: "cloudinary" };
}

async function uploadToS3(bytes: Uint8Array, type: string, key: string): Promise<StoredFile> {
  const { apiKey, secret, bucket, endpoint, region, publicUrl } = env.storage;
  if (!apiKey || !secret || !bucket || !publicUrl) throw new UploadError("S3 storage is not fully configured.");
  const client = new AwsClient({ accessKeyId: apiKey, secretAccessKey: secret, service: "s3", region });
  const base = (endpoint ?? `https://s3.${region}.amazonaws.com`).replace(/\/$/, "");
  const res = await client.fetch(`${base}/${bucket}/${key}`, {
    method: "PUT",
    body: bytes as BodyInit,
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
  });
  if (!res.ok) throw new UploadError(`S3 upload failed (HTTP ${res.status}).`);
  return { url: `${publicUrl.replace(/\/$/, "")}/${key}`, provider: "s3" };
}
