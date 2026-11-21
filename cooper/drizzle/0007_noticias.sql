ALTER TABLE channels ADD COLUMN news_mode integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE videos ADD COLUMN news_mode integer NOT NULL DEFAULT 0;
