#!/usr/bin/env node
"use strict";

/**
 * Standalone PDF text-extraction worker, run as its own child process (see
 * src/services/pdfProcessor.ts) for local dev, tests, and a traditional
 * long-running server deployment - NOT used on Vercel (see pdfProcessor.ts
 * for why).
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
const { extractPages } = require("./pdfExtractCore");

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    process.stderr.write("Usage: pdfExtractWorker.js <pdf-file-path>\n");
    process.exit(2);
    return;
  }

  const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
  const buffer = fs.readFileSync(inputPath);
  const result = await extractPages(pdfjs, buffer);

  process.stdout.write(JSON.stringify(result));
}

main().catch((err) => {
  process.stderr.write(String((err && err.stack) || err) + "\n");
  process.exit(1);
});
