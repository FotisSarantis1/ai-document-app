import fs from "fs";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { Request } from "express";

export const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(__dirname, "..", "..", "uploads");
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 20);
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;

if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

export class InvalidFileError extends Error {
  status = 400;
}

const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    // Files are isolated per user on disk, mirroring the DB-level isolation.
    const userId = req.userId;
    const dir = path.join(UPLOAD_ROOT, userId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, _file, cb) => {
    // Never trust the original filename for the on-disk name (path traversal,
    // collisions, executable extensions). The real name is kept only in the DB.
    cb(null, `${uuidv4()}.pdf`);
  },
});

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
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_UPLOAD,
  },
});
