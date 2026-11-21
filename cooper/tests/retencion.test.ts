import { afterEach, beforeEach, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { aplicarMigraciones } from "@/db/migraciones";
import {
  simularRetencion,
  politicaRetencionSchema,
  type PoliticaRetencion,
} from "@/servicios/retencion";
import ejemplo from "../retencion.example.json";

const ahora = Date.UTC(2026, 10, 21, 17);
const viejo = ahora - 100 * 86400000;
let carpeta: string, ruta: string, sql: Database.Database;
const politica = (): PoliticaRetencion =>
  politicaRetencionSchema.parse({
    ...structuredClone(ejemplo),
    dias: { ...ejemplo.dias, mensaje: 30, ingesta: 7 },
  });
const informe = (p: unknown = politica()) => simularRetencion(ruta, p, ahora);
const buscar = (clave: string) =>
  informe().items.find((r) => r.clave === clave)!;
const huella = () =>
  createHash("sha256").update(readFileSync(ruta)).digest("hex");
function adjunto(id: string, dueno = "ana") {
  sql
    .prepare(
      "INSERT INTO attachments(id,owner_id,name,mime,size,data) VALUES (?,?,'NOMBRE_PRIVADO','image/png',12,'BASE64_PRIVADO')",
    )
    .run(id, dueno);
}
function mensaje(
  id: string,
  adjuntos: string[] = [],
  fecha = viejo,
  dueno = "ana",
) {
  sql
    .prepare(
      "INSERT INTO messages(id,owner_id,role,content,attachment_ids,created_at) VALUES (?,?,'user','MENSAJE_PRIVADO',?,?)",
    )
    .run(id, dueno, JSON.stringify(adjuntos), fecha);
}
function activo(revocado = false) {
  sql
    .prepare(
      `INSERT INTO assets(id,owner_id,kind,name,evidence_id,photo_id,photo_ids,created_at,
    consent_at,consent_text,consent_revoked_at,shared,preview_data,preview_url)
    VALUES ('avatar','ana','avatar','NOMBRE_PRIVADO','prueba','foto','["foto"]',?,?,'CONSENTIMIENTO_PRIVADO',?,1,'VISTA_PRIVADA','https://privado.test/?token=VALOR_PRIVADO')`,
    )
    .run(viejo, viejo, revocado ? ahora - 100 : 0);
}
function marca() {
  sql
    .prepare(
      `INSERT INTO marcas(id,owner_id,nombre,rubro,zona,guia,created_at)
    VALUES ('marca','ana','Nombre','general','America/Lima','{"logoId":"logo"}',?)`,
    )
    .run(viejo);
  sql.exec(
    `INSERT INTO cuentas_marca(id,marca_id,red,alias,remoto) VALUES ('cuenta','marca','instagram','alias','remoto');`,
  );
  sql
    .prepare(
      `INSERT INTO piezas_marca(id,marca_id,cuenta_id,datos,guia,estado,programada,medios_ids,created_at,updated_at)
    VALUES ('pieza','marca','cuenta','{"adjuntos":["foto"]}','{"logoId":"logo-anterior"}','publicada',0,'["render"]',?,?)`,
    )
    .run(viejo, viejo);
}

beforeEach(() => {
  carpeta = mkdtempSync(".cache/retencion-");
  ruta = resolve(carpeta, "fixture.sqlite");
  sql = new Database(ruta);
  sql.pragma("foreign_keys = ON");
  aplicarMigraciones(sql, resolve("drizzle"));
  sql.exec(`INSERT INTO users(id,email,name) VALUES ('ana','ana@example.test','Ana'),('bea','bea@example.test','Bea');
    INSERT INTO chat_sessions(owner_id,memory_after) VALUES ('ana',${ahora - 1});`);
});
afterEach(() => {
  if (sql.open) sql.close();
});

it("la política predeterminada conserva y nunca habilita borrado", () => {
  adjunto("huerfano");
  mensaje("antiguo");
  const previo = huella(),
    r = informe(ejemplo);
  expect(r.borradoHabilitado).toBe(false);
  expect(r.items.every((v) => v.decision === "conservar")).toBe(true);
  expect(r.items.find((v) => v.clave === "attachments:huerfano")).toMatchObject(
    { huerfano: true, fecha: null },
  );
  expect(huella()).toBe(previo);
  expect(r).toEqual(informe(ejemplo));
});

it("separa dueños y cuenta bytes sin exportar cuerpos, evidencias, nombres ni URLs", () => {
  adjunto("foto");
  adjunto("prueba");
  adjunto("otro", "bea");
  activo();
  mensaje("uno", ["foto"]);
  const r = informe(),
    texto = JSON.stringify(r);
  expect(r.duenos.map((d) => d.dueno)).toEqual(["ana", "bea"]);
  expect(r.duenos.find((d) => d.dueno === "bea")).toMatchObject({
    bytesConocidos: 12,
    huerfanos: 1,
  });
  for (const privado of [
    "MENSAJE_PRIVADO",
    "NOMBRE_PRIVADO",
    "BASE64_PRIVADO",
    "CONSENTIMIENTO_PRIVADO",
    "VISTA_PRIVADA",
    "VALOR_PRIVADO",
    "example.test",
    "https://",
  ])
    expect(texto).not.toContain(privado);
});

it("solo propone mensajes anteriores al olvido y respeta el plazo", () => {
  mensaje("olvidado");
  mensaje("reciente", [], ahora - 86400000);
  mensaje("nuevo", [], ahora);
  expect(buscar("messages:olvidado").decision).toBe("candidato_simulado");
  expect(buscar("messages:reciente").bloqueos).toContain("dentro_del_plazo");
  expect(buscar("messages:nuevo").bloqueos).toContain("historial_recordable");
  sql.exec("DELETE FROM chat_sessions");
  expect(buscar("messages:olvidado").bloqueos).toContain(
    "historial_recordable",
  );
});

it("conserva referencias compartidas después de borrar un mensaje y detecta el huérfano al quitar la última", () => {
  adjunto("foto");
  mensaje("uno", ["foto"]);
  mensaje("dos", ["foto"]);
  expect(buscar("attachments:foto").referencias).toHaveLength(2);
  sql.exec("DELETE FROM messages WHERE id='uno'");
  expect(buscar("attachments:foto").referencias).toHaveLength(1);
  expect(buscar("attachments:foto").huerfano).toBe(false);
  sql.exec("DELETE FROM messages WHERE id='dos'");
  expect(buscar("attachments:foto")).toMatchObject({
    huerfano: true,
    decision: "conservar",
    fecha: null,
  });
});

it("no convierte la revocación en autorización de purga de originales o consentimiento", () => {
  adjunto("foto");
  adjunto("prueba");
  activo(true);
  expect(buscar("attachments:foto").bloqueos).toContain(
    "consentimiento_revocado",
  );
  expect(buscar("attachments:prueba").bloqueos).toContain(
    "evidencia_identidad_protegida",
  );
  expect(buscar("consentimientos:avatar").bloqueos).toContain(
    "consentimiento_protegido",
  );
});

it("registra perfil, logo vigente, logo de revisión, originales y derivados de piezas publicadas", () => {
  for (const id of ["perfil", "logo", "logo-anterior", "foto", "render"])
    adjunto(id);
  sql.exec("UPDATE users SET image='/api/archivos/perfil' WHERE id='ana'");
  marca();
  for (const id of ["perfil", "logo", "logo-anterior", "foto", "render"])
    expect(buscar(`attachments:${id}`).huerfano).toBe(false);
  expect(buscar("attachments:render").categoria).toBe("derivado");
  sql.exec("UPDATE piezas_marca SET estado='cancelada'");
  expect(buscar("attachments:render").referencias[0].uso).toBe(
    "derivado_marca",
  );
});

it("protege originales de un activo compartido consumido por otro dueño en producción", () => {
  adjunto("foto");
  adjunto("prueba");
  activo();
  sql
    .prepare(
      "INSERT INTO channels(id,owner_id,name,niche,created_at) VALUES ('canal','bea','Canal','Nicho',?)",
    )
    .run(viejo);
  sql
    .prepare(
      "INSERT INTO videos(id,owner_id,channel_id,title,script,avatar_id,stage,created_at,updated_at) VALUES ('video','bea','canal','Titulo','GUION_PRIVADO','avatar',4,?,?)",
    )
    .run(viejo, viejo);
  expect(buscar("assets:avatar").bloqueos).toContain("referencia_otro_dueno");
  expect(buscar("attachments:foto").bloqueos).toContain("consumidor_en_curso");
  expect(buscar("vistas_previas:avatar").bloqueos).toContain(
    "consumidor_en_curso",
  );
});

it.each([
  [
    "chat activo",
    `UPDATE chat_sessions SET lease='ensayo',busy_until=${ahora + 1000}`,
  ],
  [
    "acción incierta",
    `INSERT INTO chat_actions(id,owner_id,tool,arguments,fingerprint,channel_id,title,detail,status,expires_at,created_at) VALUES ('accion','ana','nuevo_video','{}','','','','','revisar',0,1)`,
  ],
  [
    "reserva puente",
    `INSERT INTO bridge_commands(id,owner_id,request,created_at) VALUES ('orden','ana','{}',1)`,
  ],
  [
    "ingesta",
    `INSERT INTO marca_ingestas(id,owner_id,media_id,caption,estado,created_at) VALUES ('ingesta','ana','remoto','PRIVADO','descargando',1)`,
  ],
  [
    "entrega incierta",
    `INSERT INTO whatsapp_outbox(id,dedupe_key,owner_id,phone,kind,state,next_at,expires_at,created_at) VALUES ('aviso','dedupe','ana','TELEFONO_PRIVADO','marca','incierto',0,0,1)`,
  ],
  [
    "acción WhatsApp",
    `INSERT INTO whatsapp_actions(id,owner_id,decision,state,created_at) VALUES ('accion','ana','privada','incierta',1)`,
  ],
])("bloquea candidatos del dueño mientras hay %s", (_, comando) => {
  mensaje("olvidado");
  sql.exec(comando);
  expect(buscar("messages:olvidado").bloqueos).toContain(
    "operacion_en_curso_o_incierta",
  );
  expect(buscar("messages:olvidado").decision).toBe("conservar");
});

it.each(["completa", "fallida", "cancelada"])(
  "retiene memoria y permite simular la ingesta %s sin tocar sus cuerpos",
  (estado) => {
    sql
      .prepare(
        "INSERT INTO chat_memories(owner_id,scope,summary,updated_at) VALUES ('ana','','RESUMEN_PRIVADO',?)",
      )
      .run(viejo);
    sql
      .prepare(
        "INSERT INTO marca_ingestas(id,owner_id,media_id,caption,estado,created_at) VALUES ('ingesta','ana','remoto','CAPTION_PRIVADO',?,?)",
      )
      .run(estado, viejo);
    expect(buscar("marca_ingestas:ingesta").decision).toBe(
      "candidato_simulado",
    );
    expect(buscar("chat_memories:ana:").bloqueos).toContain("memoria_activa");
    expect(JSON.stringify(informe())).not.toContain("RESUMEN_PRIVADO");
  },
);

it("inventaría montajes privados por revisión y protege su video y piezas sin exportar el contenido", () => {
  marca();
  sql.exec(`INSERT INTO channels(id,owner_id,name,niche,created_at) VALUES ('canal','ana','Canal','Nicho',1);
    INSERT INTO videos(id,owner_id,channel_id,title,script,stage,created_at,updated_at) VALUES ('video','ana','canal','Titulo','GUION_PRIVADO',11,1,1);`);
  const insertar =
    sql.prepare(`INSERT INTO montajes_fabrica(id,owner_id,video_id,revision,sha256,size,data,created_at)
    VALUES (?,'ana',?,?,'HUELLA_PRIVADA',12,'MONTAJE_PRIVADO',?)`);
  insertar.run("elegido", "video", "revision-1", viejo);
  insertar.run("nuevo", "video", "revision-2", viejo);
  insertar.run("sin-origen", "video-retirado", "revision-1", viejo);
  sql.exec(`UPDATE piezas_marca SET datos='{"videoId":"video","montaje":{"revision":"revision-1"}}',guia='{}',medios_ids='[]';
    UPDATE marcas SET guia='{}';`);
  const antes = huella();
  expect(buscar("montajes_fabrica:elegido")).toMatchObject({
    categoria: "derivado",
    bytes: 15,
    decision: "conservar",
    referencias: [
      { origen: "piezas_marca:pieza", dueno: "ana", uso: "montaje_pieza" },
      { origen: "videos:video", dueno: "ana", uso: "montaje_video" },
    ],
  });
  expect(buscar("montajes_fabrica:nuevo").referencias).toHaveLength(1);
  expect(buscar("montajes_fabrica:sin-origen").bloqueos).toContain(
    "origen_video_no_disponible",
  );
  expect(JSON.stringify(informe())).not.toContain("PRIVADO");
  expect(huella()).toBe(antes);
});

it("libera bloqueos completados y no bloquea mensajes de otro dueño", () => {
  mensaje("olvidado");
  sql.exec(`INSERT INTO whatsapp_actions(id,owner_id,decision,state,created_at)
    VALUES ('cerrada','ana','privada','completada',1),('abierta','bea','privada','incierta',1);
    INSERT INTO bridge_commands(id,owner_id,request,confirmed,created_at) VALUES ('cerrado','ana','{}',1,1);`);
  expect(buscar("messages:olvidado").decision).toBe("candidato_simulado");
  sql.exec(
    "UPDATE whatsapp_actions SET state='nuevo_estado_desconocido' WHERE id='cerrada'",
  );
  expect(buscar("messages:olvidado").bloqueos).toContain(
    "operacion_en_curso_o_incierta",
  );
});

it("no permite que un plazo positivo vuelva elegible un adjunto sin fecha", () => {
  adjunto("antiguedad-desconocida");
  const p = politica();
  p.dias.adjunto = 1;
  expect(informe(p).items[0]).toMatchObject({
    decision: "conservar",
    huerfano: true,
    fecha: null,
  });
  expect(informe(p).items[0].bloqueos).toContain(
    "fecha_desconocida_o_invalida",
  );
});

it("cuenta medios remotos sin recuperar ni registrar sus URLs", () => {
  sql
    .prepare(
      "INSERT INTO channels(id,owner_id,name,niche,created_at) VALUES ('canal','ana','Canal','Nicho',?)",
    )
    .run(viejo);
  sql
    .prepare(
      `INSERT INTO videos(id,owner_id,channel_id,title,script,stage,observability,created_at,updated_at)
    VALUES ('video','ana','canal','Titulo','GUION_PRIVADO',11,?, ?,?)`,
    )
    .run(
      JSON.stringify({
        montaje: "https://privado.test/TOKEN_PRIVADO",
        escenas: [{ imagen: "https://privado.test/OTRO_PRIVADO", clip: "" }],
      }),
      viejo,
      viejo,
    );
  expect(informe().remotos).toEqual([
    { id: "video", owner_id: "ana", referencias: 2 },
  ]);
  expect(JSON.stringify(informe())).not.toContain("PRIVADO");
});

it("rechaza una base incompleta sin migrarla y una relación rota sin dar candidatos", () => {
  sql.exec("DROP TABLE chat_memories");
  const antes = huella();
  expect(() => informe()).toThrow();
  expect(huella()).toBe(antes);
  sql.pragma("foreign_keys = OFF");
  mensaje("sin-dueno", [], viejo, "inexistente");
  expect(() => informe()).toThrow("Referencias relacionales inconsistentes.");
});

it("aplica excepciones por dueño/recurso y huellas auditables de política e inventario", () => {
  mensaje("olvidado");
  const inicial = informe();
  const p = politica();
  p.excepciones.recursos = ["messages:olvidado"];
  const exceptuado = informe(p);
  expect(exceptuado.items[0].bloqueos).toContain("excepcion_politica");
  expect(exceptuado.huellaPolitica).not.toBe(inicial.huellaPolitica);
  const otro = politica();
  otro.excepciones.duenos = ["ana"];
  expect(informe(otro).items[0].bloqueos).toContain("excepcion_politica");
  mensaje("segundo");
  expect(informe().huellaInventario).not.toBe(inicial.huellaInventario);
});

it("no declara elegibles los datos con referencias rotas o JSON ilegible", () => {
  mensaje("olvidado", ["ausente"]);
  expect(buscar("messages:olvidado").bloqueos).toContain(
    "inventario_inconsistente",
  );
  expect(informe().incidencias).toHaveLength(1);
  sql.exec("UPDATE messages SET attachment_ids='JSON_PRIVADO_ROTO'");
  expect(() => informe()).toThrow();
});

it("rechaza purga, plazos inválidos, claves desconocidas y consentimiento con plazo", () => {
  for (const p of [
    { ...ejemplo, modo: "borrar" },
    { ...ejemplo, ejecutar: true },
    { ...ejemplo, dias: { ...ejemplo.dias, mensaje: -1 } },
    { ...ejemplo, dias: { ...ejemplo.dias, consentimiento: 30 } },
  ])
    expect(politicaRetencionSchema.safeParse(p).success).toBe(false);
});

it("ensaya borrado solo en fixture y recuperación íntegra desde una copia SQLite", async () => {
  adjunto("foto");
  mensaje("olvidado", ["foto"]);
  const previo = informe(),
    copia = resolve(carpeta, "respaldo.sqlite");
  await sql.backup(copia);
  // La herramienta no ejecuta esto: el test representa una futura acción aprobada.
  sql.prepare("DELETE FROM messages WHERE id=?").run("olvidado");
  expect(buscar("attachments:foto").huerfano).toBe(true);
  sql.close();
  copyFileSync(copia, ruta);
  sql = new Database(ruta);
  expect(informe()).toEqual(previo);
  expect(
    sql.prepare("SELECT content FROM messages WHERE id='olvidado'").get(),
  ).toEqual({ content: "MENSAJE_PRIVADO" });
});

it("CLI exige simulación, no sobrescribe, no crea bases, guarda 0600 y oculta errores privados", () => {
  mensaje("olvidado");
  const config = resolve(carpeta, "politica.json"),
    salida = resolve(carpeta, "informe.json");
  writeFileSync(config, JSON.stringify(politica()));
  const ejecutar = (...extra: string[]) =>
    spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/retencion.ts",
        "--base",
        ruta,
        "--politica",
        config,
        "--salida",
        salida,
        ...extra,
      ],
      { encoding: "utf8" },
    );
  const antes = huella();
  expect(ejecutar().status).toBe(1);
  expect(existsSync(salida)).toBe(false);
  expect(ejecutar("--simular", "--ejecutar").status).toBe(1);
  expect(ejecutar("--simular").status).toBe(0);
  expect(statSync(salida).mode & 0o777).toBe(0o600);
  const guardado = readFileSync(salida, "utf8");
  expect(ejecutar("--simular").status).toBe(1);
  expect(readFileSync(salida, "utf8")).toBe(guardado);
  expect(huella()).toBe(antes);
  sql.exec("UPDATE messages SET attachment_ids='VALOR_PRIVADO_ROTO'");
  const error = ejecutar("--simular");
  expect(error.status).toBe(1);
  expect(error.stderr).not.toContain("VALOR_PRIVADO_ROTO");
  const ausente = resolve(carpeta, "ausente.sqlite");
  expect(() => simularRetencion(ausente, politica())).toThrow();
  expect(existsSync(ausente)).toBe(false);
});
