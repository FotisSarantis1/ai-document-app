#!/usr/bin/env node
"use strict";

/**
 * Standalone PDF text-extraction worker, always run as its own child
 * process (see src/services/pdfProcessor.ts) rather than loaded in-process.
 *
 * Two reasons for the extra process boundary instead of just requiring
 * pdfjs-dist directly from the server:
 *  1. Crash/hang isolation: pdfjs-dist is parsing untrusted, user-uploaded
 *     files. If a malformed or malicious PDF crashes the parser or spins
 *     forever, only this short-lived worker dies (or gets killed via the
 *     timeout in the parent) - the main API server keeps serving other
 *     requests.
 *  2. pdfjs-dist v4+ ships ESM-only. A plain `require()` of it works fine
 *     in a real, independent Node process like this one (Node 22 added
 *     native require(ESM) support), but not inside a test runner's own
 *     module system - keeping this logic out-of-process sidesteps that
 *     entirely instead of fighting the test runner's module loader.
 */

const fs = require("fs");
const path = require("path");

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    process.stderr.write("Usage: pdfExtractWorker.js <pdf-file-path>\n");
    process.exit(2);
    return;
  }

  const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
  const standardFontDataUrl = path.join(
    path.dirname(require.resolve("pdfjs-dist/package.json")),
    "standard_fonts/"
  );

  const data = new Uint8Array(fs.readFileSync(inputPath));
  const loadingTask = pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    disableFontFace: true,
    standardFontDataUrl,
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

  process.stdout.write(JSON.stringify({ pageCount: pages.length, pages }));
}

main().catch((err) => {
  process.stderr.write(String((err && err.stack) || err) + "\n");
  process.exit(1);
});
