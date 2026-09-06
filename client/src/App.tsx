import { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import DocumentsPanel from "./components/DocumentsPanel";
import ChatPanel from "./components/ChatPanel";
import type { DocumentRecord } from "./types";
import { fetchDocuments, deleteDocument, loadDemoDocuments } from "./api";

const POLL_INTERVAL_MS = 1500;

export default function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"documents" | "chat">("documents");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { documents } = await fetchDocuments();
      setDocuments(documents);
    } catch {
      /* transient network errors are retried on the next poll/refresh */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while any document is still processing, so status/page counts
  // update automatically without the user refreshing the page.
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "processing");
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    }
    if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [documents, refresh]);

  async function handleDelete(id: string) {
    const previous = documents;
    setDocuments((docs) => docs.filter((d) => d.id !== id));
    try {
      await deleteDocument(id);
    } catch {
      setDocuments(previous);
    }
  }

  async function handleLoadDemo() {
    setDemoLoading(true);
    try {
      await loadDemoDocuments();
      await refresh();
    } finally {
      setDemoLoading(false);
    }
  }

  const hasReadyDocuments = documents.some((d) => d.status === "ready");

  return (
    <div className="flex h-svh flex-col bg-slate-50">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="min-h-0 flex-1 lg:flex">
        <aside
          className={`min-h-0 border-slate-200 bg-slate-50 lg:block lg:w-96 lg:border-r ${
            activeTab === "documents" ? "block h-full" : "hidden"
          }`}
        >
          <DocumentsPanel
            documents={documents}
            loading={loading}
            onRefresh={refresh}
            onDelete={handleDelete}
            onLoadDemo={handleLoadDemo}
            demoLoading={demoLoading}
          />
        </aside>
        <section
          className={`min-h-0 flex-1 bg-slate-50 lg:block ${activeTab === "chat" ? "block h-full" : "hidden"}`}
        >
          <ChatPanel hasReadyDocuments={hasReadyDocuments} documents={documents} />
        </section>
      </main>
    </div>
  );
}
