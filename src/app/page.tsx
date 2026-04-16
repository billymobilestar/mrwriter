"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getScripts, createScript, deleteScript as dbDeleteScript, type Script } from "@/lib/db";

export default function Home() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Load scripts from database
  useEffect(() => {
    if (!user) return;
    setLoadingScripts(true);
    getScripts().then((data) => {
      setScripts(data);
      setLoadingScripts(false);
    });
  }, [user]);

  const handleCreateScript = useCallback(async () => {
    if (!user) return;
    const script = await createScript(user.id);
    if (script) {
      router.push(`/editor/${script.id}`);
    }
  }, [user, router]);

  const handleCreateFromReddit = useCallback(async () => {
    if (!user) return;
    const script = await createScript(user.id, "Reddit Import");
    if (script) {
      router.push(`/editor/${script.id}?reddit=true`);
    }
  }, [user, router]);

  const handleDeleteScript = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Delete this script?")) return;
      const success = await dbDeleteScript(id);
      if (success) {
        setScripts((prev) => prev.filter((s) => s.id !== id));
      }
    },
    []
  );

  const openScript = useCallback(
    (id: string) => {
      router.push(`/editor/${id}`);
    },
    [router]
  );

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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--accent-soft)" }}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" style={{ stroke: "var(--accent)" }}>
                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold" style={{ color: "var(--text)" }}>MrWriter</h1>
              <p className="text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>Screenwriting software</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={handleCreateScript}
              className="flex items-center justify-center gap-2 w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ background: "var(--accent)" }}
              title="New Script"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">New Script</span>
            </button>

            <div className="hidden sm:block w-px h-6" style={{ background: "var(--border)" }} />

            {/* User menu */}
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm sm:text-xs font-bold uppercase shrink-0"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {user.email?.charAt(0) || "U"}
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-medium truncate max-w-[140px]" style={{ color: "var(--text)" }}>
                  {user.email}
                </p>
              </div>
              <button
                onClick={signOut}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; e.currentTarget.style.color = "var(--red)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
                title="Sign out"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        {/* Create section */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: "var(--text-muted)" }}>
          Create
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-14">
          <button
            onClick={handleCreateScript}
            className="group flex items-center gap-4 p-5 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--surface-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--accent-soft)" }}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" style={{ stroke: "var(--accent)" }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6M12 18v-6M9 15h6" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-semibold text-[14px]" style={{ color: "var(--text)" }}>Blank Script</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Start from an empty page</p>
            </div>
          </button>

          <button
            onClick={handleCreateFromReddit}
            className="group flex items-center gap-4 p-5 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--orange)"; e.currentTarget.style.background = "var(--surface-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--orange-soft)" }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" style={{ color: "var(--orange)" }}>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.768 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0zm6.29 14.108c0 3.173-3.672 5.753-8.193 5.753s-8.193-2.58-8.193-5.753c0-1.252.87-2.356 2.21-3.138-.14-.39-.214-.804-.214-1.234 0-1.953 1.59-3.538 3.548-3.538.89 0 1.703.327 2.33.866A12.11 12.11 0 0112 11.003c.751 0 1.487.07 2.198.204.627-.546 1.445-.876 2.34-.876 1.958 0 3.548 1.585 3.548 3.538 0 .428-.073.84-.212 1.228 1.347.782 2.223 1.89 2.223 3.146-.1-.035-.107-.1-.107-.135z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-semibold text-[14px]" style={{ color: "var(--text)" }}>Reddit Import</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Turn a thread into a screenplay</p>
            </div>
          </button>
        </div>

        {/* Scripts */}
        {loadingScripts ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 rounded-full animate-spin" style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
          </div>
        ) : scripts.length > 0 ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: "var(--text-muted)" }}>
              Recent Scripts
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {scripts.map((script) => (
                <div
                  key={script.id}
                  onClick={() => openScript(script.id)}
                  className="group relative p-5 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  <button
                    onClick={(e) => handleDeleteScript(script.id, e)}
                    className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.12)"; e.currentTarget.style.color = "var(--red)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: "var(--accent-soft)" }}>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" style={{ stroke: "var(--accent)" }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-sm pr-8" style={{ color: "var(--text)" }}>
                    {script.title}
                  </h3>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {new Date(script.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  {script.content && (
                    <p className="text-[11px] mt-3 line-clamp-2 font-mono leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {script.content.slice(0, 120)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7" style={{ stroke: "var(--text-muted)" }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No scripts yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Create a blank script or import from Reddit.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
