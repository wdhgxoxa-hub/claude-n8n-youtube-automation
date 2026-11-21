CREATE TABLE montajes_fabrica (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id), video_id TEXT NOT NULL, revision TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX montajes_fabrica_revision ON montajes_fabrica(owner_id, video_id, revision);
