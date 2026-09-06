import { v4 as uuidv4 } from "uuid";
import { query, getClient } from "../db";
import { extractPdfPages } from "./pdfProcessor";
import { saveFile, readFile, deleteFile } from "./storage";
import { DocumentRecord, PageRecord } from "../types";

export async function getDocumentById(id: string, userId: string): Promise<DocumentRecord | undefined> {
  const res = await query<DocumentRecord>(
    `SELECT * FROM documents WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return res.rows[0];
}

export async function createDocument(params: {
  userId: string;
  originalName: string;
  fileBuffer: Buffer;
  fileSize: number;
  isDemo?: boolean;
}): Promise<DocumentRecord> {
  const id = uuidv4();
  const filename = `${uuidv4()}.pdf`;
  const filePath = await saveFile(params.userId, filename, params.fileBuffer);

  const res = await query<DocumentRecord>(
    `INSERT INTO documents (id, user_id, filename, original_name, file_path, file_size, status, page_count, is_demo)
     VALUES ($1, $2, $3, $4, $5, $6, 'processing', 0, $7)
     RETURNING *`,
    [id, params.userId, filename, params.originalName, filePath, params.fileSize, !!params.isDemo]
  );
  return res.rows[0];
}

/**
 * Runs PDF extraction for a document already recorded as "processing" and
 * writes one row per page. Any failure marks the document "error" instead of
 * throwing, so a bad upload never leaves a document stuck in limbo.
 */
export async function processDocument(documentId: string): Promise<void> {
  const docRes = await query<DocumentRecord>(`SELECT * FROM documents WHERE id = $1`, [documentId]);
  const doc = docRes.rows[0];
  if (!doc) return;

  try {
    const buffer = await readFile(doc.file_path);
    const { pageCount, pages } = await extractPdfPages(buffer);

    if (pageCount === 0) {
      await query(
        `UPDATE documents SET status = 'error', page_count = 0, error_message = $2 WHERE id = $1`,
        [documentId, "No pages could be extracted from this PDF."]
      );
      return;
    }

    const client = await getClient();
    try {
      await client.query("BEGIN");
      for (const page of pages) {
        await client.query(
          `INSERT INTO pages (id, document_id, page_number, text) VALUES ($1, $2, $3, $4)`,
          [uuidv4(), documentId, page.pageNumber, page.text]
        );
      }
      await client.query(
        `UPDATE documents SET status = 'ready', page_count = $2, error_message = NULL WHERE id = $1`,
        [documentId, pageCount]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    await query(
      `UPDATE documents SET status = 'error', page_count = 0, error_message = $2 WHERE id = $1`,
      [documentId, err?.message ? String(err.message).slice(0, 500) : "Failed to process PDF."]
    );
  }
}

export async function listDocuments(userId: string, search?: string): Promise<DocumentRecord[]> {
  if (search && search.trim()) {
    const res = await query<DocumentRecord>(
      `SELECT * FROM documents WHERE user_id = $1 AND original_name ILIKE $2 ORDER BY uploaded_at DESC`,
      [userId, `%${search.trim()}%`]
    );
    return res.rows;
  }
  const res = await query<DocumentRecord>(
    `SELECT * FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC`,
    [userId]
  );
  return res.rows;
}

export async function getPages(documentId: string): Promise<PageRecord[]> {
  const res = await query<PageRecord>(
    `SELECT * FROM pages WHERE document_id = $1 ORDER BY page_number ASC`,
    [documentId]
  );
  return res.rows;
}

export async function deleteDocument(documentId: string, userId: string): Promise<boolean> {
  const doc = await getDocumentById(documentId, userId);
  if (!doc) return false;

  await query(`DELETE FROM documents WHERE id = $1`, [documentId]);
  await deleteFile(doc.file_path);
  return true;
}
