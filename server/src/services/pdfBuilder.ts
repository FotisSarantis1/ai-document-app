import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Renders a simple multi-page PDF from plain-text page content. Used to
 * generate the bundled demo documents (and, in tests, disposable fixture
 * PDFs) without needing binary files checked into the repo.
 */
export async function buildPdfFromPages(
  pagesText: string[],
  opts: { title?: string } = {}
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  if (opts.title) {
    doc.setTitle(opts.title);
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  pagesText.forEach((pageText, index) => {
    const page = doc.addPage([612, 792]); // US Letter
    const margin = 56;
    const maxWidth = 612 - margin * 2;
    let y = 792 - margin;

    const paragraphs = pageText.split("\n");
    for (const paragraph of paragraphs) {
      if (paragraph.trim() === "") {
        y -= 12;
        continue;
      }

      const isHeading = paragraph.startsWith("# ");
      const text = isHeading ? paragraph.slice(2) : paragraph;
      const useFont = isHeading ? boldFont : font;
      const size = isHeading ? 15 : 11;

      const words = text.split(" ");
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        const width = useFont.widthOfTextAtSize(candidate, size);
        if (width > maxWidth && line) {
          page.drawText(line, { x: margin, y, size, font: useFont, color: rgb(0.1, 0.1, 0.1) });
          y -= size + 6;
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) {
        page.drawText(line, { x: margin, y, size, font: useFont, color: rgb(0.1, 0.1, 0.1) });
        y -= size + 6;
      }
      if (isHeading) y -= 4;
    }

    page.drawText(`Page ${index + 1} of ${pagesText.length}`, {
      x: margin,
      y: 30,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}
