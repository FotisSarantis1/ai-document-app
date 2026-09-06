import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Builds a small real PDF in memory with one page per string in `pagesText`,
 * so tests can assert on page-boundary-preserving extraction without
 * shipping binary fixture files.
 */
export async function makeTestPdf(pagesText: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const text of pagesText) {
    const page = doc.addPage([595, 842]);
    const lines = text.match(/.{1,90}(\s|$)/g) || [text];
    let y = 780;
    for (const line of lines) {
      page.drawText(line.trim(), { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
      y -= 18;
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
