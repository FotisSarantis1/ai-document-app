interface Props {
  activeTab: "documents" | "chat";
  onTabChange: (tab: "documents" | "chat") => void;
}

export default function Header({ activeTab, onTabChange }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
          D
        </div>
        <span className="text-sm font-semibold text-slate-900">DocuMind</span>
      </div>

      <nav className="flex rounded-lg bg-slate-100 p-1 text-sm lg:hidden">
        <button
          onClick={() => onTabChange("documents")}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            activeTab === "documents" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Documents
        </button>
        <button
          onClick={() => onTabChange("chat")}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            activeTab === "chat" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Chat
        </button>
      </nav>
    </header>
  );
}
