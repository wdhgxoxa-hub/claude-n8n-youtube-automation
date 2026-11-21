CREATE TABLE chat_sessions (
  owner_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id),
  channel_id TEXT NOT NULL DEFAULT '',
  lease TEXT NOT NULL DEFAULT '',
  busy_until INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE chat_actions (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  tool TEXT NOT NULL,
  arguments TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX chat_actions_owner ON chat_actions(owner_id, created_at);
