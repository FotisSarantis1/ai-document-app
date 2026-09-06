import { useEffect, useRef, useState } from "react";
import type { ChatMessage, DocumentRecord } from "../types";
import { askQuestion, ApiError } from "../api";
import MessageBubble from "./MessageBubble";
import PdfViewerModal from "./PdfViewerModal";
import EmptyState from "./EmptyState";

const SAMPLE_QUESTIONS = [
  "What are the main requirements?",
  "What deadlines are mentioned?",
  "What does this say about cancellation?",
  "Summarize this document.",
];

interface Props {
  hasReadyDocuments: boolean;
  documents: DocumentRecord[];
}

export default function ChatPanel({ hasReadyDocuments, documents }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [citation, setCitation] = useState<{ documentId: string; documentName: string; pageNumber: number } | null>(
    null
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || sending) return;

    setError(null);
    setInput("");
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: trimmed, citations: [], createdAt: new Date().toISOString() },
    ]);

    try {
      const res = await askQuestion(trimmed, conversationId);
      setConversationId(res.conversationId);
      setDemoMode(res.demoMode);
      setMessages((prev) => [...prev, res.message]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-5 py-4">
        <h1 className="text-base font-semibold text-slate-900">Ask your documents</h1>
        <p className="text-xs text-slate-500">
          Answers are grounded in your uploaded PDFs, with source citations.
        </p>
        {demoMode && (
          <p className="mt-1 inline-block rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 ring-1 ring-inset ring-amber-600/20">
            Demo mode: no AI API key configured. Set ANTHROPIC_API_KEY for real AI-generated answers.
          </p>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              title={hasReadyDocuments ? "Ask a question to get started" : "Upload a document to start asking questions"}
              description={
                hasReadyDocuments
                  ? "Try one of the examples below, or ask your own question about your uploaded documents."
                  : "Once a document finishes processing, you can ask questions about it here."
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onOpenCitation={(documentId, documentName, pageNumber) =>
                  setCitation({ documentId, documentName, pageNumber })
                }
              />
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white px-4 py-2.5 text-sm text-slate-400 ring-1 ring-slate-200">
                  Thinking…
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {hasReadyDocuments && messages.length === 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="px-5 pb-2">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-600/20">
            {error}
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-slate-200 p-4"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          disabled={!hasReadyDocuments && documents.length === 0}
          rows={1}
          placeholder={
            documents.length === 0
              ? "Upload a document to start asking questions…"
              : "Ask a question about your documents…"
          }
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Send
        </button>
      </form>

      {citation && (
        <PdfViewerModal
          documentId={citation.documentId}
          documentName={citation.documentName}
          pageNumber={citation.pageNumber}
          onClose={() => setCitation(null)}
        />
      )}
    </div>
  );
}
