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
  uploaded_at: string;
}

export interface PageRecord {
  id: string;
  document_id: string;
  page_number: number;
  text: string;
  created_at: string;
}

export interface Citation {
  documentId: string;
  documentName: string;
  pageNumber: number;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  createdAt: string;
}

export interface UploadResultItem {
  document?: DocumentRecord;
  originalName?: string;
  error?: string;
}
