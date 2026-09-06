import { getPages } from "./documentService";
import { summarizeDocument } from "./aiClient";
import { DocumentRecord } from "../types";

export async function generateSummary(doc: DocumentRecord): Promise<string> {
  const pages = getPages(doc.id);
  return summarizeDocument(
    doc.original_name,
    pages.map((p) => ({ pageNumber: p.page_number, text: p.text }))
  );
}
