import path from "path";
import os from "os";
import fs from "fs";
import { randomUUID } from "crypto";

// Every test file gets its own isolated sqlite DB and upload directory so
// tests never share state or touch the real dev database/uploads folder.
const tmpRoot = path.join(os.tmpdir(), "ai-doc-app-tests", randomUUID());
fs.mkdirSync(tmpRoot, { recursive: true });

process.env.DATA_DIR = tmpRoot;
process.env.DATABASE_URL_SQLITE = path.join(tmpRoot, "test.db");
process.env.UPLOAD_DIR = path.join(tmpRoot, "uploads");
process.env.ANTHROPIC_API_KEY = ""; // force demo/mock mode in tests unless a test overrides it
process.env.CLIENT_ORIGIN = "http://localhost:5173";
