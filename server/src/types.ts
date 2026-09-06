export type DocumentStatus = "processing" | "ready" | "error";

export interface DocumentRecord {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  status: DocumentStatus;
  error_message: string | null;
  page_count: number;
  is_demo: boolean;
  uploaded_at: Date;
}

export interface PageRecord {
  id: string;
  document_id: string;
  page_number: number;
  text: string;
  created_at: Date;
}

export interface Citation {
  documentId: string;
  documentName: string;
  pageNumber: number;
  snippet: string;
}

export interface ConversationRecord {
  id: string;
  user_id: string;
  title: string | null;
  created_at: Date;
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  citations: string | null;
  created_at: Date;
}
