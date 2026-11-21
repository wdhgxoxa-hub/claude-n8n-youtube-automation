import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { z } from "zod";

// Herramienta del operador: no importa db(), no migra y no carga el entorno.
const dias = z.number().int().min(1).max(36500).nullable();
export const politicaRetencionSchema = z
  .object({
    version: z.literal(1),
    modo: z.literal("simular"),
    dias: z
      .object({
        adjunto: dias,
        mensaje: dias,
        memoria: dias,
        activo: dias,
        derivado: dias,
        consentimiento: z.null(),
        ingesta: dias,
        aviso: dias,
      })
      .strict(),
    excepciones: z
      .object({
        duenos: z.array(z.string().min(1).max(200)).max(100),
        recursos: z.array(z.string().min(1).max(500)).max(1000),
      })
      .strict(),
  })
  .strict();
export type PoliticaRetencion = z.infer<typeof politicaRetencionSchema>;
type Categoria = keyof PoliticaRetencion["dias"];
type Fila = Record<string, string | number | null>;
type Referencia = { origen: string; dueno: string; uso: string };
type Recurso = {
  clave: string;
  dueno: string;
  categoria: Categoria;
  fecha: number | null;
  bytes: number | null;
  referencias: Referencia[];
  bloqueos: string[];
};
const sha = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const numero = (value: Fila[string]) => Number(value ?? 0);
const cadena = (value: Fila[string]) => String(value ?? "");
const identificadores = z.array(z.string().min(1).max(200));
function lista(raw: Fila[string]): string[] {
  return identificadores.parse(JSON.parse(cadena(raw)));
}
const DIA = 86400000;

export function simularRetencion(
  ruta: string,
  entrada: unknown,
  ahora = Date.now(),
) {
  const politica = politicaRetencionSchema.parse(entrada);
  if (!Number.isSafeInteger(ahora) || ahora <= 0)
    throw new Error("Fecha de corte inválida.");
  const sqlite = new Database(ruta, { readonly: true, fileMustExist: true });
  try {
    sqlite.pragma("query_only = ON");
    // Una sola instantánea de lectura; nunca se toman decisiones entre consultas de cortes distintos.
    return sqlite.transaction(() => inventariar(sqlite, politica, ahora))();
  } finally {
    sqlite.close();
  }
}

