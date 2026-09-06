import { useRef, useState } from "react";
import { uploadDocumentsWithProgress } from "../api";

const MAX_FILE_SIZE_MB = 20;

interface UploadTask {
  id: string;
  name: string;
  progress: number;
  state: "uploading" | "done" | "error";
  error?: string;
}

interface Props {
  onUploaded: () => void;
}

export default function UploadButton({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function validateFiles(files: File[]): { valid: File[]; rejected: { name: string; reason: string }[] } {
    const valid: File[] = [];
    const rejected: { name: string; reason: string }[] = [];
    for (const file of files) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        rejected.push({ name: file.name, reason: "Only PDF files are supported." });
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        rejected.push({ name: file.name, reason: `Exceeds the ${MAX_FILE_SIZE_MB}MB limit.` });
        continue;
      }
      valid.push(file);
    }
    return { valid, rejected };
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const { valid, rejected } = validateFiles(files);

    const rejectedTasks: UploadTask[] = rejected.map((r) => ({
      id: `${r.name}-${Math.random()}`,
      name: r.name,
      progress: 0,
      state: "error",
      error: r.reason,
    }));

    if (valid.length === 0) {
      setTasks((prev) => [...prev, ...rejectedTasks]);
      return;
    }

    const taskId = `batch-${Date.now()}`;
    const batchLabel = valid.length === 1 ? valid[0].name : `${valid.length} files`;
    setTasks((prev) => [
      ...prev,
      ...rejectedTasks,
      { id: taskId, name: batchLabel, progress: 0, state: "uploading" },
    ]);

    try {
      const { results } = await uploadDocumentsWithProgress(valid, (percent) => {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, progress: percent } : t)));
      });

      const failed = results.filter((r) => r.error);
      if (failed.length > 0 && failed.length === results.length) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, state: "error", error: failed[0].error } : t
          )
        );
      } else {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, state: "done", progress: 100 } : t)));
        onUploaded();
      }
    } catch (err: any) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, state: "error", error: err.message } : t))
      );
    }
  }

  function dismissTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex items-center justify-between gap-3 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition-colors ${
          dragOver ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
        }`}
      >
        <span className="text-slate-500">Drag PDFs here, or</span>
        <button
          onClick={() => inputRef.current?.click()}
          className="shrink-0 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Upload PDFs
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {tasks.length > 0 && (
        <ul className="mt-3 space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">{task.name}</p>
                {task.state === "uploading" && (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-900 transition-all"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                )}
                {task.state === "error" && <p className="mt-0.5 text-xs text-red-600">{task.error}</p>}
                {task.state === "done" && <p className="mt-0.5 text-xs text-emerald-600">Uploaded - processing…</p>}
              </div>
              {task.state !== "uploading" && (
                <button
                  onClick={() => dismissTask(task.id)}
                  className="shrink-0 text-slate-400 hover:text-slate-600"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
