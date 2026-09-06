import path from "path";
import os from "os";
import fs from "fs";
import { randomUUID } from "crypto";

// Every test file gets its own isolated in-memory Postgres (pg-mem) and its
// own upload directory, so tests never share state or touch a real database
// or the dev uploads folder. See src/db/index.ts for how PGMEM_TEST swaps
// the real `pg` Pool for an in-memory Postgres-compatible one.
const tmpRoot = path.join(os.tmpdir(), "ai-doc-app-tests", randomUUID());
fs.mkdirSync(tmpRoot, { recursive: true });

process.env.PGMEM_TEST = "1";
process.env.UPLOAD_DIR = path.join(tmpRoot, "uploads");
process.env.ANTHROPIC_API_KEY = ""; // force demo/mock mode in tests unless a test overrides it
process.env.CLIENT_ORIGIN = "http://localhost:5173";
delete process.env.BLOB_READ_WRITE_TOKEN; // force local-disk storage adapter in tests
delete process.env.VERCEL; // force the child-process PDF extraction path in tests
