import { NextRequest, NextResponse } from "next/server";
import { parseCommentPermalink, type RedditComment } from "@/lib/reddit-parser";

const REDDIT_UA = "MrWriter/1.0 (Screenwriting App; educational project)";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function redditFetch(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": REDDIT_UA },
    });
    if (res.ok) return res;
    if (res.status === 429) {
      // Exponential backoff: 5s, 10s, 20s
      const retryAfter = parseInt(res.headers.get("retry-after") || "0", 10);
      const backoff = Math.max(retryAfter, 5) * Math.pow(2, attempt);
      await sleep(backoff * 1000);
      continue;
    }
    return res;
  }
  return null;
}

async function fetchCommentThread(
  subreddit: string,
  postId: string,
  commentId: string
): Promise<RedditComment | null> {
  try {
    const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}/x/${commentId}.json?limit=500&sort=top`;
    const res = await redditFetch(url);
    if (!res || !res.ok) return null;
    const json = await res.json();
    return parseCommentPermalink(json);
  } catch {
    return null;
  }
}

/**
 * Deep fetch — takes a list of comment IDs and fetches each one's
 * full reply tree via permalink. Called after the user selects which
 * top-level threads they want to expand.
 */
export async function POST(req: NextRequest) {
  try {
    const { subreddit, postId, commentIds } = await req.json();

    if (!subreddit || !postId || !Array.isArray(commentIds)) {
      return NextResponse.json(
        { error: "subreddit, postId, and commentIds are required" },
        { status: 400 }
      );
    }

    // Process in batches of 3 with delays
    const batchSize = 3;
    const results: RedditComment[] = [];

    for (let i = 0; i < commentIds.length; i += batchSize) {
      if (i > 0) await sleep(2000);

      const batch = commentIds.slice(i, i + batchSize);
      const promises = batch.map((id: string) =>
        fetchCommentThread(subreddit, postId, id)
      );

      const batchResults = await Promise.all(promises);
      for (const comment of batchResults) {
        if (comment) results.push(comment);
      }
    }

    return NextResponse.json({ comments: results });
  } catch (error) {
    console.error("Reddit deep fetch error:", error);
    return NextResponse.json(
      { error: "Failed to deep-fetch comments" },
      { status: 500 }
    );
  }
}
