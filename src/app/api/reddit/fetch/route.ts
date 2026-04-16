import { NextRequest, NextResponse } from "next/server";
import {
  parseRedditJson,
  extractRedditUrl,
} from "@/lib/reddit-parser";

const REDDIT_UA = "MrWriter/1.0 (Screenwriting App; educational project)";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function redditFetch(url: string): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": REDDIT_UA },
    });

    if (res.ok) return res;

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "5", 10);
      await sleep(retryAfter * 1000);
      continue;
    }

    // Non-retryable error
    return res;
  }

  // All retries exhausted — return a synthetic response
  return new Response(null, { status: 429 });
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const redditUrl = extractRedditUrl(url);
    if (!redditUrl) {
      return NextResponse.json(
        { error: "Invalid Reddit URL. Please provide a link to a Reddit thread." },
        { status: 400 }
      );
    }

    const jsonUrl = `${redditUrl}.json?limit=500&sort=top`;
    const response = await redditFetch(jsonUrl);

    if (!response.ok) {
      const status = response.status;
      let message: string;
      if (status === 429) {
        message = "Reddit is rate limiting requests. Please wait a minute and try again.";
      } else if (status === 404) {
        message = "Thread not found. It may be private or deleted.";
      } else if (status === 403) {
        message = "This thread is private or quarantined.";
      } else {
        message = `Reddit returned an error (${status}). Try again shortly.`;
      }
      return NextResponse.json({ error: message }, { status });
    }

    const json = await response.json();
    const thread = parseRedditJson(json);

    return NextResponse.json({ thread });
  } catch (error) {
    console.error("Reddit fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Reddit thread" },
      { status: 500 }
    );
  }
}
