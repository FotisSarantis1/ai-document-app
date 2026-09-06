import { DEMO_DOCUMENTS } from "./demoContent";
import { buildPdfFromPages } from "./pdfBuilder";
import { createDocument, processDocument, getDocumentById } from "./documentService";
import { DocumentRecord } from "../types";

/**
 * Generates the bundled sample PDFs and loads them into the given user's
 * account through the exact same processing pipeline as a real upload
 * (so demo mode genuinely exercises upload -> extraction -> ready).
 * Documents are flagged `is_demo` so the UI can badge them clearly as
 * sample data, distinct from anything the user actually uploaded.
 */
export async function loadDemoDocuments(userId: string): Promise<DocumentRecord[]> {
  const created: DocumentRecord[] = [];

  for (const spec of DEMO_DOCUMENTS) {
    const pdfBytes = await buildPdfFromPages(spec.pages, { title: spec.filename });

    const doc = await createDocument({
      userId,
      originalName: spec.filename,
      fileBuffer: pdfBytes,
      fileSize: pdfBytes.length,
      isDemo: true,
    });

    await processDocument(doc.id);
    created.push((await getDocumentById(doc.id, userId)) ?? doc);
  }

  return created;
}
