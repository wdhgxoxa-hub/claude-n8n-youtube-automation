ALTER TABLE messages ADD COLUMN channel_id text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE chat_sessions ADD COLUMN memory_after integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX messages_scope_created ON messages(owner_id, channel_id, created_at);
--> statement-breakpoint
CREATE TABLE chat_memories (
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope text NOT NULL,
  channel_id text REFERENCES channels(id) ON DELETE CASCADE,
  summary text NOT NULL,
  updated_at integer NOT NULL,
  method text NOT NULL DEFAULT 'apuntes',
  PRIMARY KEY (owner_id, scope),
  CHECK (scope = coalesce(channel_id, ''))
);
