import { useMemo, useState } from "react";
import type { DocumentRecord } from "../types";
import DocumentRow from "./DocumentRow";
import UploadButton from "./UploadButton";
import EmptyState from "./EmptyState";

interface Props {
  documents: DocumentRecord[];
  loading: boolean;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onLoadDemo: () => void;
  demoLoading: boolean;
}

export default function DocumentsPanel({
  documents,
  loading,
  onRefresh,
  onDelete,
  onLoadDemo,
  demoLoading,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.trim().toLowerCase();
    return documents.filter((d) => d.original_name.toLowerCase().includes(q));
  }, [documents, search]);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Documents</h2>
        <p className="text-xs text-slate-500">Upload PDFs to ask questions about them.</p>
      </div>

      <UploadButton onUploaded={onRefresh} />

      {documents.length > 0 && (
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading documents…</p>
        ) : documents.length === 0 ? (
          <EmptyState
            title="No documents yet"
            description="Upload a PDF above, or load a few sample documents to try the app right away."
            actionLabel={demoLoading ? "Loading sample documents…" : "Load sample documents"}
            onAction={demoLoading ? undefined : onLoadDemo}
          />
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No documents match "{search}".</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((doc) => (
              <DocumentRow key={doc.id} document={doc} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
