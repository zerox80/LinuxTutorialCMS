-- Add votes and is_admin columns to comments table
ALTER TABLE comments ADD COLUMN votes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;
