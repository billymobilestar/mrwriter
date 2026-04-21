"use client";

import { useState, useCallback } from "react";

interface Metadata {
  url: string;
  title: string;
  subreddit: string;
  author: string;
  score: number;
  num_comments: number;
  thumbnail_url: string | null;
}

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (link: {
    url: string;
    title: string;
    subreddit: string;
    author: string;
    score: number;
    num_comments: number;
    thumbnail_url: string | null;
    notes: string | null;
  }) => Promise<void>;
}

export default function AddLinkModal({ isOpen, onClose, onSaved }: AddLinkModalProps) {
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [notes, setNotes] = useState("");
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setUrl("");
    setMetadata(null);
    setNotes("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFetch = useCallback(async () => {
    if (!url.trim()) return;
    setFetching(true);
    setError("");
    setMetadata(null);

    try {
      const res = await fetch("/api/reddit/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to fetch");
        return;
      }
      setMetadata(data.metadata);
    } catch {
      setError("Failed to fetch thread info.");
    } finally {
      setFetching(false);
    }
  }, [url]);

  const handleSave = useCallback(async () => {
    if (!metadata) return;
    setSaving(true);
    try {
      await onSaved({
        url: metadata.url,
        title: metadata.title,
        subreddit: metadata.subreddit,
        author: metadata.author,
        score: metadata.score,
        num_comments: metadata.num_comments,
        thumbnail_url: metadata.thumbnail_url,
        notes: notes.trim() || null,
      });
      reset();
      onClose();
    } catch {
      setError("Failed to save link.");
    } finally {
      setSaving(false);
    }
  }, [metadata, notes, onSaved, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--orange-soft)" }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" style={{ color: "var(--orange)" }}>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.768 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Save Reddit Link</h3>
          </div>
          <button
            onClick={handleClose}
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

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* URL input */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Reddit URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="https://reddit.com/r/.../comments/..."
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
              />
              <button
                onClick={handleFetch}
                disabled={fetching || !url.trim()}
                className="px-3 py-2 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-30"
                style={{ background: "var(--accent)" }}
              >
                {fetching ? "..." : "Fetch"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="px-3 py-2 rounded-lg text-xs"
              style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--red)" }}
            >
              {error}
            </div>
          )}

          {/* Preview card */}
          {metadata && (
            <div
              className="p-3 rounded-xl"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start gap-3">
                {metadata.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={metadata.thumbnail_url}
                    alt=""
                    className="w-16 h-16 rounded-md object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold line-clamp-2" style={{ color: "var(--text)" }}>
                    {metadata.title}
                  </h4>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    r/{metadata.subreddit} · u/{metadata.author} · {metadata.score.toLocaleString()} pts · {metadata.num_comments.toLocaleString()} comments
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {metadata && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Notes <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What's interesting about this thread?"
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!metadata || saving}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-all disabled:opacity-30"
            style={{ background: "var(--accent)" }}
          >
            {saving ? "Saving..." : "Save Link"}
          </button>
        </div>
      </div>
    </div>
  );
}
