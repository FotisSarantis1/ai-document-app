"use strict";

const path = require("path");

/**
 * Shared extraction logic used by both invocation modes in
 * src/services/pdfProcessor.ts:
 *  - the child-process worker (pdfExtractWorker.js), for local dev/tests/a
 *    traditional long-running server
 *  - direct in-process use on Vercel (see pdfProcessor.ts), where a spawned
 *    subprocess adds serverless-bundling fragility for little benefit,
 *    since each invocation is already an isolated, short-lived sandbox
 *
 * Kept as a plain CommonJS module (no build step, no TypeScript) so both a
 * standalone script and the compiled/ts-node server can `require()` it
 * identically.
 */

function standardFontDataUrl() {
  // Deliberately not require.resolve("pdfjs-dist/package.json"): Vercel's
  // deployment bundle is built by tracing which files are actually
  // require()'d, and a package's package.json isn't reliably included in
  // that trace even when the package itself is (observed in production -
  // legacy/build/pdf.mjs and standard_fonts/ get bundled, package.json
  // doesn't). Deriving the package root from a file we know is required
  // works in every environment instead of depending on that file existing.
  const pdfMjsPath = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
  const packageRoot = path.join(path.dirname(pdfMjsPath), "..", "..");
  return path.join(packageRoot, "standard_fonts/");
}

async function extractPages(pdfjs, buffer) {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    disableFontFace: true,
    standardFontDataUrl: standardFontDataUrl(),
  });

  const doc = await loadingTask.promise;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => item.str).join(" ");
      pages.push({ pageNumber, text });
    }
  } finally {
    await loadingTask.destroy();
  }

  return { pageCount: pages.length, pages };
}

module.exports = { extractPages, standardFontDataUrl };
