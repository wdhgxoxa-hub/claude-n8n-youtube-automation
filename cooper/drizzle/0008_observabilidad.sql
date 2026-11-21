ALTER TABLE channels ADD COLUMN learning text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE videos ADD COLUMN observability text NOT NULL DEFAULT '{}';
