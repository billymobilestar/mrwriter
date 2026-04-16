"use client";

import { useState, useCallback } from "react";

interface AiPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  fullScript: string;
  hasSelection: boolean;
  onReplaceSelection: (text: string) => void;
  onReplaceAll: (text: string) => void;
}

type Action = "rewrite" | "polish" | "analyze" | "characters" | "pacing" | "custom";

const ACTIONS: { key: Action; label: string; description: string; isRewrite: boolean }[] = [
  { key: "analyze", label: "Analyze", description: "Consultant notes", isRewrite: false },
  { key: "polish", label: "Polish", description: "Light touch-up", isRewrite: true },
  { key: "rewrite", label: "Rewrite", description: "Full rewrite", isRewrite: true },
  { key: "characters", label: "Voices", description: "Character analysis", isRewrite: false },
  { key: "pacing", label: "Pacing", description: "Rhythm & flow", isRewrite: false },
];

export default function AiPanel({
  isOpen,
  onClose,
  selectedText,
  fullScript,
  hasSelection,
  onReplaceSelection,
  onReplaceAll,
}: AiPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [useSelection, setUseSelection] = useState(true);

  const textToAnalyze = useSelection && hasSelection ? selectedText : fullScript;

  const handleAction = useCallback(
    async (action: Action) => {
      if (!textToAnalyze.trim()) { setError("No text to analyze."); return; }
      if (action === "custom" && !customPrompt.trim()) { setError("Enter a prompt."); return; }
      setLoading(true); setError(""); setResult(""); setActiveAction(action);
      try {
        const res = await fetch("/api/ai/script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToAnalyze, action, customPrompt: action === "custom" ? customPrompt : undefined }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Failed"); return; }
        setResult(data.result);
      } catch { setError("Connection failed."); } finally { setLoading(false); }
    },
    [textToAnalyze, customPrompt]
  );

  const isRewrite = activeAction ? ACTIONS.find((a) => a.key === activeAction)?.isRewrite : false;

  const handleApply = useCallback(() => {
    if (!result) return;
    if (useSelection && hasSelection) onReplaceSelection(result);
    else onReplaceAll(result);
    setResult(""); setActiveAction(null);
  }, [result, useSelection, hasSelection, onReplaceSelection, onReplaceAll]);

  if (!isOpen) return null;

  return (
    <div
      className="w-[340px] shrink-0 flex flex-col h-full overflow-hidden"
      style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" style={{ color: "var(--accent)" }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>AI</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Scope */}
      <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "var(--bg)" }}>
          <button
            onClick={() => setUseSelection(true)}
            disabled={!hasSelection}
            className="flex-1 text-[11px] py-1.5 rounded-md font-medium transition-all disabled:opacity-30"
            style={
              useSelection && hasSelection
                ? { background: "var(--accent)", color: "white" }
                : { color: "var(--text-muted)" }
            }
          >
            Selection{hasSelection ? ` (${selectedText.split("\n").length}L)` : ""}
          </button>
          <button
            onClick={() => setUseSelection(false)}
            className="flex-1 text-[11px] py-1.5 rounded-md font-medium transition-all"
            style={
              !useSelection || !hasSelection
                ? { background: "var(--accent)", color: "white" }
                : { color: "var(--text-muted)" }
            }
          >
            Full Script
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="grid grid-cols-3 gap-1.5">
          {ACTIONS.map(({ key, label, description }) => (
            <button
              key={key}
              onClick={() => handleAction(key)}
              disabled={loading}
              className="flex flex-col items-center gap-0.5 p-2.5 rounded-xl text-center transition-all border disabled:opacity-30"
              style={
                loading && activeAction === key
                  ? { background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--accent)" }
                  : { background: "var(--bg)", borderColor: "var(--border)", color: "var(--text-secondary)" }
              }
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text)"; } }}
              onMouseLeave={(e) => { if (!(loading && activeAction === key)) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; } }}
            >
              <span className="text-[11px] font-semibold">{label}</span>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{description}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-1.5">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAction("custom")}
            placeholder="Ask anything..."
            className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
            onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
          />
          <button
            onClick={() => handleAction("custom")}
            disabled={loading || !customPrompt.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-30"
            style={{ background: "var(--accent)" }}
          >
            Ask
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="px-4 py-8 flex flex-col items-center gap-3">
          <div className="w-5 h-5 rounded-full animate-spin" style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {activeAction === "rewrite" || activeAction === "polish" ? "Rewriting" : "Analyzing"}...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3">
          <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--red)" }}>
            {error}
          </div>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex gap-1.5 mb-3">
            {isRewrite && (
              <button
                onClick={handleApply}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
                style={{ background: "var(--green)" }}
              >
                Apply to {useSelection && hasSelection ? "selection" : "script"}
              </button>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(result)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: "var(--surface-raised)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              Copy
            </button>
          </div>
          <div
            className="text-xs leading-relaxed whitespace-pre-wrap font-mono p-4 rounded-xl"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            {result}
          </div>
        </div>
      )}
    </div>
  );
}
