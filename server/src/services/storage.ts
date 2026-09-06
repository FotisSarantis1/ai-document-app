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
 * Blobs are written with `access: "private"`: reading one back requires
 * the store's token (see `readFile` below), so a document's contents can't
 * be fetched by anyone who merely gets hold of its Blob URL. Raw bytes are
 * only ever handed back through `routes/documents.ts`'s authenticated
 * `/file` route either way - the Blob URL itself is never sent to the
 * client - but private access means that's not the only thing standing
 * between a document and the open internet.
 */
export async function saveFile(userId: string, filename: string, data: Buffer): Promise<string> {
  if (blobConfigured()) {
    const blob = await put(`${userId}/${filename}`, data, {
      access: "private",
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
    // Private blobs require the store's token to fetch, even though the
    // URL itself isn't secret - see the note on saveFile above.
    const res = await fetch(key, {
      headers: process.env.BLOB_READ_WRITE_TOKEN
        ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
        : {},
    });
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
