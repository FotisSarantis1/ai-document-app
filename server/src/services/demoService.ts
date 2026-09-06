import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { UPLOAD_ROOT } from "../middleware/upload";
import { DEMO_DOCUMENTS } from "./demoContent";
import { buildPdfFromPages } from "./pdfBuilder";
import { createProcessingDocumentRecord, processDocument, getDocumentById } from "./documentService";
import { DocumentRecord } from "../types";

/**
 * Generates the bundled sample PDFs and loads them into the given user's
 * account through the exact same processing pipeline as a real upload
 * (so demo mode genuinely exercises upload -> extraction -> ready).
 * Documents are flagged `is_demo = 1` so the UI can badge them clearly as
 * sample data, distinct from anything the user actually uploaded.
 */
export async function loadDemoDocuments(userId: string): Promise<DocumentRecord[]> {
  const userDir = path.join(UPLOAD_ROOT, userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const created: DocumentRecord[] = [];

  for (const spec of DEMO_DOCUMENTS) {
    const pdfBytes = await buildPdfFromPages(spec.pages, { title: spec.filename });
    const onDiskName = `${uuidv4()}.pdf`;
    const filePath = path.join(userDir, onDiskName);
    fs.writeFileSync(filePath, pdfBytes);

    const doc = createProcessingDocumentRecord({
      userId,
      filename: onDiskName,
      originalName: spec.filename,
      filePath,
      fileSize: pdfBytes.length,
      isDemo: true,
    });

    await processDocument(doc.id);
    created.push(getDocumentById(doc.id, userId) ?? doc);
  }

  return created;
}
