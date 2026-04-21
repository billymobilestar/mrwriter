"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getRedditLinks,
  createRedditLink,
  deleteRedditLink,
  updateRedditLink,
  createScript,
  type RedditLink,
} from "@/lib/db";
import AddLinkModal from "@/components/AddLinkModal";
import {
  exportLinksToExcel,
  exportLinksToWord,
  exportLinksToCsv,
} from "@/lib/export-links";

export default function LibraryPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [links, setLinks] = useState<RedditLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    setLoadingLinks(true);
    getRedditLinks().then((data) => {
      setLinks(data);
      setLoadingLinks(false);
    });
  }, [user]);

  const handleAdd = useCallback(
    async (linkData: {
      url: string;
      title: string;
      subreddit: string;
      author: string;
      score: number;
      num_comments: number;
      thumbnail_url: string | null;
      notes: string | null;
    }) => {
      if (!user) return;
      const created = await createRedditLink(user.id, linkData);
      if (created) setLinks((prev) => [created, ...prev]);
    },
    [user]
  );

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Delete this link?")) return;
      const ok = await deleteRedditLink(id);
      if (ok) setLinks((prev) => prev.filter((l) => l.id !== id));
    },
    []
  );

  const handleStartEdit = useCallback((link: RedditLink, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(link.id);
    setEditNotes(link.notes || "");
  }, []);

  const handleSaveEdit = useCallback(
    async (id: string) => {
      const ok = await updateRedditLink(id, { notes: editNotes.trim() || null });
      if (ok) {
        setLinks((prev) =>
          prev.map((l) => (l.id === id ? { ...l, notes: editNotes.trim() || null } : l))
        );
      }
      setEditingId(null);
      setEditNotes("");
    },
    [editNotes]
  );

  const handleImportToScript = useCallback(
    async (link: RedditLink, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!user) return;
      const script = await createScript(user.id, link.title);
      if (script) {
        router.push(`/editor/${script.id}?reddit=true&url=${encodeURIComponent(link.url)}`);
      }
    },
    [user, router]
  );

  const handleOpenLink = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const filtered = searchQuery.trim()
    ? links.filter((l) => {
        const q = searchQuery.toLowerCase();
        return (
          l.title.toLowerCase().includes(q) ||
          (l.subreddit && l.subreddit.toLowerCase().includes(q)) ||
          (l.notes && l.notes.toLowerCase().includes(q))
        );
      })
    : links;

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-deep)" }}>
        <div className="w-5 h-5 rounded-full animate-spin" style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-deep)" }}>
      {/* Header */}
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push("/")}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
              title="Back to Scripts"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--orange-soft)" }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" style={{ color: "var(--orange)" }}>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.768 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Reddit Library</h1>
              <p className="text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>
                {links.length} saved thread{links.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={links.length === 0}
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-[13px] font-medium transition-all disabled:opacity-30"
                style={{
                  background: "var(--surface-raised)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
                onMouseEnter={(e) => { if (links.length > 0) e.currentTarget.style.background = "var(--surface-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-raised)"; }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span className="hidden sm:inline">Export</span>
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div
                    className="absolute right-0 top-full mt-1 py-1 rounded-xl shadow-2xl z-50 min-w-[180px]"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-strong)" }}
                  >
                    <button
                      onClick={() => { setShowExportMenu(false); exportLinksToExcel(links); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-left transition-colors"
                      style={{ color: "var(--text)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(34,197,94,0.12)" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" style={{ color: "#22c55e" }}>
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M9 9l6 6M15 9l-6 6" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">Excel (.xlsx)</div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Spreadsheet with all fields</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setShowExportMenu(false); exportLinksToWord(links); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-left transition-colors"
                      style={{ color: "var(--text)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(37,99,235,0.12)" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" style={{ color: "#2563eb" }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6M10 12h4M10 16h4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">Word (.docx)</div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Formatted document with links</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setShowExportMenu(false); exportLinksToCsv(links); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-left transition-colors"
                      style={{ color: "var(--text)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--surface-raised)" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" style={{ color: "var(--text-secondary)" }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">CSV</div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Plain text spreadsheet</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ background: "var(--accent)" }}
              title="Add Link"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">Add Link</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {/* Search */}
        {links.length > 0 && (
          <div className="mb-6">
            <div className="relative max-w-md">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "var(--text-muted)" }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search links..."
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
              />
            </div>
          </div>
        )}

        {loadingLinks ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 rounded-full animate-spin" style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((link) => (
              <div
                key={link.id}
                onClick={() => handleOpenLink(link.url)}
                className="group relative p-4 rounded-2xl border cursor-pointer transition-all"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--orange-soft)" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" style={{ color: "var(--orange)" }}>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.768 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold line-clamp-2 pr-6" style={{ color: "var(--text)" }}>
                      {link.title}
                    </h3>
                    {link.subreddit && (
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        r/{link.subreddit}
                        {link.author ? ` · u/${link.author}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* Delete button (top-right) */}
                <button
                  onClick={(e) => handleDelete(link.id, e)}
                  className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.12)"; e.currentTarget.style.color = "var(--red)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>

                {/* Stats */}
                <div className="flex items-center gap-3 text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l8-8h0a3.13 3.13 0 0 1 3 3.88Z" />
                    </svg>
                    {link.score.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {link.num_comments.toLocaleString()}
                  </span>
                </div>

                {/* Notes */}
                {editingId === link.id ? (
                  <div onClick={(e) => e.stopPropagation()} className="mb-2">
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Add notes..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none"
                      style={{
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                      autoFocus
                    />
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => handleSaveEdit(link.id)}
                        className="px-2.5 py-1 text-[11px] font-medium text-white rounded-md"
                        style={{ background: "var(--accent)" }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditNotes(""); }}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-md"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : link.notes ? (
                  <p className="text-[11px] mb-2 line-clamp-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {link.notes}
                  </p>
                ) : null}

                {/* Actions (bottom) */}
                <div className="flex items-center gap-1 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <button
                    onClick={(e) => handleImportToScript(link, e)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-all"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                    title="Create screenplay from this thread"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                    Script
                  </button>
                  <button
                    onClick={(e) => handleStartEdit(link, e)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-all"
                    style={{ background: "var(--surface-raised)", color: "var(--text-secondary)" }}
                    title="Edit notes"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                    Notes
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : searchQuery ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No links matching &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" style={{ color: "var(--text-muted)" }}>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.768 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
              </svg>
            </div>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>No links saved yet</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Paste a Reddit URL to start building your library.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-5 px-4 py-2 text-sm font-medium text-white rounded-xl transition-all hover:brightness-110"
              style={{ background: "var(--accent)" }}
            >
              Add Your First Link
            </button>
          </div>
        )}
      </main>

      <AddLinkModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={handleAdd}
      />
    </div>
  );
}
