# DocuMind - AI Document Analysis

Upload PDF documents, then ask questions about them in a chat interface. Every
answer is grounded in the uploaded PDFs and cites the source document and
page number. Nothing is invented: if the answer isn't in your documents, the
app says so.

This is a working MVP, not a mockup - both the server and the client are
fully functional and covered by automated tests. It needs a free Postgres
database to run (see [Install](#install)), but no paid services: a
**demo mode** covers the AI parts when no API key is configured, and the
automated test suite needs no external services at all.

## Table of contents

1. [What it does](#what-it-does)
2. [Architecture](#architecture)
3. [Install](#install)
4. [Run it](#run-it)
5. [Environment variables](#environment-variables)
6. [How PDF processing works](#how-pdf-processing-works)
7. [How AI retrieval works](#how-ai-retrieval-works)
8. [Demo mode](#demo-mode)
9. [Tests](#tests)
10. [Security notes](#security-notes)
11. [Deployment](#deployment)

## What it does

- Upload one or more PDFs from a clean dashboard.
- The server extracts text from each PDF, **page by page**, and stores it.
- The dashboard shows each document's name, upload date, processing status,
  and page count. You can search, delete, or generate an AI summary for any
  document.
- The "Ask your documents" chat retrieves the most relevant pages across all
  of your documents and asks Claude to answer strictly from that content.
- Every answer that draws on the documents shows citations like
  `Source: employee-handbook.pdf — Page 12`. Clicking a citation opens that
  exact page of the PDF alongside its extracted text.
- Follow-up questions keep the conversation's context.
- If nothing in your documents supports an answer, the app replies:
  _"I couldn't find this information in the uploaded documents."_

## Architecture

```
ai-document-app/
├── api/index.ts   Vercel serverless function entry point (wraps server/src/app)
├── server/        Express + TypeScript API, Postgres database, PDF processing
└── client/        React + TypeScript + Vite dashboard and chat UI
```

**Why this stack:** the brief asked for the simplest reliable architecture,
not a distributed system - a single Express API is that, whether it runs as
a traditional long-running process or as a Vercel serverless function (both
are supported; see [Deployment](#deployment)). The database is Postgres via
the plain `pg` driver: no ORM, one query dialect used everywhere (dev,
tests, and production), and it's the one piece of storage a serverless
deployment genuinely requires - see [Deployment](#deployment) for why.

Uploaded PDF bytes go through a small storage adapter
(`services/storage.ts`) instead of being written to local disk directly:
locally that's still just disk, but on Vercel - where a serverless
function's filesystem doesn't persist between requests - it's Vercel Blob
instead. Everything else in the app (routes, retrieval, chat) is unaware of
which one is active.

Key server pieces (`server/src/`):

- `db/schema.sql` - `users`, `documents`, `pages`, `conversations`,
  `messages` tables (Postgres).
- `services/pdfProcessor.ts` - extracts text per PDF page (see below).
- `services/storage.ts` - saves/reads/deletes PDF bytes (local disk or
  Vercel Blob).
- `services/documentService.ts` - upload/process/list/delete orchestration.
- `services/retriever.ts` - keyword search over stored pages.
- `services/aiClient.ts` - Claude question-answering + summarization, with a
  built-in demo/mock fallback.
- `routes/documents.ts`, `routes/chat.ts` - the HTTP API.
- `middleware/session.ts` - anonymous per-browser user isolation.
- `middleware/upload.ts` - file validation (type, size); buffers uploads in
  memory for the storage adapter to persist.

Client pieces (`client/src/`):

- `App.tsx` - responsive two-pane layout (documents sidebar + chat), with a
  tab switcher on narrower/tablet screens.
- `components/DocumentsPanel.tsx`, `DocumentRow.tsx`, `UploadButton.tsx` -
  the dashboard.
- `components/ChatPanel.tsx`, `MessageBubble.tsx` - "Ask your documents".
- `components/PdfViewerModal.tsx` - opens a cited page (PDF + extracted
  text) when a citation is clicked.
- `components/SummaryModal.tsx` - per-document AI summary.

There is no separate "vector database" service. See
[How AI retrieval works](#how-ai-retrieval-works) for why, and how the
schema is already shaped to add one later without a rewrite.

## Install

Requires Node.js 20+ (developed and tested on Node 22) and a Postgres
database - a free one from [Neon](https://neon.tech) or
[Vercel Postgres](https://vercel.com/storage/postgres) takes about two
minutes to create and works fine for local dev too.

```bash
npm install               # installs both workspaces (client + server)

cd server
cp .env.example .env      # set DATABASE_URL at minimum; ANTHROPIC_API_KEY is optional
```

## Run it

```bash
# Terminal 1
cd server
npm run dev        # http://localhost:4000

# Terminal 2
cd client
npm run dev         # http://localhost:5173
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` requests to
the backend, so no CORS configuration is needed in development.

On first load, the dashboard is empty. Click **Load sample documents** to
try the full flow immediately (see [Demo mode](#demo-mode)), or upload your
own PDFs.

## Environment variables

All server configuration lives in `server/.env` (see `server/.env.example`):

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | Postgres connection string. Not needed when running tests - see [Tests](#tests). |
| `PORT` | No (default `4000`) | API server port (local/traditional server only; Vercel ignores this). |
| `CLIENT_ORIGIN` | No | Allowed CORS origin for cookies. Leave unset in production on Vercel (same-origin, so CORS is moot); defaults to `http://localhost:5173` in spirit but really just reflects the request origin when unset. |
| `ANTHROPIC_API_KEY` | No | Claude API key. If unset, the app runs in **demo mode** (see below) instead of failing. |
| `AI_MODEL` | No (default `claude-sonnet-5`) | Claude model used for chat answers and summaries. |
| `BLOB_READ_WRITE_TOKEN` | No | Vercel Blob token for storing PDFs. Required in a Vercel deployment; leave unset locally to use local disk instead. |
| `UPLOAD_DIR` | No (default `./uploads`) | Where uploaded PDFs are stored on disk when `BLOB_READ_WRITE_TOKEN` isn't set. |
| `MAX_FILE_SIZE_MB` | No (default `20`) | Per-file upload size limit. |

The **AI API key is only ever read on the server** (`server/src/services/aiClient.ts`)
and is never sent to or exposed in the frontend bundle.

The client has no required environment variables - it talks to the API at a
relative `/api` path, proxied in dev and served from the same origin (via
Vercel rewrites) in production.

## How PDF processing works

1. A PDF is uploaded via `POST /api/documents/upload` (`multer`, buffered in
   memory). The file is validated three ways: MIME type, `.pdf` extension,
   and - the one that actually matters for security - its `%PDF-` magic
   bytes, so a renamed non-PDF file is rejected even if the browser lied
   about its MIME type.
2. The file is persisted via `services/storage.ts` (local disk, or Vercel
   Blob when deployed there), and a `documents` row is created with
   `status = "processing"`. **The upload request returns right here** -
   with the document still `"processing"` - without starting extraction.
3. The client immediately fires a separate request,
   `POST /api/documents/:id/process`, which is what actually runs
   extraction (see `services/pdfProcessor.ts`). This is a second HTTP
   request rather than the server just kicking extraction off "in the
   background" of the upload response, because on Vercel that background
   work isn't reliably background: a serverless invocation isn't guaranteed
   to keep running unawaited work after its response is sent, so an
   unawaited `processDocument()` call inside `/upload` could end up
   blocking - and occasionally timing out - the very response it was
   supposed to let return immediately. A separate request gets its own
   invocation with its own full time budget, genuinely decoupled from the
   upload response. `/process` is idempotent (calling it again on an
   already-processed document is a harmless no-op), so this is also safe
   under retries.
4. Extraction itself parses the PDF with `pdfjs-dist`, one page at a time, but
   *where* that parsing runs depends on the deployment target:
   - **Local dev, tests, or a traditional long-running server**: parsing
     happens in a **separate short-lived child process**
     (`scripts/pdfExtractWorker.js`). Running it out-of-process means a
     malformed or hostile PDF can crash or hang that worker without taking
     down the API server - defense in depth for parsing untrusted uploads.
   - **On Vercel**: parsing happens in-process instead. A serverless
     function's deployment bundle is built by statically tracing
     `require`/`import` calls, and a path only ever reached via a spawned
     child process is invisible to that tracer; the crash/hang isolation a
     child process buys is also largely redundant there, since each
     invocation already runs in its own short-lived, isolated sandbox. Both
     paths share the same extraction logic (`scripts/pdfExtractCore.js`) so
     there's exactly one implementation of "given a PDF, return per-page
     text", not two to keep in sync.
5. Each page's text becomes its own row in the `pages` table
   (`document_id`, `page_number`, `text`), which is what lets citations and
   the PDF viewer point at an exact page instead of "somewhere in the file".
6. The document flips to `status = "ready"` (or `"error"` with a message,
   if extraction failed) and the dashboard picks up the change via polling.

## How AI retrieval works

This app uses **retrieval-augmented generation**: before asking Claude
anything, the server finds the most relevant *pages* across your documents
and puts only that text in the prompt, instructed to answer strictly from
it.

Retrieval today (`services/retriever.ts`) is deliberately simple: it
tokenizes the question, scores each stored page by term-frequency overlap
(with a small bonus for an exact phrase match), and returns the top-scoring
pages. No embeddings, no vector database, no extra infrastructure - and for
the page counts this app deals with, it works well.

The schema and code are shaped so this can become real embedding-based
search later without changing anything upstream of `retriever.ts`: the
`pages` table already carries a spare `embedding` column, each page has a
stable `(document_id, page_number)` identity, and every caller only ever
consumes `retrieveRelevantChunks()`'s return shape - swapping its
implementation for a pgvector/embedding lookup is a one-file change.

The retrieved pages are then sent to Claude (`services/aiClient.ts`) with a
system prompt that:

- Forbids using anything outside the provided excerpts.
- Requires citing every source used, as `(Source: <document> — Page <n>)`.
- Requires replying with exactly
  _"I couldn't find this information in the uploaded documents."_ when the
  excerpts don't support an answer.

Citations returned by the API always carry a real `documentId` and
`pageNumber` from the retrieved pages (never invented by the model), which
is what the client uses to open the exact cited page.

## Demo mode

If `ANTHROPIC_API_KEY` is not set, the server automatically runs in **demo
mode** instead of failing:

- Chat answers are built directly from the top retrieved passages (clearly
  labeled `[Demo mode - no AI API key configured]`) instead of a
  Claude-generated response.
- Summaries are a basic extractive preview instead of an AI-generated one.
- Everything else - upload, processing, page extraction, citations, search,
  delete - is the real code path, not mocked.

This means the entire app is testable end-to-end with zero external
services or cost. Demo data is also kept clearly separate from anything you
upload yourself:

- Click **Load sample documents** in the dashboard to generate and ingest
  three sample PDFs (an employee handbook, a software license agreement,
  and a project proposal) into your current browser session. They're
  flagged `is_demo` in the database and shown with a **Demo** badge, but
  behave like any other document (deletable, summarizable, searchable).
- `npm run seed:demo` (in `server/`) does the same thing from the command
  line for a fixed CLI user, without starting the server.

## Tests

```bash
cd server
npm test
```

Tests need no external services and no `DATABASE_URL` - they run against
[pg-mem](https://github.com/oguimbal/pg-mem), an in-memory Postgres-compatible
engine, so `npm test` is fully self-contained (see
`src/__tests__/setupEnv.ts` and `src/db/index.ts`).

24 automated tests (Jest + Supertest) cover:

- PDF upload (valid files, multi-file batches) - and that `/upload` always
  responds with the document still `"processing"`, never starting
  extraction itself (see [How PDF processing works](#how-pdf-processing-works))
- The separate `/:id/process` endpoint: extraction completing it, calling
  it again being a harmless no-op, and it being scoped to the calling
  session like every other document route
- Text extraction and **page-boundary preservation** (a 3-page PDF yields 3
  distinct, correctly-ordered page records)
- Document storage and listing, including search
- Per-user document isolation (one browser session can't see another's
  documents or conversations)
- The full question-answering flow, including follow-up questions that
  reuse conversation history
- Citation generation (correct document + page number)
- The "not found" response when nothing supports an answer, including with
  zero documents uploaded (empty state)
- Invalid file handling: wrong extension/MIME type, and a `.pdf`-named file
  whose content isn't actually a PDF (magic-byte check)
- API error handling (a simulated AI provider failure returns a clean 502,
  not a crash)
- The demo-document loading endpoint

The client was verified manually (and with a throwaway Playwright script)
against a running server: upload, demo data loading, asking questions,
clicking a citation to open the right PDF page, generating a summary, and
the responsive tablet/mobile tab layout all work as described.

## Security notes

- The AI API key lives only in the server's environment; it is never sent
  to the client.
- Uploads are validated by extension, MIME type, **and** file signature
  (`%PDF-` magic bytes), and capped at `MAX_FILE_SIZE_MB`.
- PDF parsing runs in an isolated child process on a traditional server
  deployment (see [How PDF processing works](#how-pdf-processing-works)).
- Uploaded files are never served from a static/public directory, and the
  raw Vercel Blob URL (when that's the storage backend) is never sent to
  the client either - the only way to read a document's file or text is
  through routes that check the requesting session's `userId` against the
  document's owner, then fetch the bytes server-side.
- Each browser gets an anonymous, unguessable session id (httpOnly cookie)
  that scopes all of its documents and conversations. This is isolation
  between visitors, **not** a full authentication system - there are no
  passwords or accounts. Add real auth (and swap the cookie for a signed
  session/JWT) before handling data that needs stronger guarantees than
  "other visitors can't stumble onto it."
- Extracted PDF text is sanitized (control characters stripped) before
  being stored or sent to the model.

## Deployment

### Vercel

This repo deploys to Vercel as a single project: the client builds to a
static site, and the whole Express API is wrapped as one serverless
function (`api/index.ts`) that every `/api/*` request is routed to (see
`vercel.json`).

Vercel's serverless functions have **no persistent local filesystem** -
different requests can hit different, ephemeral instances - so the app's
storage layer is already built to not depend on one there: Postgres for the
database (used everywhere, not just on Vercel) and Vercel Blob for PDF
bytes (see [Architecture](#architecture)). Steps:

1. **Push this repo to GitHub** (or your git provider of choice) and import
   it into a new Vercel project. Vercel auto-detects `vercel.json` and the
   root `package.json` workspaces - no framework preset needed.
2. **Add a Postgres database.** In the Vercel dashboard: Storage tab → add
   the Neon/Postgres integration (or point `DATABASE_URL` at any Postgres
   you already have, e.g. a standalone Neon project). This sets
   `DATABASE_URL` (or a similarly-named variable - copy its value into
   `DATABASE_URL` if the integration uses a different name) as a project
   environment variable automatically.
3. **Add a Blob store.** Storage tab → add a Blob store. This sets
   `BLOB_READ_WRITE_TOKEN` automatically.
4. **Set `ANTHROPIC_API_KEY`** under Project Settings → Environment
   Variables to get real AI answers instead of demo mode (optional - the
   app works in demo mode without it).
5. **Deploy.** The schema (`server/src/db/schema.sql`) is applied
   automatically on first request (every statement is
   `CREATE ... IF NOT EXISTS`) - no separate migration step to run.

To validate the build locally before pushing (what was actually used to
verify this setup): `npx vercel build` after `npx vercel link`, which
produces `.vercel/output` with the static site and the bundled function
exactly as Vercel's build step would - useful for catching bundling issues
(missing dependencies, wrong paths) without waiting on a real deployment.

### Traditional server (alternative)

The server also runs as a plain long-running Node process, if you'd rather
not use serverless functions - in that case local disk works fine for PDF
storage (skip `BLOB_READ_WRITE_TOKEN`) since the filesystem persists there:

```bash
# Server
cd server
npm run build      # compiles to dist/, also copies db/schema.sql
npm start           # runs dist/index.js

# Client
cd client
npm run build       # outputs static files to dist/
```

Any host that can (a) run a small Node process for the server and (b) serve
static files for the client works - for example, put the client's `dist/`
behind a static host or CDN and reverse-proxy `/api/*` to the server
process, or have the Express server itself serve `client/dist` as static
files (add `express.static(...)` and a catch-all route in
`server/src/app.ts`) to ship one process.

For this deployment mode specifically, also point `UPLOAD_DIR` at a
persistent volume (not an ephemeral container filesystem), and run behind
HTTPS so the session cookie's `secure` flag (set automatically when
`VERCEL` is set; set it similarly for your platform in
`middleware/session.ts` otherwise) actually applies.
