import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractionResult {
  pageCount: number;
  pages: ExtractedPage[];
}

const WORKER_PATH = path.join(__dirname, "..", "..", "scripts", "pdfExtractWorker.js");
const WORKER_TIMEOUT_MS = 30_000;

/**
 * Strips control/null characters that can slip in from malformed PDF text
 * streams. Keeps normal whitespace (tab/newline) intact.
 */
function sanitizeText(raw: string): string {
  const collapsed = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  return collapsed.replace(/[^\S\n]{2,}/g, " ").trim();
}

interface WorkerResult {
  pageCount: number;
  pages: { pageNumber: number; text: string }[];
}

function runExtractionWorker(pdfFilePath: string): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [WORKER_PATH, pdfFilePath],
      { timeout: WORKER_TIMEOUT_MS, maxBuffer: 50 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const reason = stderr?.trim() || error.message;
          reject(new Error(`PDF extraction failed: ${reason.slice(0, 500)}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("PDF extraction worker returned invalid output."));
        }
      }
    );
  });
}

/**
 * Vercel-only path: extracts in the same process instead of spawning a
 * child. Two reasons this differs from the default (see
 * scripts/pdfExtractWorker.js's header for the default's rationale):
 *  1. A serverless function's deployment bundle is built by statically
 *     tracing `require`/`import` calls. A path only ever referenced via
 *     `execFile(...)` (as the worker is) is invisible to that tracer and
 *     would silently be left out of the deployed bundle - a call reachable
 *     from this file's own import graph bundles correctly instead.
 *  2. The crash/hang isolation a child process buys on a long-running
 *     server is largely redundant on Vercel: each invocation already runs
 *     in its own short-lived, isolated sandbox, so an in-process failure
 *     here only ever fails that one request.
 *
 * pdfjs-dist's build is ESM-only, which needs a real dynamic `import()` at
 * runtime on Vercel's Lambda Node runtime - a plain `require()` fails there
 * with "require() of ES Module ... not supported". A literal `import()`
 * isn't good enough on its own though: TypeScript's CommonJS output (which
 * is what actually gets deployed here, not a raw esbuild passthrough)
 * rewrites `await import(x)` into `Promise.resolve().then(() =>
 * require(x))` - functionally still a plain `require()`, hitting the exact
 * same error. Building the specifier string behind `new Function(...)`
 * keeps the call invisible to that rewrite, so it stays a genuine dynamic
 * import at runtime.
 */
const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")>;

async function runInProcess(buffer: Buffer): Promise<WorkerResult> {
  const pdfjs = await dynamicImport("pdfjs-dist/legacy/build/pdf.mjs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { extractPages } = require("../../scripts/pdfExtractCore");
  return extractPages(pdfjs, buffer);
}

function sanitizeResult(result: WorkerResult): ExtractionResult {
  const pages = result.pages
    .map((p) => ({ pageNumber: p.pageNumber, text: sanitizeText(p.text) }))
    .sort((a, b) => a.pageNumber - b.pageNumber);
  return { pageCount: pages.length, pages };
}

/**
 * Extracts text from a PDF buffer while preserving page boundaries.
 *
 * Each page's text is captured separately, which is what lets retrieval and
 * citations point at a specific page number instead of just "somewhere in
 * the file". See `runInProcess` vs `runExtractionWorker` above for why
 * parsing happens differently depending on the deployment target.
 */
export async function extractPdfPages(buffer: Buffer): Promise<ExtractionResult> {
  if (process.env.VERCEL) {
    return sanitizeResult(await runInProcess(buffer));
  }

  const tmpFile = path.join(os.tmpdir(), `pdf-extract-${crypto.randomUUID()}.pdf`);
  fs.writeFileSync(tmpFile, buffer);

  try {
    const result = await runExtractionWorker(tmpFile);
    return sanitizeResult(result);
  } finally {
    fs.unlink(tmpFile, () => {
      /* best-effort cleanup of the temp copy */
    });
  }
}
