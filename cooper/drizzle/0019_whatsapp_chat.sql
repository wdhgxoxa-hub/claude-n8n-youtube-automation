CREATE TABLE whatsapp_chat_jobs (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 phone TEXT NOT NULL, text TEXT NOT NULL, response TEXT NOT NULL DEFAULT '',
 contact_verified_at INTEGER NOT NULL, simulated INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'pendiente', attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL, lease_at INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX whatsapp_chat_due ON whatsapp_chat_jobs(state, next_at);
--> statement-breakpoint
CREATE INDEX whatsapp_chat_owner ON whatsapp_chat_jobs(owner_id, created_at);
