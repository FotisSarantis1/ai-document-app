import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { extractPdfPages } from "./pdfProcessor";
import { DocumentRecord, PageRecord } from "../types";

const insertDocument = db.prepare(`
  INSERT INTO documents (id, user_id, filename, original_name, file_path, file_size, status, page_count, is_demo)
  VALUES (@id, @user_id, @filename, @original_name, @file_path, @file_size, @status, @page_count, @is_demo)
`);

const insertPage = db.prepare(`
  INSERT INTO pages (id, document_id, page_number, text)
  VALUES (@id, @document_id, @page_number, @text)
`);

const updateDocumentStatus = db.prepare(`
  UPDATE documents SET status = ?, page_count = ?, error_message = ? WHERE id = ?
`);

export function getDocumentById(id: string, userId: string): DocumentRecord | undefined {
  return db
    .prepare(`SELECT * FROM documents WHERE id = ? AND user_id = ?`)
    .get(id, userId) as DocumentRecord | undefined;
}

export function createProcessingDocumentRecord(params: {
  userId: string;
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  isDemo?: boolean;
}): DocumentRecord {
  const id = uuidv4();
  insertDocument.run({
    id,
    user_id: params.userId,
    filename: params.filename,
    original_name: params.originalName,
    file_path: params.filePath,
    file_size: params.fileSize,
    status: "processing",
    page_count: 0,
    is_demo: params.isDemo ? 1 : 0,
  });
  return db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocumentRecord;
}

/**
 * Runs PDF extraction for a document already recorded as "processing" and
 * writes one row per page. Any failure marks the document "error" instead of
 * throwing, so a bad upload never leaves a document stuck in limbo.
 */
export async function processDocument(documentId: string): Promise<void> {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(documentId) as
    | DocumentRecord
    | undefined;
  if (!doc) return;

  try {
    const buffer = fs.readFileSync(doc.file_path);
    const { pageCount, pages } = await extractPdfPages(buffer);

    if (pageCount === 0) {
      updateDocumentStatus.run("error", 0, "No pages could be extracted from this PDF.", documentId);
      return;
    }

    const insertMany = db.transaction((pagesToInsert: typeof pages) => {
      for (const page of pagesToInsert) {
        insertPage.run({
          id: uuidv4(),
          document_id: documentId,
          page_number: page.pageNumber,
          text: page.text,
        });
      }
    });
    insertMany(pages);

    updateDocumentStatus.run("ready", pageCount, null, documentId);
  } catch (err: any) {
    updateDocumentStatus.run(
      "error",
      0,
      err?.message ? String(err.message).slice(0, 500) : "Failed to process PDF.",
      documentId
    );
  }
}

export function listDocuments(userId: string, search?: string): DocumentRecord[] {
  if (search && search.trim()) {
    return db
      .prepare(
        `SELECT * FROM documents WHERE user_id = ? AND original_name LIKE ? ORDER BY uploaded_at DESC`
      )
      .all(userId, `%${search.trim()}%`) as DocumentRecord[];
  }
  return db
    .prepare(`SELECT * FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC`)
    .all(userId) as DocumentRecord[];
}

export function getPages(documentId: string): PageRecord[] {
  return db
    .prepare(`SELECT * FROM pages WHERE document_id = ? ORDER BY page_number ASC`)
    .all(documentId) as PageRecord[];
}

export function deleteDocument(documentId: string, userId: string): boolean {
  const doc = db
    .prepare("SELECT * FROM documents WHERE id = ? AND user_id = ?")
    .get(documentId, userId) as DocumentRecord | undefined;
  if (!doc) return false;

  db.prepare("DELETE FROM documents WHERE id = ?").run(documentId);
  if (fs.existsSync(doc.file_path)) {
    fs.unlinkSync(doc.file_path);
  }
  return true;
}
