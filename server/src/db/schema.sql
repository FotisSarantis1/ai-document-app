-- Users are anonymous browser sessions (cookie-based). No passwords in this MVP,
-- but every document/conversation is scoped to a user_id so data never crosses sessions.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,          -- storage key/on-disk name
  original_name TEXT NOT NULL,     -- name shown to the user
  file_path TEXT NOT NULL,         -- storage adapter key: local path or Blob URL
  file_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing', -- processing | ready | error
  error_message TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);

-- One row per PDF page. This is the retrieval unit today (keyword search over
-- page text) and is deliberately shaped so a future embeddings column/vector
-- index can be bolted onto the same rows without changing the ingestion flow.
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  embedding BYTEA, -- reserved for future vector search; unused today
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pages_document ON pages(document_id);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user | assistant
  content TEXT NOT NULL,
  citations TEXT, -- JSON array of {documentId, documentName, pageNumber, snippet}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
