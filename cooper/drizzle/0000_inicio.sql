CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, image TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'usuario', active INTEGER NOT NULL DEFAULT 1, theme TEXT NOT NULL DEFAULT 'oscuro', home TEXT NOT NULL DEFAULT 'chat', whatsapp TEXT NOT NULL DEFAULT '');
--> statement-breakpoint
CREATE TABLE allowed_emails (email TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE channels (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, niche TEXT NOT NULL, bible TEXT NOT NULL DEFAULT '', networks TEXT NOT NULL DEFAULT '', goals TEXT NOT NULL DEFAULT '', account TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX channels_owner_idx ON channels(owner_id);
--> statement-breakpoint
CREATE TABLE videos (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, title TEXT NOT NULL, stage INTEGER NOT NULL DEFAULT 0 CHECK(stage BETWEEN 0 AND 11), script TEXT NOT NULL, feedback TEXT NOT NULL DEFAULT '', reference_text TEXT NOT NULL DEFAULT '', scheduled_at TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX videos_owner_idx ON videos(owner_id);
--> statement-breakpoint
CREATE TABLE messages (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL, content TEXT NOT NULL, attachment_ids TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX messages_owner_idx ON messages(owner_id);
--> statement-breakpoint
CREATE TABLE attachments (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, data TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX attachments_owner_idx ON attachments(owner_id);
--> statement-breakpoint
CREATE TABLE assets (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, name TEXT NOT NULL, shared INTEGER NOT NULL DEFAULT 0, verified INTEGER NOT NULL DEFAULT 0, evidence_id TEXT NOT NULL, photo_id TEXT NOT NULL DEFAULT '', placement TEXT NOT NULL DEFAULT 'partes', created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX assets_owner_idx ON assets(owner_id);
--> statement-breakpoint
CREATE TABLE expenses (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), amount REAL NOT NULL, concept TEXT NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX expenses_owner_idx ON expenses(owner_id);
--> statement-breakpoint
CREATE TABLE events (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX events_owner_idx ON events(owner_id);