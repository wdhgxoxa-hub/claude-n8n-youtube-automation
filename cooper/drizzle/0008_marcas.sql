CREATE TABLE marcas (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id), nombre TEXT NOT NULL, rubro TEXT NOT NULL, zona TEXT NOT NULL, guia TEXT NOT NULL, estudio TEXT, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX marcas_dueno ON marcas(owner_id);
--> statement-breakpoint
CREATE TABLE cuentas_marca (id TEXT PRIMARY KEY NOT NULL, marca_id TEXT NOT NULL REFERENCES marcas(id) ON DELETE CASCADE, red TEXT NOT NULL, alias TEXT NOT NULL, remoto TEXT NOT NULL, pagina TEXT NOT NULL DEFAULT '', tipo TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL DEFAULT 'pendiente', simulada INTEGER NOT NULL DEFAULT 1, verificada INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE UNIQUE INDEX cuentas_marca_destino ON cuentas_marca(red, remoto);
--> statement-breakpoint
CREATE TABLE piezas_marca (id TEXT PRIMARY KEY NOT NULL, marca_id TEXT NOT NULL REFERENCES marcas(id), cuenta_id TEXT NOT NULL REFERENCES cuentas_marca(id), datos TEXT NOT NULL, guia TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, estado TEXT NOT NULL DEFAULT 'borrador', aprobada_por TEXT NOT NULL DEFAULT '', aprobada_revision INTEGER NOT NULL DEFAULT 0, programada INTEGER NOT NULL, lease_at INTEGER NOT NULL DEFAULT 0, remoto TEXT NOT NULL DEFAULT '', medios_ids TEXT NOT NULL DEFAULT '[]', checkpoint TEXT NOT NULL DEFAULT '{}', metricas TEXT, aviso TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX piezas_marca_cola ON piezas_marca(estado, programada);
--> statement-breakpoint
CREATE TABLE citas_marca (id TEXT PRIMARY KEY NOT NULL, referencia TEXT NOT NULL, version TEXT NOT NULL, texto TEXT NOT NULL, fuente TEXT NOT NULL, revisada_por TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX citas_marca_version ON citas_marca(referencia, version);
--> statement-breakpoint
CREATE TABLE marca_ingestas (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id), media_id TEXT NOT NULL, caption TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'pendiente', intentos INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
