ALTER TABLE videos ADD COLUMN avatar_id TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE videos ADD COLUMN voice_id TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE videos ADD COLUMN avatar_placement TEXT NOT NULL DEFAULT 'partes';
