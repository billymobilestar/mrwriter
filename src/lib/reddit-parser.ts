export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  depth: number;
  created_utc: number;
  replies: RedditComment[];
  is_deleted: boolean;
}

export interface RedditThread {
  id: string;
  postId: string; // the short post ID (e.g. "1smaycb")
  title: string;
  subreddit: string;
  author: string;
  selftext: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  comments: RedditComment[];
  truncatedTopLevelIds: string[]; // IDs from "more" stubs at top level
}

function parseComment(
  data: Record<string, unknown>,
  depth: number
): { comment: RedditComment | null; moreIds: string[] } {
  const kind = data.kind as string;

  if (kind === "more") {
    const d = data.data as Record<string, unknown>;
    const children = (d.children as string[]) || [];
    return { comment: null, moreIds: children };
  }

  if (kind !== "t1") return { comment: null, moreIds: [] };

  const d = data.data as Record<string, unknown>;
  const author = d.author as string;
  const body = d.body as string;

  const isDeleted =
    (author === "[deleted]" || author === "[removed]") &&
    (body === "[deleted]" || body === "[removed]");

  const replies: RedditComment[] = [];
  const repliesData = d.replies as Record<string, unknown> | undefined;
  if (repliesData && typeof repliesData === "object" && repliesData.data) {
    const replyListingData = repliesData.data as Record<string, unknown>;
    const rawChildren = replyListingData.children as Record<string, unknown>[];
    if (Array.isArray(rawChildren)) {
      for (const child of rawChildren) {
        const result = parseComment(child, depth + 1);
        if (result.comment) replies.push(result.comment);
        // We don't collect deeper "more" stubs — the permalink approach handles depth
      }
    }
  }

  return {
    comment: {
      id: d.name as string,
      author,
      body,
      score: (d.score as number) || 0,
      depth,
      created_utc: (d.created_utc as number) || 0,
      replies,
      is_deleted: isDeleted,
    },
    moreIds: [],
  };
}

export function parseRedditJson(json: unknown[]): RedditThread {
  const postListing = json[0] as Record<string, unknown>;
  const commentListing = json[1] as Record<string, unknown>;

  const postData = postListing.data as Record<string, unknown>;
  const postChildren = postData.children as Record<string, unknown>[];
  const post = (postChildren[0] as Record<string, unknown>).data as Record<string, unknown>;

  const commentData = commentListing.data as Record<string, unknown>;
  const commentChildren = commentData.children as Record<string, unknown>[];

  const comments: RedditComment[] = [];
  const truncatedTopLevelIds: string[] = [];

  for (const child of commentChildren) {
    const result = parseComment(child, 0);
    if (result.comment) {
      comments.push(result.comment);
    }
    if (result.moreIds.length > 0) {
      truncatedTopLevelIds.push(...result.moreIds);
    }
  }

  const permalink = (post.permalink as string) || "";
  // Extract the short post ID from permalink like /r/sub/comments/ABC123/title/
  const postIdMatch = permalink.match(/\/comments\/([^/]+)/);
  const postId = postIdMatch ? postIdMatch[1] : (post.id as string) || "";

  return {
    id: post.name as string,
    postId,
    title: post.title as string,
    subreddit: post.subreddit as string,
    author: post.author as string,
    selftext: (post.selftext as string) || "",
    score: (post.score as number) || 0,
    num_comments: (post.num_comments as number) || 0,
    url: post.url as string,
    permalink,
    comments,
    truncatedTopLevelIds,
  };
}

/**
 * Parse the response from fetching an individual comment's permalink.
 * Returns the single top-level comment with its full reply tree.
 */
export function parseCommentPermalink(json: unknown[]): RedditComment | null {
  const commentListing = json[1] as Record<string, unknown>;
  const commentData = commentListing.data as Record<string, unknown>;
  const commentChildren = commentData.children as Record<string, unknown>[];

  if (!commentChildren || commentChildren.length === 0) return null;

  const result = parseComment(commentChildren[0], 0);
  return result.comment;
}

export function extractRedditUrl(input: string): string | null {
  const cleaned = input.trim();

  const patterns = [
    /https?:\/\/(www\.)?reddit\.com\/r\/\w+\/comments\/\w+/,
    /https?:\/\/(old\.)?reddit\.com\/r\/\w+\/comments\/\w+/,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) return match[0];
  }

  return null;
}

export function flattenThread(comment: RedditComment): RedditComment[] {
  const result: RedditComment[] = [comment];
  for (const reply of comment.replies) {
    result.push(...flattenThread(reply));
  }
  return result;
}
