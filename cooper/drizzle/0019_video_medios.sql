CREATE TABLE video_medios (
  clave TEXT PRIMARY KEY NOT NULL,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  publicacion_id TEXT NOT NULL DEFAULT '',
  revision TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('listo', 'sin_medio', 'pendiente', 'no_disponible')),
  poster_data TEXT NOT NULL DEFAULT '',
  poster_mime TEXT NOT NULL DEFAULT 'image/webp',
  poster_origen TEXT NOT NULL DEFAULT 'render',
  poster_ancho INTEGER NOT NULL DEFAULT 1600 CHECK (poster_ancho > 0),
  poster_alto INTEGER NOT NULL DEFAULT 900 CHECK (poster_alto > 0),
  preview_data TEXT NOT NULL DEFAULT '',
  preview_bytes INTEGER NOT NULL DEFAULT 0 CHECK (preview_bytes BETWEEN 0 AND 600000),
  preview_duracion REAL NOT NULL DEFAULT 0 CHECK (preview_duracion = 0 OR preview_duracion BETWEEN 4 AND 6),
  tinte TEXT NOT NULL,
  ancho INTEGER NOT NULL DEFAULT 1600 CHECK (ancho > 0),
  alto INTEGER NOT NULL DEFAULT 900 CHECK (alto > 0),
  origen_dimensiones TEXT NOT NULL DEFAULT 'reserva' CHECK (origen_dimensiones IN ('video', 'poster', 'reserva')),
  actualizado_en INTEGER NOT NULL,
  reintentar_en INTEGER NOT NULL DEFAULT 0,
  intentos INTEGER NOT NULL DEFAULT 0,
  reserva_hasta INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX video_medios_video_idx ON video_medios(video_id);
