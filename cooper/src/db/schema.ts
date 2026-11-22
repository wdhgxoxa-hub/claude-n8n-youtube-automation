import type { EstadoMedio } from "@/servicios/medios";
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  image: text("image").notNull().default(""),
  role: text("role", { enum: ["usuario", "admin"] })
    .notNull()
    .default("usuario"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  theme: text("theme", { enum: ["oscuro", "claro", "sistema"] })
    .notNull()
    .default("oscuro"),
  home: text("home", { enum: ["chat", "fabrica"] })
    .notNull()
    .default("chat"),
  whatsapp: text("whatsapp").notNull().default(""),
});
export const allowedEmails = sqliteTable("allowed_emails", {
  email: text("email").primaryKey(),
  createdAt: integer("created_at").notNull(),
});
export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  niche: text("niche").notNull(),
  learning: text("learning").notNull().default("[]"),
  bible: text("bible").notNull().default(""),
  newsMode: integer("news_mode", { mode: "boolean" }).notNull().default(false),
  networks: text("networks").notNull().default(""),
  goals: text("goals").notNull().default(""),
  account: text("account").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});
export const videos = sqliteTable("videos", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  channelId: text("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  newsMode: integer("news_mode", { mode: "boolean" }).notNull().default(false),
  avatarId: text("avatar_id").notNull().default(""),
  voiceId: text("voice_id").notNull().default(""),
  avatarPlacement: text("avatar_placement", { enum: ["completo", "partes"] })
    .notNull()
    .default("partes"),
  productionState: text("production_state").notNull().default("activa"),
  productionNotice: text("production_notice").notNull().default(""),
  observability: text("observability").notNull().default("{}"),
  remoteUpdatedAt: integer("remote_updated_at").notNull().default(0),
  stage: integer("stage").notNull().default(0),
  script: text("script").notNull(),
  feedback: text("feedback").notNull().default(""),
  references: text("reference_text").notNull().default(""),
  scheduledAt: text("scheduled_at").notNull().default(""),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  attachmentIds: text("attachment_ids").notNull().default("[]"),
  channelId: text("channel_id").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});
export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: text("data").notNull(),
});
export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  kind: text("kind", { enum: ["avatar", "voz"] }).notNull(),
  name: text("name").notNull(),
  shared: integer("shared", { mode: "boolean" }).notNull().default(false),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  evidenceId: text("evidence_id").notNull(),
  photoId: text("photo_id").notNull().default(""),
  provider: text("provider").notNull().default("simulada"),
  providerId: text("provider_id").notNull().default(""),
  status: text("status").$type<EstadoMedio>().notNull().default("listo"),
  simulated: integer("simulated", { mode: "boolean" }).notNull().default(true),
  photoIds: text("photo_ids").notNull().default("[]"),
  challengeId: text("challenge_id").notNull().default(""),
  consentRevokedAt: integer("consent_revoked_at").notNull().default(0),
  consentAt: integer("consent_at").notNull().default(0),
  consentText: text("consent_text").notNull().default(""),
  consentVersion: text("consent_version").notNull().default(""),
  reviewedBy: text("reviewed_by").notNull().default(""),
  reviewedAt: integer("reviewed_at").notNull().default(0),
  previewUrl: text("preview_url").notNull().default(""),
  previewData: text("preview_data").notNull().default(""),
  previewMime: text("preview_mime").notNull().default(""),
  polledAt: integer("polled_at").notNull().default(0),
  pollLease: text("poll_lease").notNull().default(""),
  pollLeaseUntil: integer("poll_lease_until").notNull().default(0),
  pollNextAt: integer("poll_next_at").notNull().default(0),
  pollFailures: integer("poll_failures").notNull().default(0),
  syncError: integer("sync_error", { mode: "boolean" })
    .notNull()
    .default(false),
  placement: text("placement", { enum: ["completo", "partes"] })
    .notNull()
    .default("partes"),
  createdAt: integer("created_at").notNull(),
});
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  amount: real("amount").notNull(),
  concept: text("concept").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  createdAt: integer("created_at").notNull(),
});
export type User = typeof users.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type Asset = typeof assets.$inferSelect;

