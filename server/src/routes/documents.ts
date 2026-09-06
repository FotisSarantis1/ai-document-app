import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { upload, InvalidFileError, MAX_FILE_SIZE_BYTES } from "../middleware/upload";
import {
  createProcessingDocumentRecord,
  processDocument,
  listDocuments,
  getDocumentById,
  getPages,
  deleteDocument,
} from "../services/documentService";
import { generateSummary } from "../services/summaryService";
import { loadDemoDocuments } from "../services/demoService";

const router = Router();

function isPdfSignature(filePath: string): boolean {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    return buf.toString("ascii") === "%PDF-";
  } finally {
    fs.closeSync(fd);
  }
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
      if (!isPdfSignature(file.path)) {
        fs.unlinkSync(file.path);
        results.push({
          originalName: file.originalname,
          error: "File content is not a valid PDF.",
        });
        continue;
      }

      const doc = createProcessingDocumentRecord({
        userId: req.userId,
        filename: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
      });

      results.push({ document: doc });

      // Process asynchronously so the upload response returns immediately;
      // the dashboard polls status and flips "processing" -> "ready"/"error".
      processDocument(doc.id).catch(() => {
        /* processDocument already persists failure state internally */
      });
    }

    const allFailed = results.every((r) => "error" in r);
    res.status(allFailed ? 400 : 201).json({ results });
  });
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
router.get("/", (req: Request, res: Response) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const docs = listDocuments(req.userId, search);
  res.json({ documents: docs });
});

// GET /api/documents/:id
router.get("/:id", (req: Request, res: Response) => {
  const doc = getDocumentById(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  res.json({ document: doc });
});

// GET /api/documents/:id/pages
router.get("/:id/pages", (req: Request, res: Response) => {
  const doc = getDocumentById(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  res.json({ pages: getPages(doc.id) });
});

// GET /api/documents/:id/pages/:pageNumber - single page content (for citation viewer)
router.get("/:id/pages/:pageNumber", (req: Request, res: Response) => {
  const doc = getDocumentById(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  const pageNumber = Number(req.params.pageNumber);
  const page = getPages(doc.id).find((p) => p.page_number === pageNumber);
  if (!page) return res.status(404).json({ error: "Page not found." });
  res.json({ page, documentName: doc.original_name });
});

// GET /api/documents/:id/file - serves the raw PDF, scoped to the owning user only
router.get("/:id/file", (req: Request, res: Response) => {
  const doc = getDocumentById(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  if (!fs.existsSync(doc.file_path)) {
    return res.status(404).json({ error: "File is no longer available." });
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${path.basename(doc.original_name)}"`);
  res.sendFile(path.resolve(doc.file_path));
});

// POST /api/documents/:id/summarize
router.post("/:id/summarize", async (req: Request, res: Response) => {
  const doc = getDocumentById(req.params.id, req.userId);
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
router.delete("/:id", (req: Request, res: Response) => {
  const deleted = deleteDocument(req.params.id, req.userId);
  if (!deleted) return res.status(404).json({ error: "Document not found." });
  res.status(204).send();
});

export default router;
