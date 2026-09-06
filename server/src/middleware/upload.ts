import multer from "multer";
import path from "path";
import { Request } from "express";

const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 20);
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;

export class InvalidFileError extends Error {
  status = 400;
}

// Files are buffered in memory for the lifetime of the request, then handed
// to services/storage.ts to persist (local disk or Vercel Blob depending on
// environment). Serverless functions don't have a writable, persistent
// filesystem to stream directly to, so disk storage isn't an option here.
const storageEngine = multer.memoryStorage();

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const isPdfMime = file.mimetype === "application/pdf";
  const isPdfExt = path.extname(file.originalname).toLowerCase() === ".pdf";

  if (!isPdfMime || !isPdfExt) {
    cb(new InvalidFileError("Only PDF files are supported."));
    return;
  }
  cb(null, true);
}

export const upload = multer({
  storage: storageEngine,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_UPLOAD,
  },
});
