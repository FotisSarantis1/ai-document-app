import { useEffect, useState } from "react";
import Modal from "./Modal";
import { fetchPage, fileUrl } from "../api";

interface Props {
  documentId: string;
  documentName: string;
  pageNumber: number;
  onClose: () => void;
}

export default function PdfViewerModal({ documentId, documentName, pageNumber, onClose }: Props) {
  const [pageText, setPageText] = useState<string | null>(null);

  useEffect(() => {
    fetchPage(documentId, pageNumber)
      .then((res) => setPageText(res.page.text))
      .catch(() => setPageText(null));
  }, [documentId, pageNumber]);

  const src = `${fileUrl(documentId)}#page=${pageNumber}`;

  return (
    <Modal title={`${documentName} - Page ${pageNumber}`} onClose={onClose} wide>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="h-[60vh] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <iframe title="PDF preview" src={src} className="h-full w-full" />
        </div>
        <div className="md:w-64 md:shrink-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Extracted text (page {pageNumber})
          </h3>
          <p className="mt-2 max-h-[55vh] overflow-y-auto whitespace-pre-wrap text-sm text-slate-600">
            {pageText ?? "Loading…"}
          </p>
        </div>
      </div>
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block text-sm font-medium text-slate-900 underline underline-offset-2"
      >
        Open full document in a new tab
      </a>
    </Modal>
  );
}
