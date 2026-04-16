"use client";

import { useState, useCallback, useMemo } from "react";
import type { RedditThread, RedditComment } from "@/lib/reddit-parser";
import { generateFaithfulFountain } from "@/lib/fountain-generator";

interface RedditImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (fountain: string) => void;
}

interface CommentNodeProps {
  comment: RedditComment;
  selected: Set<string>;
  onToggle: (id: string) => void;
  depth?: number;
  searchQuery: string;
  searchMode: "all" | "username" | "content";
  visibleIds: Set<string> | null;
}

function matchesSearch(
  comment: RedditComment,
  query: string,
  mode: "all" | "username" | "content"
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (mode === "username") return comment.author.toLowerCase().includes(q);
  if (mode === "content") return comment.body.toLowerCase().includes(q);
  return (
    comment.author.toLowerCase().includes(q) ||
    comment.body.toLowerCase().includes(q)
  );
}

function collectVisibleIds(
  comments: RedditComment[],
  query: string,
  mode: "all" | "username" | "content"
): Set<string> {
  const ids = new Set<string>();
  function walk(comment: RedditComment): boolean {
    if (comment.is_deleted) return false;
    const selfMatch = matchesSearch(comment, query, mode);
    let childMatch = false;
    for (const reply of comment.replies) {
      if (walk(reply)) childMatch = true;
    }
    if (selfMatch || childMatch) {
      ids.add(comment.id);
      return true;
    }
    return false;
  }
  for (const c of comments) walk(c);
  return ids;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function countReplies(comment: RedditComment): number {
  let count = 0;
  for (const r of comment.replies) {
    count += 1 + countReplies(r);
  }
  return count;
}

function CommentNode({
  comment,
  selected,
  onToggle,
  depth = 0,
  searchQuery,
  searchMode,
  visibleIds,
}: CommentNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasReplies = comment.replies.length > 0;
  const isSelected = selected.has(comment.id);
  const maxPreview = 120;
  const preview =
    comment.body.length > maxPreview
      ? comment.body.slice(0, maxPreview) + "..."
      : comment.body;

  if (comment.is_deleted) return null;
  if (visibleIds && !visibleIds.has(comment.id)) return null;

  const selfMatches =
    searchQuery && matchesSearch(comment, searchQuery, searchMode);
  const isDeletedUser =
    comment.author === "[deleted]" || comment.author === "[removed]";

  return (
    <div
      className={`${depth > 0 ? "ml-6 border-l-2 border-zinc-200 pl-3" : ""}`}
    >
      <div
        className={`flex items-start gap-2 py-2 group rounded-sm ${
          selfMatches ? "bg-yellow-50" : ""
        }`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(comment.id)}
          className="mt-1 h-4 w-4 rounded border-zinc-300 accent-blue-600 cursor-pointer"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {hasReplies && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-zinc-400 hover:text-zinc-600 text-xs font-mono"
              >
                {expanded ? "▼" : "▶"}
              </button>
            )}
            <span
              className={`font-medium text-sm ${isDeletedUser ? "text-red-400 italic" : "text-zinc-800"}`}
            >
              {searchQuery &&
              (searchMode === "all" || searchMode === "username")
                ? highlightText(comment.author, searchQuery)
                : comment.author}
            </span>
            {isDeletedUser && (
              <span className="text-xs bg-red-50 text-red-400 px-1.5 py-0.5 rounded">
                deleted user
              </span>
            )}
            <span className="text-xs text-zinc-400">
              {comment.score} pts
            </span>
            {depth === 0 && hasReplies && (
              <span className="text-xs text-zinc-300">
                {countReplies(comment)} replies
              </span>
            )}
          </div>
          <p
            className={`text-sm mt-0.5 leading-snug ${isDeletedUser ? "text-zinc-500 italic" : "text-zinc-600"}`}
          >
            {searchQuery && (searchMode === "all" || searchMode === "content")
              ? highlightText(preview, searchQuery)
              : preview}
          </p>
        </div>
      </div>
      {expanded &&
        hasReplies &&
        comment.replies.map((reply) => (
          <CommentNode
            key={reply.id}
            comment={reply}
            selected={selected}
            onToggle={onToggle}
            depth={depth + 1}
            searchQuery={searchQuery}
            searchMode={searchMode}
            visibleIds={visibleIds}
          />
        ))}
    </div>
  );
}

