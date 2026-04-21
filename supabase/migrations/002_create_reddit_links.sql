-- Create reddit_links table for saved Reddit threads
CREATE TABLE IF NOT EXISTS reddit_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  subreddit TEXT,
  author TEXT,
  score INTEGER DEFAULT 0,
  num_comments INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reddit_links_user_id ON reddit_links(user_id);
CREATE INDEX IF NOT EXISTS idx_reddit_links_created_at ON reddit_links(user_id, created_at DESC);

ALTER TABLE reddit_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own links"
  ON reddit_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own links"
  ON reddit_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own links"
  ON reddit_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own links"
  ON reddit_links FOR DELETE
  USING (auth.uid() = user_id);
