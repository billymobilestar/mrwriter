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
