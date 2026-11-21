ALTER TABLE assets ADD COLUMN poll_lease TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN poll_lease_until INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN poll_next_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN poll_failures INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX assets_poll_due ON assets(status, poll_next_at, poll_lease_until, polled_at);
