ALTER TABLE assets ADD COLUMN provider text NOT NULL DEFAULT 'simulada';
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN provider_id text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN status text NOT NULL DEFAULT 'listo';
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN simulated integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN photo_ids text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN challenge_id text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN consent_at integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN consent_text text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN consent_version text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN reviewed_by text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN reviewed_at integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN preview_url text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN preview_data text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN preview_mime text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN polled_at integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE assets ADD COLUMN sync_error integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE identity_challenges (
  id text PRIMARY KEY NOT NULL, owner_id text NOT NULL REFERENCES users(id),
  kind text NOT NULL, phrase text NOT NULL, expires_at integer NOT NULL, used_at integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX identity_challenges_owner ON identity_challenges(owner_id);
--> statement-breakpoint
CREATE TABLE public_media (
  id text PRIMARY KEY NOT NULL, name text NOT NULL, provider_id text NOT NULL,
  preview_url text NOT NULL, updated_at integer NOT NULL
);
