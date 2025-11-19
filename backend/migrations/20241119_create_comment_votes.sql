CREATE TABLE IF NOT EXISTS comment_votes (
    comment_id TEXT NOT NULL,
    voter_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, voter_id),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);
