import { Router, Request, Response } from "express";
import path from "path";
import { upload, InvalidFileError, MAX_FILE_SIZE_BYTES } from "../middleware/upload";
import {
  createDocument,
  processDocument,
  listDocuments,
  getDocumentById,
  getPages,
  deleteDocument,
} from "../services/documentService";
import { readFile } from "../services/storage";
import { generateSummary } from "../services/summaryService";
import { loadDemoDocuments } from "../services/demoService";

const router = Router();

function isPdfSignature(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

// POST /api/documents/upload - accepts one or more PDFs
router.post("/upload", (req: Request, res: Response) => {
  upload.array("files", 10)(req, res, async (err: any) => {
    if (err) {
      const status = err instanceof InvalidFileError ? 400 : err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? `File exceeds the ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB limit.`
          : err.message || "Upload failed.";
      return res.status(status).json({ error: message });
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files were uploaded." });
    }

    const results = [];
    for (const file of files) {
      // Defense in depth: the client-declared mimetype/extension already
      // passed the multer filter, but only the file's magic bytes prove it's
      // really a PDF and not a renamed executable or script.
      if (!isPdfSignature(file.buffer)) {
        results.push({
          originalName: file.originalname,
          error: "File content is not a valid PDF.",
        });
        continue;
      }

      const doc = await createDocument({
        userId: req.userId,
        originalName: file.originalname,
        fileBuffer: file.buffer,
        fileSize: file.size,
      });

      results.push({ document: doc });

      // Deliberately NOT started here - see POST /:id/process. Kicking off
      // extraction as an unawaited ("fire and forget") promise in this same
      // request looks like it returns the response immediately, but on
      // Vercel's serverless runtime the invocation isn't actually considered
      // finished until the event loop drains, so the client's response gets
      // held up behind that background work anyway and the whole request
      // can hit the function's timeout. The client triggers processing with
      // a separate request instead, so it runs in its own invocation with
      // its own time budget, fully decoupled from this response.
    }

    const allFailed = results.every((r) => "error" in r);
    res.status(allFailed ? 400 : 201).json({ results });
  });
});

// POST /api/documents/:id/process - runs extraction for a document created
// via /upload. Called by the client right after upload; kept as its own
// endpoint (rather than folded into /upload) specifically so it runs as a
// separate request/invocation with its own time budget - see the comment
// above. Safe to call more than once: a no-op once the document has left
// "processing".
router.post("/:id/process", async (req: Request, res: Response) => {
  const doc = await getDocumentById(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: "Document not found." });

  if (doc.status !== "processing") {
    return res.json({ document: doc });
  }

  await processDocument(doc.id);
  const updated = await getDocumentById(req.params.id, req.userId);
  res.json({ document: updated });
});

// POST /api/documents/demo - loads the bundled sample PDFs into the current session
router.post("/demo", async (req: Request, res: Response) => {
  try {
    const documents = await loadDemoDocuments(req.userId);
    res.status(201).json({ documents });
  } catch (err) {
    res.status(500).json({ error: "Failed to load demo documents." });
  }
});

// GET /api/documents?search=
router.get("/", async (req: Request, res: Response) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const docs = await listDocuments(req.userId, search);
  res.json({ documents: docs });
});

// GET /api/documents/:id
router.get("/:id", async (req: Request, res: Response) => {
  const doc = await getDocumentById(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  res.json({ document: doc });
});

// GET /api/documents/:id/pages
router.get("/:id/pages", async (req: Request, res: Response) => {
  const doc = await getDocumentById(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  res.json({ pages: await getPages(doc.id) });
});

// GET /api/documents/:id/pages/:pageNumber - single page content (for citation viewer)
router.get("/:id/pages/:pageNumber", async (req: Request, res: Response) => {
  const doc = await getDocumentById(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  const pageNumber = Number(req.params.pageNumber);
  const pages = await getPages(doc.id);
  const page = pages.find((p) => p.page_number === pageNumber);
  if (!page) return res.status(404).json({ error: "Page not found." });
  res.json({ page, documentName: doc.original_name });
});

// GET /api/documents/:id/file - serves the raw PDF, scoped to the owning user only
router.get("/:id/file", async (req: Request, res: Response) => {
  const doc = await getDocumentById(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: "Document not found." });

  try {
    const buffer = await readFile(doc.file_path);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(doc.original_name)}"`);
    res.send(buffer);
  } catch {
    res.status(404).json({ error: "File is no longer available." });
  }
});

// POST /api/documents/:id/summarize
router.post("/:id/summarize", async (req: Request, res: Response) => {
  const doc = await getDocumentById(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  if (doc.status !== "ready") {
    return res.status(409).json({ error: `Document is not ready yet (status: ${doc.status}).` });
  }

  try {
    const summary = await generateSummary(doc);
    res.json({ summary });
  } catch (err: any) {
    res.status(502).json({ error: "Failed to generate summary. Please try again." });
  }
});

// DELETE /api/documents/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const deleted = await deleteDocument(req.params.id, req.userId);
  if (!deleted) return res.status(404).json({ error: "Document not found." });
  res.status(204).send();
});

export default router;
