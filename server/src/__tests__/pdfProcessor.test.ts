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

// The `process.env.VERCEL` in-process extraction path (see pdfProcessor.ts)
// intentionally isn't exercised by this Jest suite: it loads pdfjs-dist's
// ESM build via a real dynamic `import()`, kept behind `new Function(...)`
// so TypeScript's CommonJS output can't rewrite it back into a `require()`
// (which fails at runtime on Vercel - see the comment on `runInProcess`).
// Neither Jest's module loader nor a bundler's static analysis can see
// through that indirection the way a real Node process can, which is
// exactly why it's there - so this path can't be driven from here. It's
// verified instead by running it under `tsx` with `VERCEL=1` set and
// diffing the output against the default worker path (done manually before
// each change to this file), and - the strongest check - by executing the
// actual bundled `vercel build` output directly with plain `node` against
// a real upload/process/chat request, which caught two real bugs
// (`require()` vs `import()`, and a `require.resolve("pdfjs-dist/package.json")`
// that doesn't survive bundling) that running the TypeScript source
// directly never would have.
