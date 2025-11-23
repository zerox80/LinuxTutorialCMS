-- Add allow_comments column to site_posts table
ALTER TABLE site_posts ADD COLUMN allow_comments BOOLEAN NOT NULL DEFAULT 1;
