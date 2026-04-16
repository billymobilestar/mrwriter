import { RedditComment, RedditThread, flattenThread } from "./reddit-parser";

const deletedUserCounters = new Map<string, number>();
let deletedCounter = 0;

function resetDeletedCounters() {
  deletedUserCounters.clear();
  deletedCounter = 0;
}

function cleanUsername(username: string): string {
  if (username === "[deleted]" || username === "[removed]") {
    // Assign a consistent numbered anonymous name per unique deleted comment
    deletedCounter++;
    return `ANONYMOUS #${deletedCounter}`;
  }
  return username
    .replace(/[-_]+/g, " ")
    .replace(/\d+$/g, "")
    .trim()
    .toUpperCase()
    || username.toUpperCase();
}

function cleanBody(body: string): string {
  return body
    // Remove markdown links [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove reddit formatting
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    // Remove edit notices
    .replace(/\n*edit:.*$/gi, "")
    .replace(/\n*EDIT:.*$/g, "")
    // Remove award speeches
    .replace(/\n*thanks for the (gold|award|silver|platinum).*$/gi, "")
    // Remove quoted text (lines starting with >)
    .replace(/^>.*$/gm, "")
    // Clean up excessive newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapDialogue(text: string, maxWidth: number = 35): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join("\n");
}

export interface GenerateOptions {
  mode: "faithful" | "dramatized";
  selectedCommentIds?: Set<string>;
}

export function generateFaithfulFountain(
  thread: RedditThread,
  selectedComments: RedditComment[]
): string {
  resetDeletedCounters();
  const lines: string[] = [];

  // Title page
  lines.push(`Title: ${thread.title}`);
  lines.push(`Credit: Based on r/${thread.subreddit}`);
  lines.push(`Author: Reddit Users`);
  lines.push(`Source: ${thread.url}`);
  lines.push(`Draft date: ${new Date().toLocaleDateString()}`);
  lines.push("");
  lines.push("===");
  lines.push("");
  lines.push("FADE IN:");
  lines.push("");

  // Opening scene heading
  lines.push(`INT. REDDIT THREAD - r/${thread.subreddit.toUpperCase()} - NIGHT`);
  lines.push("");

  // Post body as action
  if (thread.selftext) {
    const cleaned = cleanBody(thread.selftext);
    if (cleaned) {
      lines.push(cleaned);
      lines.push("");
    }
  } else {
    lines.push(`A thread titled "${thread.title}"`);
    lines.push("");
  }

  // Process selected comments as scenes
  const topLevelSelected = selectedComments.filter(c => c.depth === 0);

  for (let i = 0; i < topLevelSelected.length; i++) {
    const topComment = topLevelSelected[i];
    const flat = flattenThread(topComment);

    if (i > 0) {
      // New scene for each top-level comment thread
      lines.push("");
      lines.push(`INT. REDDIT THREAD - CONTINUED - NIGHT`);
      lines.push("");
    }

    for (const comment of flat) {
      if (comment.is_deleted) continue; // only skips if both author AND body are gone

      const name = cleanUsername(comment.author);
      const body = cleanBody(comment.body);

      if (!body) continue;

      // Character name
      lines.push(name);

      // Dialogue
      lines.push(wrapDialogue(body));
      lines.push("");
    }
  }

  lines.push("FADE OUT.");
  lines.push("");

  return lines.join("\n");
}

export function generateFountainFromFlat(
  thread: RedditThread,
  comments: RedditComment[]
): string {
  // For when we have a flat list of selected comments (after filtering)
  const nonDeleted = comments.filter(c => !c.is_deleted);
  if (nonDeleted.length === 0) return "";

  // Group by top-level parent (depth 0)
  const topLevel = nonDeleted.filter(c => c.depth === 0);
  if (topLevel.length === 0) {
    // All selected comments are replies; treat as one scene
    return generateFaithfulFountain(thread, nonDeleted);
  }

  return generateFaithfulFountain(thread, topLevel);
}
