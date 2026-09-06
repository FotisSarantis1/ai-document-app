import { useState } from "react";
import type { DocumentRecord } from "../types";
import StatusBadge from "./StatusBadge";
import { formatDate, formatFileSize } from "../lib/format";
import SummaryModal from "./SummaryModal";

interface Props {
  document: DocumentRecord;
  onDelete: (id: string) => void;
}

export default function DocumentRow({ document, onDelete }: Props) {
  const [showSummary, setShowSummary] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <li className="group rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-slate-900" title={document.original_name}>
              {document.original_name}
            </p>
            {document.is_demo && (
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Demo
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDate(document.uploaded_at)} · {formatFileSize(document.file_size)}
            {document.status === "ready" && <> · {document.page_count} page{document.page_count === 1 ? "" : "s"}</>}
          </p>
          {document.status === "error" && document.error_message && (
            <p className="mt-1 text-xs text-red-600">{document.error_message}</p>
          )}
        </div>
        <StatusBadge status={document.status} />
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs">
        <button
          disabled={document.status !== "ready"}
          onClick={() => setShowSummary(true)}
          className="font-medium text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          Summarize
        </button>
        {confirmingDelete ? (
          <span className="flex items-center gap-2">
            <span className="text-slate-500">Delete this document?</span>
            <button
              onClick={() => onDelete(document.id)}
              className="font-medium text-red-600 hover:text-red-700"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="font-medium text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="font-medium text-slate-400 hover:text-red-600"
          >
            Delete
          </button>
        )}
      </div>

      {showSummary && (
        <SummaryModal
          documentId={document.id}
          documentName={document.original_name}
          onClose={() => setShowSummary(false)}
        />
      )}
    </li>
  );
}