// Derivados privados y descartables. La revisión evita servir una portada vieja
// tras un nuevo montaje; los originales permanecen en su almacenamiento actual.
export const videoMedios = sqliteTable("video_medios", {
  clave: text("clave").primaryKey(),
  videoId: text("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  publicacionId: text("publicacion_id").notNull().default(""),
  revision: text("revision").notNull(),
  estado: text("estado")
    .$type<import("@/contratos/video-medios").VideoMedios["estado"]>()
    .notNull(),
  posterData: text("poster_data").notNull().default(""),
  posterMime: text("poster_mime").notNull().default("image/webp"),
  posterOrigen: text("poster_origen")
    .$type<import("@/contratos/video-medios").OrigenPoster>()
    .notNull()
    .default("render"),
  posterAncho: integer("poster_ancho").notNull().default(1600),
  posterAlto: integer("poster_alto").notNull().default(900),
  previewData: text("preview_data").notNull().default(""),
  previewBytes: integer("preview_bytes").notNull().default(0),
  previewDuracion: real("preview_duracion").notNull().default(0),
  tinte: text("tinte").notNull(),
  ancho: integer("ancho").notNull().default(1600),
  alto: integer("alto").notNull().default(900),
  origenDimensiones: text("origen_dimensiones")
    .$type<
      import("@/contratos/video-medios").VideoMedios["origenDimensiones"]
    >()
    .notNull()
    .default("reserva"),
  actualizadoEn: integer("actualizado_en").notNull(),
  reintentarEn: integer("reintentar_en").notNull().default(0),
  intentos: integer("intentos").notNull().default(0),
  reservaHasta: integer("reserva_hasta").notNull().default(0),
});

export const bridgeCommands = sqliteTable("bridge_commands", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  request: text("request").notNull(),
  execution: text("execution").notNull().default(""),
  confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});
export const bridgeReceipts = sqliteTable("bridge_receipts", {
  id: text("id").primaryKey(),
  digest: text("digest").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const identityChallenges = sqliteTable("identity_challenges", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  kind: text("kind", { enum: ["avatar", "voz"] }).notNull(),
  phrase: text("phrase").notNull(),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at").notNull().default(0),
});
export const publicMedia = sqliteTable("public_media", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  providerId: text("provider_id").notNull(),
  previewUrl: text("preview_url").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const chatSessions = sqliteTable("chat_sessions", {
  ownerId: text("owner_id")
    .primaryKey()
    .references(() => users.id),
  channelId: text("channel_id").notNull().default(""),
  lease: text("lease").notNull().default(""),
  busyUntil: integer("busy_until").notNull().default(0),
  memoryAfter: integer("memory_after").notNull().default(0),
});
export const chatMemories = sqliteTable(
  "chat_memories",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    channelId: text("channel_id").references(() => channels.id, {
      onDelete: "cascade",
    }),
    summary: text("summary").notNull(),
    updatedAt: integer("updated_at").notNull(),
    method: text("method", { enum: ["apuntes", "resumen"] })
      .notNull()
      .default("apuntes"),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.scope] })],
);
export const chatActions = sqliteTable("chat_actions", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  tool: text("tool").notNull(),
  arguments: text("arguments").notNull(),
  fingerprint: text("fingerprint").notNull(),
  channelId: text("channel_id").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  status: text("status").notNull().default("pendiente"),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const whatsappContacts = sqliteTable("whatsapp_contacts", {
  ownerId: text("owner_id")
    .primaryKey()
    .references(() => users.id),
  phone: text("phone").notNull().default(""),
  verifiedAt: integer("verified_at").notNull().default(0),
  consentAt: integer("consent_at").notNull().default(0),
  preferences: text("preferences").notNull().default("{}"),
  incomingAt: integer("incoming_at").notNull().default(0),
  challengeId: text("challenge_id").notNull().default(""),
  challengeExpires: integer("challenge_expires").notNull().default(0),
  challengeAttempts: integer("challenge_attempts").notNull().default(0),
  simulated: integer("simulated", { mode: "boolean" }).notNull().default(true),
});
export const whatsappOutbox = sqliteTable("whatsapp_outbox", {
  id: text("id").primaryKey(),
  dedupeKey: text("dedupe_key").notNull().unique(),
  contactVerifiedAt: integer("contact_verified_at").notNull().default(0),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  phone: text("phone").notNull(),
  kind: text("kind", {
    enum: ["verificacion", "guion", "final", "publicado", "gasto", "marca"],
  }).notNull(),
  resourceId: text("resource_id").notNull().default(""),
  revision: text("revision").notNull().default(""),
  detail: text("detail").notNull().default(""),
  interactive: integer("interactive", { mode: "boolean" })
    .notNull()
    .default(false),
  simulated: integer("simulated", { mode: "boolean" }).notNull().default(true),
  state: text("state", {
    enum: [
      "pendiente",
      "enviando",
      "aceptado",
      "fallido",
      "incierto",
      "cancelado",
    ],
  })
    .notNull()
    .default("pendiente"),
  attempts: integer("attempts").notNull().default(0),
  nextAt: integer("next_at").notNull(),
  leaseAt: integer("lease_at").notNull().default(0),
  remoteId: text("remote_id").notNull().default(""),
  delivery: text("delivery").notNull().default(""),
  errorCode: text("error_code").notNull().default(""),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const whatsappDeliveries = sqliteTable("whatsapp_deliveries", {
  id: text("id").primaryKey(),
  remoteId: text("remote_id").notNull(),
  phone: text("phone").notNull(),
  state: text("state").notNull(),
  occurredAt: integer("occurred_at").notNull(),
  errorCode: text("error_code").notNull().default(""),
});
export const whatsappInbox = sqliteTable("whatsapp_inbox", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
});
export const whatsappActions = sqliteTable("whatsapp_actions", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  decision: text("decision").notNull(),
  state: text("state").notNull(),
  createdAt: integer("created_at").notNull(),
});
export type AvisoWhatsApp = typeof whatsappOutbox.$inferSelect;
export const whatsappAttempts = sqliteTable("whatsapp_attempts", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => whatsappOutbox.id),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at").notNull(),
});

