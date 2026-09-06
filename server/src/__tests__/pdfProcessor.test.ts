import { extractPdfPages } from "../services/pdfProcessor";
import { makeTestPdf } from "./helpers/makePdf";

describe("extractPdfPages", () => {
  it("extracts text and preserves page boundaries across multiple pages", async () => {
    const pdf = await makeTestPdf([
      "The vacation policy allows twenty days per year.",
      "The cancellation deadline is thirty days before renewal.",
      "Contact the finance department for billing questions.",
    ]);

    const result = await extractPdfPages(pdf);

    expect(result.pageCount).toBe(3);
    expect(result.pages).toHaveLength(3);

    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toContain("vacation policy");
    expect(result.pages[0].text).not.toContain("cancellation deadline");

    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[1].text).toContain("cancellation deadline");
    expect(result.pages[1].text).not.toContain("vacation policy");

    expect(result.pages[2].pageNumber).toBe(3);
    expect(result.pages[2].text).toContain("finance department");
  });

  it("returns zero pages for a single-page document with no pages array mismatch", async () => {
    const pdf = await makeTestPdf(["Only one page of content here."]);
    const result = await extractPdfPages(pdf);
    expect(result.pageCount).toBe(1);
    expect(result.pages[0].text).toContain("Only one page");
  });

  it("sanitizes control characters out of extracted text", async () => {
    const pdf = await makeTestPdf(["Clean text without control characters."]);
    const result = await extractPdfPages(pdf);
    // eslint-disable-next-line no-control-regex
    expect(/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(result.pages[0].text)).toBe(false);
  });
});
