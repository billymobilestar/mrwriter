"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import FountainEditor, {
  type FountainEditorHandle,
} from "@/components/FountainEditor";
import RedditImportModal from "@/components/RedditImportModal";
import AiPanel from "@/components/AiPanel";
import { useAuth } from "@/lib/auth-context";
import { getScript, updateScript } from "@/lib/db";

function EditorInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const id = params.id as string;
  const openReddit = searchParams.get("reddit") === "true";

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const [title, setTitle] = useState("Untitled Screenplay");
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showRedditModal, setShowRedditModal] = useState(openReddit);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [saved, setSaved] = useState(true);
  const [hasSelection, setHasSelection] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const editorRef = useRef<FountainEditorHandle>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load script from database
  useEffect(() => {
    if (!user) return;
    getScript(id).then((script) => {
      if (script) {
        setTitle(script.title);
        setContent(script.content);
      }
      setLoaded(true);
    });
  }, [id, user]);

  // Save to database with debounce
  const saveScript = useCallback(
    (newContent: string, newTitle?: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaved(false);
      saveTimeoutRef.current = setTimeout(async () => {
        const updates: { title?: string; content?: string } = { content: newContent };
        if (newTitle) updates.title = newTitle;
        await updateScript(id, updates);
        setSaved(true);
      }, 800);
    },
    [id]
  );

  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      const m = newContent.match(/^Title:\s*(.+)$/m);
      if (m) {
        setTitle(m[1].trim());
        saveScript(newContent, m[1].trim());
      } else {
        saveScript(newContent);
      }
    },
    [saveScript]
  );

  const handleSelectionChange = useCallback((hasSel: boolean, selText: string) => {
    setHasSelection(hasSel);
    setSelectedText(selText);
  }, []);

  const handleRedditImport = useCallback(
    (fountain: string) => {
      setContent(fountain);
      editorRef.current?.setContent(fountain);
      const m = fountain.match(/^Title:\s*(.+)$/m);
      if (m) {
        setTitle(m[1].trim());
        saveScript(fountain, m[1].trim());
      } else {
        saveScript(fountain);
      }
      setShowRedditModal(false);
    },
    [saveScript]
  );

  const handleExportFountain = useCallback(() => {
    const blob = new Blob([content], { type: "text/plain" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.fountain`;
    a.click();
    URL.revokeObjectURL(u);
  }, [content, title]);

  if (authLoading || !user) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg-deep)" }}>
        <div className="w-5 h-5 rounded-full animate-spin" style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg-deep)" }}>
      {/* ── Top Bar ── */}
      <header
        className="shrink-0 flex items-center justify-between px-4 h-14"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        {/* Left */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="w-px h-5" style={{ background: "var(--border)" }} />

          <div className="flex items-center gap-2 ml-1">
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); saveScript(content, e.target.value); }}
              className="text-sm font-medium bg-transparent border-none outline-none w-60"
              style={{ color: "var(--text)" }}
              placeholder="Untitled"
            />
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{
                background: saved ? "var(--green-soft)" : "var(--orange-soft)",
                color: saved ? "var(--green)" : "var(--orange)",
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: saved ? "var(--green)" : "var(--orange)" }}
              />
              {saved ? "Saved" : "Saving"}
            </div>
          </div>
        </div>

        {/* Center — stats */}
        <div
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
        >
          {content ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 mr-1" style={{ color: "var(--text-secondary)" }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs font-medium tabular-nums" style={{ color: "var(--text)" }}>
                {Math.max(1, Math.ceil(content.split('\n').length / 55))}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>pg</span>
              <div className="w-px h-3.5 mx-1.5" style={{ background: "var(--border-strong)" }} />
              <span className="text-xs font-medium tabular-nums" style={{ color: "var(--text)" }}>
                {content.trim().split(/\s+/).filter(Boolean).length.toLocaleString()}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>words</span>
              <div className="w-px h-3.5 mx-1.5" style={{ background: "var(--border-strong)" }} />
              <span className="text-xs font-medium tabular-nums" style={{ color: "var(--text)" }}>
                {content.split('\n').length}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>lines</span>
            </>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Empty</span>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAiPanel(!showAiPanel)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all"
            style={{
              background: showAiPanel ? "var(--accent)" : "var(--accent-soft)",
              color: showAiPanel ? "white" : "var(--accent)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
            AI
          </button>

          <button
            onClick={() => setShowRedditModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all"
            style={{ background: "var(--orange-soft)", color: "var(--orange)" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,138,61,0.2)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "var(--orange-soft)"}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.768 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
            </svg>
            Reddit
          </button>

          <div className="w-px h-5 mx-0.5" style={{ background: "var(--border)" }} />

          <button
            onClick={handleExportFountain}
            disabled={!content}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all disabled:opacity-30"
            style={{ background: "var(--surface-raised)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => { if (content) e.currentTarget.style.background = "var(--surface-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-raised)"; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export
          </button>
        </div>
      </header>

      {/* ── Editor + AI ── */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden flex justify-center p-4">
          {loaded ? (
            <FountainEditor
              ref={editorRef}
              initialContent={content}
              onChange={handleContentChange}
              onSelectionChange={handleSelectionChange}
            />
          ) : (
            <div className="screenplay-page flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
              Loading...
            </div>
          )}
        </div>

        {showAiPanel && (
          <AiPanel
            isOpen={showAiPanel}
            onClose={() => setShowAiPanel(false)}
            selectedText={selectedText}
            fullScript={content}
            hasSelection={hasSelection}
            onReplaceSelection={(t) => editorRef.current?.replaceSelection(t)}
            onReplaceAll={(t) => editorRef.current?.setContent(t)}
          />
        )}
      </div>

      <RedditImportModal
        isOpen={showRedditModal}
        onClose={() => setShowRedditModal(false)}
        onImport={handleRedditImport}
      />
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg-deep)", color: "var(--text-muted)" }}>
          Loading editor...
        </div>
      }
    >
      <EditorInner />
    </Suspense>
  );
}