// Marcas son privadas del dueño; el rol admin siempre se revalida en servidor.
export const marcas = sqliteTable("marcas", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  nombre: text("nombre").notNull(),
  rubro: text("rubro")
    .$type<"iglesia-reformada" | "moda" | "general">()
    .notNull(),
  zona: text("zona").notNull(),
  guia: text("guia", { mode: "json" })
    .$type<import("@/servicios/marcas/tipos").Guia>()
    .notNull(),
  estudio: text("estudio", { mode: "json" }).$type<
    import("@/servicios/marcas/tipos").Estudio | null
  >(),
  createdAt: integer("created_at").notNull(),
});
export const cuentasMarca = sqliteTable("cuentas_marca", {
  id: text("id").primaryKey(),
  marcaId: text("marca_id")
    .notNull()
    .references(() => marcas.id, { onDelete: "cascade" }),
  red: text("red").$type<import("@/servicios/marcas/tipos").Red>().notNull(),
  alias: text("alias").notNull(),
  remoto: text("remoto").notNull(),
  pagina: text("pagina").notNull().default(""),
  tipo: text("tipo").notNull().default(""),
  estado: text("estado")
    .$type<"pendiente" | "conectada" | "revocada">()
    .notNull()
    .default("pendiente"),
  simulada: integer("simulada", { mode: "boolean" }).notNull().default(true),
  verificada: integer("verificada").notNull().default(0),
});
export const piezasMarca = sqliteTable("piezas_marca", {
  id: text("id").primaryKey(),
  marcaId: text("marca_id")
    .notNull()
    .references(() => marcas.id),
  cuentaId: text("cuenta_id")
    .notNull()
    .references(() => cuentasMarca.id),
  datos: text("datos", { mode: "json" })
    .$type<import("@/servicios/marcas/tipos").PiezaDatos>()
    .notNull(),
  guia: text("guia", { mode: "json" })
    .$type<import("@/servicios/marcas/tipos").Guia>()
    .notNull(),
  revision: integer("revision").notNull().default(1),
  estado: text("estado")
    .$type<
      | "borrador"
      | "pendiente"
      | "programada"
      | "enviando"
      | "procesando"
      | "publicada"
      | "revision"
      | "cancelada"
    >()
    .notNull()
    .default("borrador"),
  aprobadaPor: text("aprobada_por").notNull().default(""),
  aprobadaRevision: integer("aprobada_revision").notNull().default(0),
  revisionDoctrinal: text("revision_doctrinal", { mode: "json" }).$type<
    import("@/servicios/marcas/tipos").RevisionDoctrinal | null
  >(),
  programada: integer("programada").notNull(),
  leaseAt: integer("lease_at").notNull().default(0),
  remoto: text("remoto").notNull().default(""),
  mediosIds: text("medios_ids", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  checkpoint: text("checkpoint", { mode: "json" })
    .$type<import("@/servicios/marcas/tipos").Checkpoint>()
    .notNull()
    .default({}),
  metricas: text("metricas", { mode: "json" }).$type<
    import("@/servicios/marcas/tipos").Metricas | null
  >(),
  aviso: text("aviso").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const citasMarca = sqliteTable("citas_marca", {
  id: text("id").primaryKey(),
  referencia: text("referencia").notNull(),
  version: text("version").notNull(),
  texto: text("texto").notNull(),
  fuente: text("fuente").notNull(),
  revisadaPor: text("revisada_por")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at").notNull(),
});
export type Marca = typeof marcas.$inferSelect;
export type CuentaMarca = typeof cuentasMarca.$inferSelect;
export type PiezaMarca = typeof piezasMarca.$inferSelect;
// Copias exactas de fábrica, separadas de los adjuntos que pueden reutilizarse
// libremente. El acceso siempre pasa por la pieza y revalida la referencia.
export const montajesFabrica = sqliteTable("montajes_fabrica", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  videoId: text("video_id").notNull(),
  revision: text("revision").notNull(),
  sha256: text("sha256").notNull(),
  size: integer("size").notNull(),
  data: text("data").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const marcaIngestas = sqliteTable("marca_ingestas", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  mediaId: text("media_id").notNull(),
  caption: text("caption").notNull(),
  estado: text("estado").notNull().default("pendiente"),
  intentos: integer("intentos").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
