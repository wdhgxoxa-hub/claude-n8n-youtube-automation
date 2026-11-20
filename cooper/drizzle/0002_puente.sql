CREATE TABLE bridge_commands (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  request TEXT NOT NULL,
  execution TEXT NOT NULL DEFAULT '',
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE bridge_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  digest TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
ALTER TABLE videos ADD COLUMN remote_updated_at INTEGER NOT NULL DEFAULT 0;
