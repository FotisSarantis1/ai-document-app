import type { ChatMessage, Citation, DocumentRecord, PageRecord, UploadResultItem } from "./types";

const BASE = "/api";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export { ApiError };

export function fetchDocuments(search?: string): Promise<{ documents: DocumentRecord[] }> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return request(`/documents${qs}`);
}

export function fetchDocument(id: string): Promise<{ document: DocumentRecord }> {
  return request(`/documents/${id}`);
}

export function fetchPages(id: string): Promise<{ pages: PageRecord[] }> {
  return request(`/documents/${id}/pages`);
}

export function fetchPage(
  id: string,
  pageNumber: number
): Promise<{ page: PageRecord; documentName: string }> {
  return request(`/documents/${id}/pages/${pageNumber}`);
}

export function fileUrl(id: string): string {
  return `${BASE}/documents/${id}/file`;
}

export async function uploadDocuments(
  files: File[]
): Promise<{ results: UploadResultItem[] }> {
  const form = new FormData();
  for (const file of files) form.append("files", file);
  return request(`/documents/upload`, { method: "POST", body: form });
}

/**
 * Same upload endpoint as `uploadDocuments`, but via XMLHttpRequest so we
 * can report real upload progress (fetch has no upload-progress event).
 */
export function uploadDocumentsWithProgress(
  files: File[],
  onProgress: (percent: number) => void
): Promise<{ results: UploadResultItem[] }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const file of files) form.append("files", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/documents/upload`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* ignore parse errors, handled below */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) {
        resolve(body);
      } else {
        reject(new ApiError(body?.error || "Upload failed.", xhr.status));
      }
    };

    xhr.onerror = () => reject(new ApiError("Network error during upload.", 0));
    xhr.send(form);
  });
}

/**
 * Triggers extraction for a document created via upload. Called right after
 * upload finishes, as its own request rather than something the server
 * kicks off in the background during /upload - on Vercel, a serverless
 * invocation isn't guaranteed to keep running unawaited work after its
 * response is sent, so processing needs its own request/invocation with its
 * own time budget instead of riding along inside the upload response.
 * Safe to call more than once; a no-op once the document has left
 * "processing".
 */
export function processDocument(id: string): Promise<{ document: DocumentRecord }> {
  return request(`/documents/${id}/process`, { method: "POST" });
}

export function deleteDocument(id: string): Promise<void> {
  return request(`/documents/${id}`, { method: "DELETE" });
}

export function summarizeDocument(id: string): Promise<{ summary: string }> {
  return request(`/documents/${id}/summarize`, { method: "POST" });
}

export function loadDemoDocuments(): Promise<{ documents: DocumentRecord[] }> {
  return request(`/documents/demo`, { method: "POST" });
}

export interface AskResponse {
  conversationId: string;
  message: ChatMessage;
  demoMode: boolean;
}

export function askQuestion(question: string, conversationId?: string): Promise<AskResponse> {
  return request(`/chat/ask`, {
    method: "POST",
    body: JSON.stringify({ question, conversationId }),
  });
}

export function fetchConversation(
  conversationId: string
): Promise<{ conversationId: string; messages: ChatMessage[] }> {
  return request(`/chat/${conversationId}/messages`);
}

export type { Citation };
