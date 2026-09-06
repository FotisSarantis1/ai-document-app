# DocuMind - AI Document Analysis

Upload PDF documents, then ask questions about them in a chat interface. Every
answer is grounded in the uploaded PDFs and cites the source document and
page number. Nothing is invented: if the answer isn't in your documents, the
app says so.

This is a working MVP, not a mockup - both the server and the client are
fully functional, covered by automated tests, and runnable locally with no
paid services required (a **demo mode** covers the AI parts when no API key
is configured).

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
├── server/     Express + TypeScript API, SQLite database, PDF processing
└── client/     React + TypeScript + Vite dashboard and chat UI
```

**Why this stack:** the brief asked for the simplest reliable architecture,
not a distributed system. A single Express API backed by SQLite (via
`better-sqlite3`) needs no external database server, keeps the whole app
runnable with `npm install && npm run dev`, and is still a completely
standard, production-shaped Node/Postgres-style setup - swapping SQLite for
Postgres later is a driver change, not a redesign (see
[How AI retrieval works](#how-ai-retrieval-works) for how the schema is
already shaped for that).

Key server pieces (`server/src/`):

- `db/schema.sql` - `users`, `documents`, `pages`, `conversations`,
  `messages` tables.
- `services/pdfProcessor.ts` - extracts text per PDF page (see below).
- `services/documentService.ts` - upload/process/list/delete orchestration.
- `services/retriever.ts` - keyword search over stored pages.
- `services/aiClient.ts` - Claude question-answering + summarization, with a
  built-in demo/mock fallback.
- `routes/documents.ts`, `routes/chat.ts` - the HTTP API.
- `middleware/session.ts` - anonymous per-browser user isolation.
- `middleware/upload.ts` - file validation (type, size, on-disk isolation).

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

Requires Node.js 20+ (developed and tested on Node 22).

```bash
# Server
cd server
npm install
cp .env.example .env   # edit if you have a real Anthropic API key

# Client (in a second terminal)
cd client
npm install
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
| `PORT` | No (default `4000`) | API server port. |
| `CLIENT_ORIGIN` | No (default `http://localhost:5173`) | Allowed CORS origin for cookies. |
| `ANTHROPIC_API_KEY` | No | Claude API key. If unset, the app runs in **demo mode** (see below) instead of failing. |
| `AI_MODEL` | No (default `claude-sonnet-5`) | Claude model used for chat answers and summaries. |
| `UPLOAD_DIR` | No (default `./uploads`) | Where uploaded PDFs are stored on disk, isolated per browser session. |
| `DATA_DIR` | No (default `./data`) | Where the SQLite database file lives. |
| `MAX_FILE_SIZE_MB` | No (default `20`) | Per-file upload size limit. |

The **AI API key is only ever read on the server** (`server/src/services/aiClient.ts`)
and is never sent to or exposed in the frontend bundle.

The client has no required environment variables - it talks to the API at a
relative `/api` path, proxied in dev and expected to be reverse-proxied (or
served from the same origin) in production.

## How PDF processing works

1. A PDF is uploaded via `POST /api/documents/upload` (`multer`, disk
   storage). The file is validated three ways: MIME type, `.pdf` extension,
   and - the one that actually matters for security - its `%PDF-` magic
   bytes, so a renamed non-PDF file is rejected even if the browser lied
   about its MIME type.
2. A `documents` row is created with `status = "processing"`, and text
   extraction runs (see `services/pdfProcessor.ts`).
3. Extraction itself happens in a **separate short-lived child process**
   (`scripts/pdfExtractWorker.js`) using `pdfjs-dist`, one page at a time.
   Running it out-of-process means a malformed or hostile PDF can crash or
   hang that worker without taking down the API server - defense in depth
   for parsing untrusted uploads.
4. Each page's text becomes its own row in the `pages` table
   (`document_id`, `page_number`, `text`), which is what lets citations and
   the PDF viewer point at an exact page instead of "somewhere in the file".
5. The document flips to `status = "ready"` (or `"error"` with a message,
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

21 automated tests (Jest + Supertest) cover:

- PDF upload (valid files, multi-file batches)
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
- PDF parsing runs in an isolated child process, not in the main server
  process.
- Uploaded files are never served from a static/public directory - the only
  way to read a document's file or text is through routes that check the
  requesting session's `userId` against the document's owner.
- Each browser gets an anonymous, unguessable session id (httpOnly cookie)
  that scopes all of its documents and conversations. This is isolation
  between visitors, **not** a full authentication system - there are no
  passwords or accounts. Add real auth (and swap the cookie for a signed
  session/JWT) before handling data that needs stronger guarantees than
  "other visitors can't stumble onto it."
- Extracted PDF text is sanitized (control characters stripped) before
  being stored or sent to the model.

## Deployment

The server builds to plain Node/Express and the client to a static bundle:

```bash
# Server
cd server
npm run build      # compiles to dist/, also copies db/schema.sql
npm start           # runs dist/index.js

# Client
cd client
npm run build       # outputs static files to dist/
```

Any setup that can (a) run a small Node process for the server and (b)
serve static files for the client works - for example:

- Put the client's `dist/` behind a static host or CDN, and reverse-proxy
  `/api/*` from that same domain to the server process (this is what the
  Vite dev proxy simulates locally). This avoids any CORS configuration.
- Or serve both from the same origin by having the Express server itself
  serve `client/dist` as static files (add `app.use(express.static(...))`
  and a catch-all route in `server/src/app.ts`) if you'd rather ship one
  process.

For production, also:

- Set a real `ANTHROPIC_API_KEY` to move out of demo mode.
- Point `DATA_DIR` and `UPLOAD_DIR` at persistent volumes (they hold the
  SQLite database and every uploaded PDF).
- Set `CLIENT_ORIGIN` to your real frontend origin if the two are on
  different domains.
- Run the server behind HTTPS and set `cookie({ secure: true })` in
  `middleware/session.ts` accordingly.
