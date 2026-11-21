CREATE TABLE whatsapp_contacts (
 owner_id TEXT PRIMARY KEY REFERENCES users(id),
 phone TEXT NOT NULL DEFAULT '', verified_at INTEGER NOT NULL DEFAULT 0,
 consent_at INTEGER NOT NULL DEFAULT 0, preferences TEXT NOT NULL DEFAULT '{}',
 incoming_at INTEGER NOT NULL DEFAULT 0, challenge_id TEXT NOT NULL DEFAULT '',
 challenge_expires INTEGER NOT NULL DEFAULT 0, challenge_attempts INTEGER NOT NULL DEFAULT 0,
 simulated INTEGER NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX whatsapp_verified_phone ON whatsapp_contacts(phone) WHERE verified_at > 0;
--> statement-breakpoint
CREATE TABLE whatsapp_outbox (
 id TEXT PRIMARY KEY, dedupe_key TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL REFERENCES users(id),
 phone TEXT NOT NULL, kind TEXT NOT NULL, resource_id TEXT NOT NULL DEFAULT '',
 revision TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '',
 interactive INTEGER NOT NULL DEFAULT 0, simulated INTEGER NOT NULL DEFAULT 1,
 contact_verified_at INTEGER NOT NULL DEFAULT 0,
 state TEXT NOT NULL DEFAULT 'pendiente', attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL, lease_at INTEGER NOT NULL DEFAULT 0,
 remote_id TEXT NOT NULL DEFAULT '', delivery TEXT NOT NULL DEFAULT '',
 error_code TEXT NOT NULL DEFAULT '', expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX whatsapp_due ON whatsapp_outbox(state, next_at);
--> statement-breakpoint
CREATE INDEX whatsapp_owner ON whatsapp_outbox(owner_id, created_at);
--> statement-breakpoint
CREATE INDEX whatsapp_phone ON whatsapp_outbox(phone, created_at);
--> statement-breakpoint
CREATE UNIQUE INDEX whatsapp_remote ON whatsapp_outbox(remote_id) WHERE remote_id <> '';
--> statement-breakpoint
CREATE TABLE whatsapp_deliveries (
 id TEXT PRIMARY KEY, remote_id TEXT NOT NULL, phone TEXT NOT NULL,
 state TEXT NOT NULL, occurred_at INTEGER NOT NULL, error_code TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE INDEX whatsapp_delivery_remote ON whatsapp_deliveries(remote_id);
--> statement-breakpoint
CREATE TABLE whatsapp_inbox (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE whatsapp_actions (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
 decision TEXT NOT NULL, state TEXT NOT NULL, created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE whatsapp_attempts (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES whatsapp_outbox(id),
 owner_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX whatsapp_attempt_owner ON whatsapp_attempts(owner_id, created_at);
