import fs from "fs/promises";
import path from "path";
import { put, del } from "@vercel/blob";

export const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(__dirname, "..", "..", "uploads");

function blobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Saves a file under a per-user key and returns a storage key that
 * `readFile`/`deleteFile` can later use to retrieve or remove it.
 *
 * - When `BLOB_READ_WRITE_TOKEN` is set (Vercel deployments), files go to
 *   Vercel Blob - the only storage that survives across serverless
 *   invocations, since the local filesystem is not persistent there.
 * - Otherwise (local dev, traditional long-running server deployments),
 *   files are written to disk under `UPLOAD_DIR`, isolated per user id.
 *
 * Either way, raw bytes are only ever handed back through
 * `routes/documents.ts`'s authenticated `/file` route - the Blob URL
 * itself is never sent to the client - which is what keeps a document's
 * contents scoped to its owning session even though Blob storage is an
 * unguessable-but-technically-public URL.
 */
export async function saveFile(userId: string, filename: string, data: Buffer): Promise<string> {
  if (blobConfigured()) {
    const blob = await put(`${userId}/${filename}`, data, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/pdf",
    });
    return blob.url;
  }

  const dir = path.join(UPLOAD_ROOT, userId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, data);
  return filePath;
}

export async function readFile(key: string): Promise<Buffer> {
  if (/^https?:\/\//.test(key)) {
    const res = await fetch(key);
    if (!res.ok) throw new Error(`Failed to read stored file (status ${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFile(key);
}

export async function deleteFile(key: string): Promise<void> {
  if (/^https?:\/\//.test(key)) {
    await del(key).catch(() => {
      /* already gone, or provider not configured for delete - not fatal */
    });
    return;
  }
  await fs.unlink(key).catch(() => {
    /* file already missing - deleting a document should still succeed */
  });
}