function inventariar(
  sqlite: Database.Database,
  politica: PoliticaRetencion,
  ahora: number,
) {
  if ((sqlite.pragma("foreign_key_check") as unknown[]).length)
    throw new Error("Referencias relacionales inconsistentes.");
  const leer = (sql: string) => sqlite.prepare(sql).all() as Fila[];
  const recursos = new Map<string, Recurso>();
  const operaciones = new Map<string, Set<string>>();
  const enlaces: { destino: string; referencia: Referencia }[] = [];
  const incidencias: { tipo: string; origen: string; destino: string }[] = [];
  const agregar = (
    tabla: string,
    row: Fila,
    categoria: Categoria,
    fecha: number | null,
    bytes: number | null = null,
    bloqueos: string[] = [],
  ) => {
    const clave = `${tabla}:${row.id}`;
    recursos.set(clave, {
      clave,
      dueno: cadena(row.owner_id),
      categoria,
      fecha,
      bytes,
      referencias: [],
      bloqueos,
    });
    return clave;
  };
  const enlazar = (
    destino: string,
    origen: string,
    dueno: string,
    uso: string,
  ) => {
    if (destino.split(":").slice(1).join(":"))
      enlaces.push({ destino, referencia: { origen, dueno, uso } });
  };
  const operacion = (dueno: string, clave: string) => {
    if (!operaciones.has(dueno)) operaciones.set(dueno, new Set());
    operaciones.get(dueno)!.add(clave);
  };

  // Solo proyecciones de metadatos: nunca SELECT *, BLOB/base64, mensajes, URLs ni teléfonos.
  for (const row of leer(
    "SELECT id, owner_id, size FROM attachments ORDER BY id",
  ))
    agregar("attachments", row, "adjunto", null, numero(row.size));

  for (const row of leer(`SELECT m.id, m.owner_id, m.created_at, m.attachment_ids,
      length(CAST(m.content AS BLOB)) AS bytes, COALESCE(s.memory_after, 0) AS corte
      FROM messages m LEFT JOIN chat_sessions s ON s.owner_id = m.owner_id ORDER BY m.id`)) {
    const clave = agregar(
      "messages",
      row,
      "mensaje",
      numero(row.created_at),
      numero(row.bytes),
      numero(row.created_at) <= numero(row.corte)
        ? []
        : ["historial_recordable"],
    );
    for (const id of lista(row.attachment_ids))
      enlazar(
        `attachments:${id}`,
        clave,
        cadena(row.owner_id),
        "mensaje_conservado",
      );
  }
  for (const row of leer(`SELECT owner_id, scope AS id, updated_at,
      length(CAST(summary AS BLOB)) AS bytes FROM chat_memories ORDER BY owner_id, scope`))
    agregar(
      "chat_memories",
      { ...row, id: `${row.owner_id}:${row.id}` },
      "memoria",
      numero(row.updated_at),
      numero(row.bytes),
      ["memoria_activa"],
    );

  for (const row of leer(`SELECT id, owner_id, created_at, evidence_id, photo_id, photo_ids,
      status, shared, consent_at, consent_revoked_at,
      length(CAST(preview_data AS BLOB)) AS bytes_preview,
      length(preview_url) > 0 AS remoto FROM assets ORDER BY id`)) {
    const dueno = cadena(row.owner_id);
    const clave = agregar(
      "assets",
      row,
      "activo",
      numero(row.created_at),
      null,
      [
        "activo_conservado",
        ...(numero(row.consent_revoked_at) ? ["consentimiento_revocado"] : []),
      ],
    );
    if (!["listo", "rechazado"].includes(cadena(row.status)))
      operacion(dueno, clave);
    if (numero(row.shared)) recursos.get(clave)!.bloqueos.push("compartido");
    for (const id of new Set([
      cadena(row.evidence_id),
      cadena(row.photo_id),
      ...lista(row.photo_ids),
    ])) {
      enlazar(
        `attachments:${id}`,
        clave,
        dueno,
        id === row.evidence_id ? "evidencia_identidad" : "original_biblioteca",
      );
      if (id && numero(row.consent_revoked_at))
        recursos
          .get(`attachments:${id}`)
          ?.bloqueos.push("consentimiento_revocado");
    }
    // Consentimiento vive en assets; una vista del mismo registro, sin duplicar bytes.
    agregar(
      "consentimientos",
      row,
      "consentimiento",
      numero(row.consent_at) || null,
      null,
      ["consentimiento_protegido"],
    );
    if (numero(row.bytes_preview) || numero(row.remoto)) {
      const preview = agregar(
        "vistas_previas",
        row,
        "derivado",
        null,
        numero(row.bytes_preview),
      );
      enlazar(preview, clave, dueno, "vista_previa_activa");
      if (numero(row.remoto))
        recursos.get(preview)!.bloqueos.push("copia_remota_no_inspeccionada");
    }
  }
  for (const row of leer(
    `SELECT id, owner_id, used_at FROM identity_challenges ORDER BY id`,
  ))
    agregar(
      "identity_challenges",
      row,
      "consentimiento",
      numero(row.used_at) || null,
      null,
      ["evidencia_identidad_protegida"],
    );
  for (const row of leer(
    `SELECT owner_id AS id, owner_id, consent_at FROM whatsapp_contacts ORDER BY owner_id`,
  ))
    agregar(
      "whatsapp_contacts",
      row,
      "consentimiento",
      numero(row.consent_at) || null,
      null,
      ["consentimiento_protegido"],
    );

  for (const row of leer(`SELECT id, CASE WHEN image LIKE '/api/archivos/%'
      THEN substr(image, 15) ELSE '' END AS archivo FROM users ORDER BY id`))
    enlazar(
      `attachments:${row.archivo}`,
      `users:${row.id}`,
      cadena(row.id),
      "foto_perfil",
    );

  for (const row of leer(
    `SELECT id, owner_id, json_extract(guia, '$.logoId') AS logo FROM marcas ORDER BY id`,
  ))
    enlazar(
      `attachments:${row.logo ?? ""}`,
      `marcas:${row.id}`,
      cadena(row.owner_id),
      "logo_marca",
    );
  for (const row of leer(`SELECT p.id, m.owner_id, p.estado, p.medios_ids,
      json_extract(p.datos, '$.adjuntos') AS adjuntos,
      json_extract(p.datos, '$.videoId') AS video_id,
      json_extract(p.datos, '$.montaje.revision') AS montaje_revision,
      json_extract(p.guia, '$.logoId') AS logo
      FROM piezas_marca p JOIN marcas m ON m.id = p.marca_id ORDER BY p.id`)) {
    const clave = `piezas_marca:${row.id}`,
      dueno = cadena(row.owner_id);
    // Incluso las canceladas y publicadas conservan referencias revisables y su historia.
    if (!["publicada", "cancelada"].includes(cadena(row.estado)))
      operacion(dueno, clave);
    for (const id of lista(row.medios_ids)) {
      const recurso = recursos.get(`attachments:${id}`);
      if (recurso) recurso.categoria = "derivado";
      enlazar(`attachments:${id}`, clave, dueno, "derivado_marca");
    }
    for (const id of [...lista(row.adjuntos ?? "[]"), cadena(row.logo)])
      enlazar(`attachments:${id}`, clave, dueno, "original_pieza");
    // La selección conserva exactamente la revisión, aunque después cambie el video.
    for (const montaje of sqlite
      .prepare(
        "SELECT id FROM montajes_fabrica WHERE owner_id = ? AND video_id = ? AND revision = ?",
      )
      .all(dueno, cadena(row.video_id), cadena(row.montaje_revision)) as Fila[])
      enlazar(`montajes_fabrica:${montaje.id}`, clave, dueno, "montaje_pieza");
  }
  for (const row of leer(`SELECT m.id, m.owner_id, m.video_id, m.created_at,
      length(CAST(m.data AS BLOB)) AS bytes, v.id AS origen
      FROM montajes_fabrica m LEFT JOIN videos v
        ON v.id = m.video_id AND v.owner_id = m.owner_id ORDER BY m.id`)) {
    const clave = agregar(
      "montajes_fabrica",
      row,
      "derivado",
      numero(row.created_at),
      numero(row.bytes),
      row.origen ? [] : ["origen_video_no_disponible"],
    );
    if (row.origen)
      enlazar(
        clave,
        `videos:${row.video_id}`,
        cadena(row.owner_id),
        "montaje_video",
      );
  }
  const remotos = leer(`SELECT v.id, v.owner_id,
      (SELECT count(*) FROM json_tree(v.observability) j
        WHERE j.key IN ('montaje', 'miniatura', 'imagen', 'clip', 'voz', 'url')
        AND j.type = 'text' AND length(j.atom) > 0) AS referencias
      FROM videos v ORDER BY v.id`);
  for (const row of leer(
    `SELECT id, owner_id, avatar_id, voice_id, stage, production_state FROM videos ORDER BY id`,
  )) {
    const clave = `videos:${row.id}`,
      dueno = cadena(row.owner_id);
    for (const id of [cadena(row.avatar_id), cadena(row.voice_id)]) {
      // El catálogo público no corresponde a filas propias de assets.
      if (recursos.has(`assets:${id}`))
        enlazar(`assets:${id}`, clave, dueno, "presentacion_video");
    }
    if (numero(row.stage) < 11 && row.production_state !== "cancelada")
      operacion(dueno, clave);
  }
  for (const row of leer(
    "SELECT id, owner_id, estado, created_at FROM marca_ingestas ORDER BY id",
  )) {
    const clave = agregar(
      "marca_ingestas",
      row,
      "ingesta",
      numero(row.created_at),
    );
    if (!["completa", "fallida", "cancelada"].includes(cadena(row.estado)))
      operacion(cadena(row.owner_id), clave);
  }
  for (const row of leer(
    "SELECT id, owner_id, state, created_at FROM whatsapp_outbox ORDER BY id",
  )) {
    const clave = agregar(
      "whatsapp_outbox",
      row,
      "aviso",
      numero(row.created_at),
      null,
      ["trazabilidad_entrega"],
    );
    if (!["aceptado", "cancelado", "fallido"].includes(cadena(row.state)))
      operacion(cadena(row.owner_id), clave);
  }
  // Compatible con copias anteriores a la recepción durable de conversaciones.
  if (
    leer("SELECT name FROM sqlite_master WHERE name = 'whatsapp_chat_jobs'")
      .length
  )
    for (const row of leer(
      "SELECT id, owner_id, state, created_at FROM whatsapp_chat_jobs ORDER BY id",
    )) {
      const clave = agregar(
        "whatsapp_chat_jobs",
        row,
        "mensaje",
        numero(row.created_at),
        null,
        ["trazabilidad_recepcion"],
      );
      if (!["completado", "cancelado", "fallido"].includes(cadena(row.state)))
        operacion(cadena(row.owner_id), clave);
    }
  for (const row of leer(
    "SELECT owner_id, busy_until FROM chat_sessions ORDER BY owner_id",
  ))
    if (numero(row.busy_until) > ahora)
      operacion(cadena(row.owner_id), "chat_sessions:turno_activo");
  for (const row of leer(
    `SELECT id, owner_id FROM chat_actions WHERE status NOT IN ('confirmada', 'cancelada', 'vencida') ORDER BY id`,
  ))
    operacion(cadena(row.owner_id), `chat_actions:${row.id}`);
  for (const row of leer(
    "SELECT id, owner_id FROM bridge_commands WHERE confirmed = 0 ORDER BY id",
  ))
    operacion(cadena(row.owner_id), `bridge_commands:${row.id}`);
  for (const row of leer(
    "SELECT id, owner_id FROM whatsapp_actions WHERE state <> 'completada' ORDER BY id",
  ))
    operacion(cadena(row.owner_id), `whatsapp_actions:${row.id}`);

  for (const { destino, referencia } of enlaces) {
    const recurso = recursos.get(destino);
    if (!recurso) {
      incidencias.push({
        tipo: "referencia_sin_destino",
        origen: referencia.origen,
        destino,
      });
      continue;
    }
    recurso.referencias.push(referencia);
    if (referencia.dueno !== recurso.dueno)
      recurso.bloqueos.push("referencia_otro_dueno");
    if (referencia.uso === "evidencia_identidad")
      recurso.bloqueos.push("evidencia_identidad_protegida");
  }
  // Un consumidor ajeno en curso protege también originales y vistas del activo compartido.
  for (const recurso of recursos.values()) {
    if (recurso.categoria !== "activo") continue;
    if (recurso.referencias.some((r) => operaciones.has(r.dueno))) {
      recurso.bloqueos.push("consumidor_en_curso");
      for (const dependiente of recursos.values())
        if (dependiente.referencias.some((r) => r.origen === recurso.clave))
          dependiente.bloqueos.push("consumidor_en_curso");
    }
  }

  const items = [...recursos.values()]
    .sort((a, b) => a.clave.localeCompare(b.clave))
    .map((r) => {
      const bloqueos = new Set(r.bloqueos);
      const plazo = politica.dias[r.categoria];
      if (r.referencias.length) bloqueos.add("referencias_conservadas");
      if (operaciones.has(r.dueno))
        bloqueos.add("operacion_en_curso_o_incierta");
      if (incidencias.length) bloqueos.add("inventario_inconsistente");
      if (
        politica.excepciones.duenos.includes(r.dueno) ||
        politica.excepciones.recursos.includes(r.clave)
      )
        bloqueos.add("excepcion_politica");
      if (!r.fecha || r.fecha > ahora)
        bloqueos.add("fecha_desconocida_o_invalida");
      if (plazo === null) bloqueos.add("retencion_sin_plazo");
      else if (r.fecha && ahora - r.fecha < plazo * DIA)
        bloqueos.add("dentro_del_plazo");
      const huerfano =
        r.clave.startsWith("attachments:") && !r.referencias.length;
      return {
        ...r,
        referencias: r.referencias.sort((a, b) =>
          a.origen.localeCompare(b.origen),
        ),
        bloqueos: [...bloqueos].sort(),
        huerfano,
        decision: bloqueos.size
          ? ("conservar" as const)
          : ("candidato_simulado" as const),
      };
    });
  const duenos = [...new Set(items.map((r) => r.dueno))].sort().map((dueno) => {
    const propios = items.filter((r) => r.dueno === dueno);
    return {
      dueno,
      recursos: propios.length,
      bytesConocidos: propios.reduce((n, r) => n + (r.bytes ?? 0), 0),
      huerfanos: propios.filter((r) => r.huerfano).length,
      candidatos: propios.filter((r) => r.decision === "candidato_simulado")
        .length,
      operaciones: [...(operaciones.get(dueno) ?? [])].sort(),
    };
  });
  const metadatos = { items, remotos, incidencias, duenos };
  return {
    version: 1,
    modo: "simular",
    borradoHabilitado: false,
    corte: new Date(ahora).toISOString(),
    politica,
    huellaPolitica: sha(politica),
    huellaInventario: sha(metadatos),
    ...metadatos,
    limites: [
      "Solo proyección SQLite local; no inspecciona n8n, proveedores, disco temporal ni copias.",
      "Adjuntos sin fecha ni procedencia histórica: un huérfano no es prueba de que pueda borrarse.",
      "Bytes de contenido y base64 almacenado; no representan espacio recuperable ni tamaño total SQLite.",
      "Consentimientos y evidencias se conservan; la revocación no autoriza purgar.",
      "Candidatos informativos: no hay ejecutor de borrado ni caducidad automática; B08 pendiente.",
    ],
  };
}