export default function RedditImportModal({
  isOpen,
  onClose,
  onImport,
}: RedditImportModalProps) {
  const [url, setUrl] = useState("");
  const [thread, setThread] = useState<RedditThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepLoadedIds, setDeepLoadedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"faithful" | "dramatized">("faithful");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<
    "all" | "username" | "content"
  >("all");

  const visibleIds = useMemo(() => {
    if (!thread || !searchQuery.trim()) return null;
    return collectVisibleIds(thread.comments, searchQuery.trim(), searchMode);
  }, [thread, searchQuery, searchMode]);

  const fetchThread = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setThread(null);
    setSearchQuery("");
    setDeepLoadedIds(new Set());

    try {
      const res = await fetch("/api/reddit/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to fetch thread");
        return;
      }

      setThread(data.thread);
      // Auto-select all initially loaded comments
      const ids = new Set<string>();
      for (const c of data.thread.comments) {
        selectAllComments(c, ids);
      }
      setSelected(ids);
    } catch {
      setError("Failed to fetch thread. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  // Deep-fetch selected top-level comment threads
  const handleDeepFetch = useCallback(async () => {
    if (!thread) return;

    // Find selected top-level comments that haven't been deep-loaded yet
    const toFetch = thread.comments.filter(
      (c) => selected.has(c.id) && !deepLoadedIds.has(c.id)
    );

    if (toFetch.length === 0) {
      setError("No new threads to load. Select top-level comments first.");
      return;
    }

    setDeepLoading(true);
    setError("");

    try {
      const commentIds = toFetch.map((c) =>
        c.id.startsWith("t1_") ? c.id.slice(3) : c.id
      );

      const res = await fetch("/api/reddit/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subreddit: thread.subreddit,
          postId: thread.postId,
          commentIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load full threads");
        return;
      }

      // Replace shallow comments with deep-fetched versions
      const deepMap = new Map<string, RedditComment>();
      for (const c of data.comments as RedditComment[]) {
        deepMap.set(c.id, c);
      }

      const updatedComments = thread.comments.map((c) => {
        const deep = deepMap.get(c.id);
        return deep || c;
      });

      setThread({ ...thread, comments: updatedComments });

      // Mark these as deep-loaded
      setDeepLoadedIds((prev) => {
        const next = new Set(prev);
        for (const c of toFetch) next.add(c.id);
        return next;
      });

      // Re-select to include newly fetched replies
      const ids = new Set<string>();
      for (const c of updatedComments) {
        if (selected.has(c.id)) {
          selectAllComments(c, ids);
        }
      }
      // Keep other selections too
      for (const id of selected) {
        ids.add(id);
      }
      setSelected(ids);
    } catch {
      setError("Failed to load full threads. Try again.");
    } finally {
      setDeepLoading(false);
    }
  }, [thread, selected, deepLoadedIds]);

  function selectAllComments(comment: RedditComment, ids: Set<string>) {
    if (!comment.is_deleted) ids.add(comment.id);
    for (const reply of comment.replies) {
      selectAllComments(reply, ids);
    }
  }

  function countAllComments(comments: RedditComment[]): number {
    let count = 0;
    for (const c of comments) {
      if (!c.is_deleted) count++;
      count += countAllComments(c.replies);
    }
    return count;
  }

  const handleSelectAll = useCallback(() => {
    if (!thread) return;
    const ids = new Set<string>();
    for (const c of thread.comments) {
      selectAllComments(c, ids);
    }
    setSelected(ids);
  }, [thread]);

  const handleDeselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleSelectVisible = useCallback(() => {
    if (!visibleIds) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  }, [visibleIds]);

  const handleDeselectVisible = useCallback(() => {
    if (!visibleIds) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) next.delete(id);
      return next;
    });
  }, [visibleIds]);

  const toggleComment = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          if (thread) {
            const comment = findComment(thread.comments, id);
            if (comment) deselectAllComments(comment, next);
          }
        } else {
          if (thread) {
            const comment = findComment(thread.comments, id);
            if (comment) selectAllComments(comment, next);
          }
        }
        return next;
      });
    },
    [thread]
  );

  function findComment(
    comments: RedditComment[],
    id: string
  ): RedditComment | null {
    for (const c of comments) {
      if (c.id === id) return c;
      const found = findComment(c.replies, id);
      if (found) return found;
    }
    return null;
  }

  function deselectAllComments(comment: RedditComment, ids: Set<string>) {
    ids.delete(comment.id);
    for (const reply of comment.replies) {
      deselectAllComments(reply, ids);
    }
  }

  const handleImport = useCallback(async () => {
    if (!thread) return;
    setImporting(true);

    try {
      const selectedComments = thread.comments.filter((c) =>
        hasSelectedDescendant(c, selected)
      );

      if (mode === "faithful") {
        const fountain = generateFaithfulFountain(thread, selectedComments);
        onImport(fountain);
      } else {
        const allSelected: { author: string; body: string; depth: number }[] =
          [];
        for (const c of selectedComments) {
          collectSelected(c, selected, allSelected);
        }

        const res = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thread, comments: allSelected }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "AI analysis failed");
          return;
        }

        onImport(data.fountain);
      }

      onClose();
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }, [thread, selected, mode, onImport, onClose]);

  function hasSelectedDescendant(
    comment: RedditComment,
    sel: Set<string>
  ): boolean {
    if (sel.has(comment.id)) return true;
    return comment.replies.some((r) => hasSelectedDescendant(r, sel));
  }

  function collectSelected(
    comment: RedditComment,
    sel: Set<string>,
    result: { author: string; body: string; depth: number }[]
  ) {
    if (sel.has(comment.id) && !comment.is_deleted) {
      result.push({
        author: comment.author,
        body: comment.body,
        depth: comment.depth,
      });
    }
    for (const reply of comment.replies) {
      collectSelected(reply, sel, result);
    }
  }

  const selectedCount = selected.size;
  const totalCount = thread ? countAllComments(thread.comments) : 0;
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  // Count how many selected top-level comments need deep loading
  const selectedTopLevel = thread
    ? thread.comments.filter((c) => selected.has(c.id))
    : [];
  const needsDeepLoad = selectedTopLevel.filter(
    (c) => !deepLoadedIds.has(c.id)
  ).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h2 className="text-lg font-semibold text-zinc-900">
            Import from Reddit
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* URL Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Paste a Reddit thread URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchThread()}
                placeholder="https://reddit.com/r/AskReddit/comments/..."
                className="flex-1 px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={fetchThread}
                disabled={loading || !url.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loading ? "Fetching..." : "Fetch Thread"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Thread Preview */}
          {thread && (
            <>
              <div className="mb-4 p-3 bg-zinc-50 rounded-md">
                <h3 className="font-semibold text-zinc-900 text-sm">
                  {thread.title}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  r/{thread.subreddit} &middot;{" "}
                  {thread.num_comments.toLocaleString()} comments &middot;{" "}
                  {thread.score.toLocaleString()} pts
                </p>
                {thread.truncatedTopLevelIds.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Showing top comments. {thread.truncatedTopLevelIds.length}{" "}
                    more threads available.
                  </p>
                )}
              </div>

              {/* Deep Fetch Banner */}
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Load full conversations
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    {needsDeepLoad > 0
                      ? `Select the threads you want, then click to fetch all replies for ${needsDeepLoad} selected thread${needsDeepLoad !== 1 ? "s" : ""}.`
                      : deepLoadedIds.size > 0
                        ? `${deepLoadedIds.size} thread${deepLoadedIds.size !== 1 ? "s" : ""} fully loaded.`
                        : "Select threads and load their full reply chains."}
                  </p>
                </div>
                <button
                  onClick={handleDeepFetch}
                  disabled={deepLoading || needsDeepLoad === 0}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ml-3 shrink-0"
                >
                  {deepLoading ? "Loading..." : "Load Full Threads"}
                </button>
              </div>

              {/* Search & Selection Controls */}
              <div className="mb-3 space-y-2">
                {/* Search bar */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <svg
                      className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search comments or usernames..."
                      className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                  {/* Search mode toggle */}
                  <div className="flex border border-zinc-300 rounded-md overflow-hidden text-xs shrink-0">
                    <button
                      onClick={() => setSearchMode("all")}
                      className={`px-2.5 py-2 ${
                        searchMode === "all"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSearchMode("username")}
                      className={`px-2.5 py-2 border-l border-zinc-300 ${
                        searchMode === "username"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      User
                    </button>
                    <button
                      onClick={() => setSearchMode("content")}
                      className={`px-2.5 py-2 border-l border-zinc-300 ${
                        searchMode === "content"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      Content
                    </button>
                  </div>
                </div>

                {/* Select / Deselect controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    {!searchQuery ? (
                      <>
                        <button
                          onClick={handleSelectAll}
                          disabled={allSelected}
                          className="text-blue-600 hover:text-blue-800 disabled:text-zinc-300 disabled:cursor-default"
                        >
                          Select All
                        </button>
                        <span className="text-zinc-300">|</span>
                        <button
                          onClick={handleDeselectAll}
                          disabled={selectedCount === 0}
                          className="text-blue-600 hover:text-blue-800 disabled:text-zinc-300 disabled:cursor-default"
                        >
                          Deselect All
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleSelectVisible}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Select Matches
                        </button>
                        <span className="text-zinc-300">|</span>
                        <button
                          onClick={handleDeselectVisible}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Deselect Matches
                        </button>
                        <span className="text-zinc-300">|</span>
                        <button
                          onClick={handleSelectAll}
                          disabled={allSelected}
                          className="text-blue-600 hover:text-blue-800 disabled:text-zinc-300 disabled:cursor-default"
                        >
                          Select All
                        </button>
                        <span className="text-zinc-300">|</span>
                        <button
                          onClick={handleDeselectAll}
                          disabled={selectedCount === 0}
                          className="text-blue-600 hover:text-blue-800 disabled:text-zinc-300 disabled:cursor-default"
                        >
                          Deselect All
                        </button>
                      </>
                    )}
                  </div>
                  {searchQuery && visibleIds && (
                    <span className="text-xs text-zinc-400">
                      {visibleIds.size} match
                      {visibleIds.size !== 1 ? "es" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Comment Tree */}
              <div className="mb-4 border border-zinc-200 rounded-md p-3 max-h-[40vh] overflow-y-auto">
                {thread.comments.map((comment) => (
                  <CommentNode
                    key={comment.id}
                    comment={comment}
                    selected={selected}
                    onToggle={toggleComment}
                    searchQuery={searchQuery.trim()}
                    searchMode={searchMode}
                    visibleIds={visibleIds}
                  />
                ))}
                {searchQuery && visibleIds && visibleIds.size === 0 && (
                  <p className="text-sm text-zinc-400 text-center py-6">
                    No comments matching &ldquo;{searchQuery}&rdquo;
                  </p>
                )}
              </div>

              {/* Import Options */}
              <div className="border-t border-zinc-200 pt-4">
                <p className="text-sm text-zinc-600 mb-3">
                  {selectedCount} of {totalCount} comments selected
                  {deepLoadedIds.size > 0 && (
                    <span className="text-green-600 ml-2">
                      ({deepLoadedIds.size} thread
                      {deepLoadedIds.size !== 1 ? "s" : ""} fully loaded)
                    </span>
                  )}
                </p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "faithful"}
                      onChange={() => setMode("faithful")}
                      className="accent-blue-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-800">
                        Faithful transcript
                      </span>
                      <p className="text-xs text-zinc-500">
                        Raw dialogue, exact words
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "dramatized"}
                      onChange={() => setMode("dramatized")}
                      className="accent-blue-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-800">
                        AI dramatized
                      </span>
                      <p className="text-xs text-zinc-500">
                        Claude rewrites as natural speech
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {thread && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing
                ? mode === "dramatized"
                  ? "AI is writing..."
                  : "Importing..."
                : "Import to Editor"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
