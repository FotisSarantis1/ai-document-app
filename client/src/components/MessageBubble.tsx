import type { ChatMessage } from "../types";

interface Props {
  message: ChatMessage;
  onOpenCitation: (documentId: string, documentName: string, pageNumber: number) => void;
}

export default function MessageBubble({ message, onOpenCitation }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isUser ? "bg-slate-900 text-white" : "bg-white text-slate-800 ring-1 ring-slate-200"
      }`}>
        <p className="whitespace-pre-wrap">{message.content}</p>

        {message.citations.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
            {message.citations.map((c, i) => (
              <button
                key={`${c.documentId}-${c.pageNumber}-${i}`}
                onClick={() => onOpenCitation(c.documentId, c.documentName, c.pageNumber)}
                title={c.snippet}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Source: {c.documentName} — Page {c.pageNumber}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
