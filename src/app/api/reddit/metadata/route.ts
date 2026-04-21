import { NextRequest, NextResponse } from "next/server";
import { extractRedditUrl } from "@/lib/reddit-parser";

const REDDIT_UA = "MrWriter/1.0 (Screenwriting App)";

/**
 * Lightweight endpoint — fetches only the post metadata, not comments.
 * Used when saving a Reddit link to the user's library.
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const redditUrl = extractRedditUrl(url);
    if (!redditUrl) {
      return NextResponse.json(
        { error: "Invalid Reddit URL." },
        { status: 400 }
      );
    }

    // Only fetch the first listing (post), no comments
    const jsonUrl = `${redditUrl}.json?limit=1`;
    const res = await fetch(jsonUrl, {
      headers: { "User-Agent": REDDIT_UA },
    });

    if (!res.ok) {
      if (res.status === 429) {
        return NextResponse.json(
          { error: "Reddit is rate limiting. Wait a minute and try again." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `Reddit returned ${res.status}.` },
        { status: res.status }
      );
    }

    const json = await res.json();
    const postListing = json[0] as Record<string, unknown>;
    const postData = postListing.data as Record<string, unknown>;
    const postChildren = postData.children as Record<string, unknown>[];
    if (!postChildren || postChildren.length === 0) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }
    const post = (postChildren[0] as Record<string, unknown>).data as Record<string, unknown>;

    const thumbnail = post.thumbnail as string;
    const validThumbnail =
      thumbnail && thumbnail.startsWith("http") ? thumbnail : null;

    return NextResponse.json({
      metadata: {
        url: redditUrl,
        title: (post.title as string) || "Untitled",
        subreddit: (post.subreddit as string) || "",
        author: (post.author as string) || "",
        score: (post.score as number) || 0,
        num_comments: (post.num_comments as number) || 0,
        thumbnail_url: validThumbnail,
      },
    });
  } catch (error) {
    console.error("Reddit metadata fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch thread metadata" },
      { status: 500 }
    );
  }
}
