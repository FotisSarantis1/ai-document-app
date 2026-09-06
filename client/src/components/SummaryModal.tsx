import { useEffect, useState } from "react";
import Modal from "./Modal";
import { summarizeDocument } from "../api";

interface Props {
  documentId: string;
  documentName: string;
  onClose: () => void;
}

export default function SummaryModal({ documentId, documentName, onClose }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    summarizeDocument(documentId)
      .then((res) => {
        if (!cancelled) setSummary(res.summary);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to generate summary.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  return (
    <Modal title={`Summary - ${documentName}`} onClose={onClose} wide>
      {loading && (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          Generating summary…
        </div>
      )}
      {error && <p className="py-4 text-sm text-red-600">{error}</p>}
      {summary && (
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {summary}
        </div>
      )}
    </Modal>
  );
}
