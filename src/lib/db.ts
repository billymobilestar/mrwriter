import { supabase } from "./supabase";

export interface Script {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export async function getScripts(): Promise<Script[]> {
  const { data, error } = await supabase
    .from("scripts")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch scripts:", error);
    return [];
  }

  return data || [];
}

export async function getScript(id: string): Promise<Script | null> {
  const { data, error } = await supabase
    .from("scripts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Failed to fetch script:", error);
    return null;
  }

  return data;
}

export async function createScript(
  userId: string,
  title: string = "Untitled Screenplay",
  content: string = ""
): Promise<Script | null> {
  const { data, error } = await supabase
    .from("scripts")
    .insert({ user_id: userId, title, content })
    .select()
    .single();

  if (error) {
    console.error("Failed to create script:", error);
    return null;
  }

  return data;
}

export async function updateScript(
  id: string,
  updates: { title?: string; content?: string }
): Promise<boolean> {
  const { error } = await supabase
    .from("scripts")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Failed to update script:", error);
    return false;
  }

  return true;
}

export async function deleteScript(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("scripts")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete script:", error);
    return false;
  }

  return true;
}

// ═══════════════════════════════════════════
// Reddit Links
// ═══════════════════════════════════════════

export interface RedditLink {
  id: string;
  user_id: string;
  url: string;
  title: string;
  subreddit: string | null;
  author: string | null;
  score: number;
  num_comments: number;
  thumbnail_url: string | null;
  notes: string | null;
  created_at: string;
}

export async function getRedditLinks(): Promise<RedditLink[]> {
  const { data, error } = await supabase
    .from("reddit_links")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch reddit links:", error);
    return [];
  }
  return data || [];
}

export async function createRedditLink(
  userId: string,
  link: {
    url: string;
    title: string;
    subreddit?: string;
    author?: string;
    score?: number;
    num_comments?: number;
    thumbnail_url?: string | null;
    notes?: string | null;
  }
): Promise<RedditLink | null> {
  const { data, error } = await supabase
    .from("reddit_links")
    .insert({
      user_id: userId,
      url: link.url,
      title: link.title,
      subreddit: link.subreddit || null,
      author: link.author || null,
      score: link.score || 0,
      num_comments: link.num_comments || 0,
      thumbnail_url: link.thumbnail_url || null,
      notes: link.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create reddit link:", error);
    return null;
  }
  return data;
}

export async function updateRedditLink(
  id: string,
  updates: { notes?: string | null; title?: string }
): Promise<boolean> {
  const { error } = await supabase
    .from("reddit_links")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Failed to update reddit link:", error);
    return false;
  }
  return true;
}

export async function deleteRedditLink(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("reddit_links")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete reddit link:", error);
    return false;
  }
  return true;
}
