ALTER TABLE assets ADD COLUMN consent_revoked_at integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE videos ADD COLUMN production_state text NOT NULL DEFAULT 'activa';
--> statement-breakpoint
ALTER TABLE videos ADD COLUMN production_notice text NOT NULL DEFAULT '';
