import type { DocumentStatus } from "../types";

const STYLES: Record<DocumentStatus, string> = {
  processing: "bg-amber-50 text-amber-700 ring-amber-600/20",
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  error: "bg-red-50 text-red-700 ring-red-600/20",
};

const LABELS: Record<DocumentStatus, string> = {
  processing: "Processing",
  ready: "Ready",
  error: "Error",
};

export default function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {status === "processing" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
      )}
      {LABELS[status]}
    </span>
  );
}
