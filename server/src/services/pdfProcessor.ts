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
 * Extracts text from a PDF buffer while preserving page boundaries.
 *
 * The actual parsing (pdfjs-dist) runs in a short-lived child process (see
 * scripts/pdfExtractWorker.js) rather than in-process, so a malformed or
 * malicious upload can't crash or hang the API server. Each page's text is
 * captured separately, which is what lets retrieval and citations point at
 * a specific page number instead of just "somewhere in the file".
 */
export async function extractPdfPages(buffer: Buffer): Promise<ExtractionResult> {
  const tmpFile = path.join(os.tmpdir(), `pdf-extract-${crypto.randomUUID()}.pdf`);
  fs.writeFileSync(tmpFile, buffer);

  try {
    const result = await runExtractionWorker(tmpFile);
    const pages = result.pages
      .map((p) => ({ pageNumber: p.pageNumber, text: sanitizeText(p.text) }))
      .sort((a, b) => a.pageNumber - b.pageNumber);

    return { pageCount: pages.length, pages };
  } finally {
    fs.unlink(tmpFile, () => {
      /* best-effort cleanup of the temp copy */
    });
  }
}
