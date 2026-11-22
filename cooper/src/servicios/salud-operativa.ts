// Solo servidor: este módulo importa Node/SQLite; el cliente importa únicamente el contrato.
import { formatoMoneda, formatoPorcentaje } from "@/lib/cifras";
import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { z } from "@/contratos/validacion";
import { estadoRemotoSchema } from "@/contratos/puente";
import {
  umbralesSaludSchema,
  type AlertaSalud,
  type EjecucionSalud,
  type SaludOperativa,
  type UmbralesSalud,
  type VideoSalud,
} from "@/contratos/salud-operativa";
import { db } from "@/db";
import { videos, type User } from "@/db/schema";
import { requireAdmin } from "@/lib/permisos";
import { FabricaN8n } from "./fabrica";
import { leerOperacion } from "./operacion";
import { administracion } from "./datos";
import { cuentaActiva } from "./mensajeria/cuentas";

const MINUTO = 60_000;
const DIA = 24 * 60 * MINUTO;
const remoto = () =>
  process.env.COOPER_FABRICA === "n8n" && process.env.COOPER_DEMO !== "1";
const fecha = z.iso.datetime({ offset: true });
const identificador = z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/);
const etiqueta = (valor: string) =>
  valor
    .replace(
      /https?:\/\/\S+|\b(?:bearer|token|secret|password|api[_ -]?key)\s*[:=]?\s*\S+/gi,
      "[dato reservado]",
    )
    .replace(/[\r\n\t]/g, " ")
    .slice(0, 160);
function iso(valor: unknown): string | null {
  if (typeof valor !== "string" || !fecha.safeParse(valor).success) return null;
  return new Date(valor).toISOString();
}
function antiguedad(valor: string | null, ahora: number, unidad: number) {
  if (!valor) return null;
  const milisegundos = ahora - Date.parse(valor);
  return milisegundos < -MINUTO ? null : Math.max(0, milisegundos / unidad);
}

class FalloFuente extends Error {
  constructor(
    readonly tipo:
      "configuracion" | "permiso" | "limite" | "respuesta" | "conexion",
  ) {
    super(tipo);
  }
}
const fallosLegibles = {
  configuracion: "La configuración de lectura de n8n no es válida.",
  permiso: "n8n rechazó el permiso de lectura. Revisa la clave y sus alcances.",
  limite:
    "n8n alcanzó su límite de consultas. Se volverá a comprobar en el próximo ciclo.",
  respuesta:
    "n8n no devolvió una respuesta válida dentro del límite permitido.",
  conexion:
    "No se pudo completar la lectura de n8n. Revisa la conexión y el servicio.",
};
function configurarN8n() {
  const direccion = process.env.COOPER_N8N_API_URL;
  const clave = process.env.COOPER_N8N_API_KEY;
  if (!direccion && !clave) return null;
  if (!direccion || !clave || /[\r\n]/.test(clave))
    throw new FalloFuente("configuracion");
  let url: URL;
  try {
    url = new URL(direccion);
  } catch {
    throw new FalloFuente("configuracion");
  }
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.replace(/\/$/, "").endsWith("/api/v1")
  )
    throw new FalloFuente("configuracion");
  url.pathname = url.pathname.replace(/\/$/, "") + "/";
  return { url, clave };
}
async function respuestaAcotada(
  respuesta: Response,
  limite: number,
): Promise<unknown> {
  if (!respuesta.ok)
    throw new FalloFuente(
      [401, 403].includes(respuesta.status)
        ? "permiso"
        : respuesta.status === 429
          ? "limite"
          : "respuesta",
    );
  if (
    !respuesta.headers.get("content-type")?.includes("application/json") ||
    Number(respuesta.headers.get("content-length") || 0) > limite ||
    !respuesta.body
  )
    throw new FalloFuente("respuesta");
  const lector = respuesta.body.getReader();
  const partes: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const siguiente = await lector.read();
      if (siguiente.done) break;
      bytes += siguiente.value.byteLength;
      if (bytes > limite) {
        await lector.cancel();
        throw new FalloFuente("respuesta");
      }
      partes.push(siguiente.value);
    }
    return JSON.parse(Buffer.concat(partes).toString("utf8")) as unknown;
  } finally {
    lector.releaseLock();
  }
}
const ejecucionSchema = z.object({
  id: identificador,
  workflowId: identificador,
  status: z.string().max(40),
  startedAt: fecha.nullable(),
  stoppedAt: fecha.nullable(),
});
const workflowSchema = z.object({
  id: identificador,
  name: z.string().max(500),
  active: z.boolean(),
  activeVersionId: z.string().nullable().optional(),
});
const errorEjecucionSchema = z.object({
  data: z
    .object({
      resultData: z
        .object({
          error: z
            .object({
              name: z.string().max(300).optional(),
              message: z.string().max(10000).optional(),
              httpCode: z.union([z.string().max(10), z.number()]).optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});
// Se clasifica en memoria: ni mensajes remotos, stack, nodos, URLs ni payloads salen al cliente o Telegram.
function causaLegible(valor: unknown) {
  const dato = errorEjecucionSchema.safeParse(valor);
  const error = dato.success ? dato.data.data?.resultData?.error : undefined;
  const texto = `${error?.name || ""} ${error?.message || ""}`;
  const codigo = Number(error?.httpCode);
  if (
    [401, 403].includes(codigo) ||
    /unauthorized|forbidden|credential|authentication/i.test(texto)
  )
    return "La conexión con un servicio necesita revisar sus permisos.";
  if (codigo === 429 || /rate.?limit|too many requests/i.test(texto))
    return "Un servicio alcanzó su límite de solicitudes.";
  if (/timeout|timed out|ETIMEDOUT/i.test(texto))
    return "Un servicio tardó más de lo permitido en responder.";
  if (/out of memory|heap limit|ENOMEM/i.test(texto))
    return "La ejecución no dispuso de memoria suficiente.";
  if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|network/i.test(texto))
    return "No se pudo conectar con un servicio requerido.";
  return "La ejecución terminó con un error; la causa detallada no está disponible en esta vista.";
}
async function leerN8n(
  ahora: number,
  umbrales: UmbralesSalud,
): Promise<SaludOperativa["n8n"]> {
  const base: SaludOperativa["n8n"] = {
    estado: "sin_configurar",
    actualizado: null,
    detalle: "La lectura de n8n todavía no está configurada.",
    ejecuciones: [],
    fallosRecientes: [],
    workflows: [],
    workflowsActivos: null,
    ejecucionesDisponibles: false,
    workflowsDisponibles: false,
    ejecucionesTruncadas: false,
    workflowsTruncados: false,
    ventanaDesde: new Date(ahora - DIA).toISOString(),
  };
  if (!remoto())
    return {
      ...base,
      estado: "simulada",
      detalle: "Modo simulado: no se consulta ningún n8n real.",
    };
  try {
    const configuracion = configurarN8n();
    if (!configuracion) return base;
    const signal = AbortSignal.timeout(8000);
    const consultar = async (
      ruta: string,
      parametros: Record<string, string>,
    ) => {
      const url = new URL(ruta, configuracion.url);
      for (const [clave, valor] of Object.entries(parametros))
        url.searchParams.set(clave, valor);
      return respuestaAcotada(
        await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "X-N8N-API-KEY": configuracion.clave,
          },
          cache: "no-store",
          redirect: "error",
          signal,
        }),
        2 * 1024 * 1024,
      );
    };
    async function paginas<T>(
      ruta: string,
      esquema: z.ZodType<T>,
      parametros: Record<string, string>,
    ) {
      const resultado: T[] = [];
      let cursor: string | null = null;
      const vistos = new Set<string>();
      for (let pagina = 0; pagina < 4; pagina++) {
        const datos: { data: T[]; nextCursor?: string | null } = z
          .object({
            data: z.array(esquema).max(50),
            nextCursor: z.string().max(2048).nullable().optional(),
          })
          .parse(
            await consultar(ruta, {
              ...parametros,
              limit: "50",
              ...(cursor ? { cursor } : {}),
            }),
          );
        resultado.push(...datos.data);
        cursor = datos.nextCursor || null;
        if (!cursor) break;
        if (vistos.has(cursor)) throw new FalloFuente("respuesta");
        vistos.add(cursor);
      }
      return { datos: resultado, truncado: Boolean(cursor) };
    }
    const [ejecuciones, workflows] = await Promise.allSettled([
      paginas("executions", ejecucionSchema, { includeData: "false" }),
      paginas("workflows", workflowSchema, { excludePinnedData: "true" }),
    ]);
    const errores = [ejecuciones, workflows].filter(
      (r) => r.status === "rejected",
    );
    base.estado = errores.length
      ? errores.length === 2
        ? "error"
        : "degradado"
      : "ok";
    base.actualizado =
      errores.length === 2 ? null : new Date(ahora).toISOString();
    base.detalle = errores.length
      ? fallosLegibles[
          errores[0].reason instanceof FalloFuente
            ? errores[0].reason.tipo
            : "conexion"
        ]
      : "Lectura acotada de hasta 200 ejecuciones y 200 workflows. Los fallos recientes pertenecen a las últimas 24 horas observadas.";
    if (workflows.status === "fulfilled") {
      base.workflowsDisponibles = true;
      base.workflows = workflows.value.datos.map((w) => ({
        id: w.id,
        nombre: etiqueta(w.name),
        activo:
          w.activeVersionId === undefined
            ? w.active
            : Boolean(w.activeVersionId),
      }));
      base.workflowsTruncados = workflows.value.truncado;
      base.workflowsActivos = base.workflows.filter((w) => w.activo).length;
    }
    if (ejecuciones.status === "fulfilled") {
      base.ejecucionesDisponibles = true;
      base.ejecucionesTruncadas = ejecuciones.value.truncado;
      base.ejecuciones = ejecuciones.value.datos.map((e): EjecucionSalud => ({
        id: e.id,
        workflowId: e.workflowId,
        workflow:
          base.workflows.find((w) => w.id === e.workflowId)?.nombre ||
          "Workflow sin nombre disponible",
        estado:
          e.status === "success"
            ? "correcta"
            : ["error", "crashed"].includes(e.status)
              ? "fallida"
              : ["running", "new"].includes(e.status)
                ? "ejecutando"
                : e.status === "waiting"
                  ? "esperando"
                  : e.status === "canceled"
                    ? "cancelada"
                    : "desconocida",
        inicio: iso(e.startedAt),
        fin: iso(e.stoppedAt),
        causa: ["error", "crashed"].includes(e.status)
          ? causaLegible(null)
          : null,
      }));
      base.fallosRecientes = base.ejecuciones.filter(
        (e) =>
          e.estado === "fallida" &&
          Date.parse(e.fin || e.inicio || "") >= ahora - DIA &&
          Date.parse(e.fin || e.inicio || "") <= ahora + MINUTO,
      );
      await Promise.allSettled(
        base.fallosRecientes.slice(0, 10).map(async (e) => {
          if (!/^\d+$/.test(e.id)) return;
          try {
            e.causa = causaLegible(
              await consultar(`executions/${e.id}`, {
                includeData: "true",
                redactExecutionData: "true",
              }),
            );
          } catch {
            /* El fallo continúa visible con causa desconocida y sin datos privados. */
          }
        }),
      );
      if (
        base.fallosRecientes.length >= umbrales.fallosN8n &&
        base.estado === "ok"
      )
        base.estado = "degradado";
    }
    return base;
  } catch (error) {
    return {
      ...base,
      estado:
        error instanceof FalloFuente && error.tipo === "configuracion"
          ? "sin_configurar"
          : "error",
      detalle:
        fallosLegibles[error instanceof FalloFuente ? error.tipo : "conexion"],
    };
  }
}

const bytes = z
  .number()
  .finite()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const certificadoSchema = z.object({
  state: z.enum(["ok", "expiring", "expired", "unknown"]),
  expiresAt: fecha.nullable(),
});
const copiaSchema = z.object({
  state: z.enum(["ok", "stale", "unknown"]),
  completedAt: fecha.nullable(),
  ageHours: z.number().finite().nonnegative().nullable(),
});
const snapshotVpsSchema = z.object({
  schemaVersion: z.literal(1),
  collectedAt: fecha,
  maintenance: z.boolean(),
  disk: z
    .object({
      totalBytes: bytes.positive().nullable(),
      freeBytes: bytes.nullable(),
    })
    .refine(
      (x) =>
        x.totalBytes === null ||
        x.freeBytes === null ||
        x.freeBytes <= x.totalBytes,
    )
    .nullable(),
  memory: z
    .object({
      totalBytes: bytes.positive().nullable(),
      availableBytes: bytes.nullable(),
    })
    .refine(
      (x) =>
        x.totalBytes === null ||
        x.availableBytes === null ||
        x.availableBytes <= x.totalBytes,
    )
    .nullable(),
  certificates: z.object({ cooper: certificadoSchema, n8n: certificadoSchema }),
  backups: z.object({ copy: copiaSchema, replica: copiaSchema }),
  services: z.object({
    cooper: z.enum(["ok", "down", "unknown"]),
    n8n: z.enum(["ok", "down", "unknown"]),
    runner: z.enum(["ok", "down", "unknown"]),
    caddy: z.enum(["ok", "down", "unknown"]),
  }),
});
async function leerVps(
  ahora: number,
  umbrales: UmbralesSalud,
): Promise<SaludOperativa["vps"]> {
  const base: SaludOperativa["vps"] = {
    estado: "sin_configurar",
    actualizado: null,
    detalle: "El recolector del VPS todavía no está conectado.",
    antiguedadMinutos: null,
    mantenimiento: false,
    disco: null,
    memoria: null,
    certificados: [
      { servicio: "cooper", vence: null, diasRestantes: null },
      { servicio: "n8n", vence: null, diasRestantes: null },
    ],
    copias: [
      { tipo: "local", completada: null, antiguedadHoras: null },
      { tipo: "remota", completada: null, antiguedadHoras: null },
    ],
    servicios: {
      cooper: "unknown",
      n8n: "unknown",
      runner: "unknown",
      caddy: "unknown",
    },
  };
  const ruta = process.env.COOPER_OBSERVABILIDAD_VPS_PATH;
  if (process.env.COOPER_DEMO === "1")
    return {
      ...base,
      estado: "simulada",
      detalle: "Demostración: no se consulta el VPS real.",
    };
  if (!ruta) return base;
  // El archivo es producido por el recolector, nunca una ruta recibida del navegador.
  if (!ruta.endsWith(".json") || /(?:^|\/)\.env(?:\.|$)/.test(ruta))
    return {
      ...base,
      detalle: "La ruta del recolector no es un archivo de estado JSON.",
    };
  try {
    const archivo = await open(ruta, constants.O_RDONLY | constants.O_NOFOLLOW);
    let contenido: string;
    try {
      const stats = await archivo.stat();
      if (!stats.isFile() || stats.size > 65536) throw new Error("snapshot");
      const buffer = Buffer.alloc(65537);
      const lectura = await archivo.read(buffer, 0, buffer.length, 0);
      if (lectura.bytesRead > 65536) throw new Error("snapshot");
      contenido = buffer.subarray(0, lectura.bytesRead).toString("utf8");
    } finally {
      await archivo.close();
    }
    const valor = snapshotVpsSchema.parse(JSON.parse(contenido));
    const edad = antiguedad(valor.collectedAt, ahora, MINUTO);
    if (edad === null) throw new Error("snapshot futuro");
    const desactualizado = edad >= umbrales.datosVpsMinutos;
    return {
      ...base,
      estado: desactualizado ? "degradado" : "ok",
      actualizado: valor.collectedAt,
      antiguedadMinutos: edad,
      mantenimiento: valor.maintenance,
      detalle: desactualizado
        ? "El estado del VPS está desactualizado. Revisa el recolector antes de confiar en estas métricas."
        : valor.maintenance
          ? "El VPS está en mantenimiento; las comprobaciones están suspendidas temporalmente."
          : "Última medición del recolector del VPS; las métricas no disponibles se muestran como desconocidas.",
      disco:
        valor.disk?.totalBytes !== null &&
        valor.disk?.freeBytes !== null &&
        valor.disk
          ? {
              totalBytes: valor.disk.totalBytes,
              libreBytes: valor.disk.freeBytes,
              librePorcentaje:
                (valor.disk.freeBytes / valor.disk.totalBytes) * 100,
            }
          : null,
      memoria:
        valor.memory?.totalBytes !== null &&
        valor.memory?.availableBytes !== null &&
        valor.memory
          ? {
              totalBytes: valor.memory.totalBytes,
              disponibleBytes: valor.memory.availableBytes,
              usadaPorcentaje:
                (1 - valor.memory.availableBytes / valor.memory.totalBytes) *
                100,
            }
          : null,
      certificados: (["cooper", "n8n"] as const).map((servicio) => ({
        servicio,
        vence: valor.certificates[servicio].expiresAt,
        diasRestantes: valor.certificates[servicio].expiresAt
          ? (Date.parse(valor.certificates[servicio].expiresAt) - ahora) / DIA
          : null,
      })),
      copias: (["copy", "replica"] as const).map((tipo) => ({
        tipo: tipo === "copy" ? "local" : "remota",
        completada: valor.backups[tipo].completedAt,
        antiguedadHoras: antiguedad(
          valor.backups[tipo].completedAt,
          ahora,
          60 * MINUTO,
        ),
      })),
      servicios: valor.services,
    };
  } catch {
    return {
      ...base,
      estado: "error",
      detalle:
        "No se pudo leer una medición válida del VPS. Revisa el archivo del recolector y sus permisos.",
    };
  }
}

async function leerFabrica(
  user: User,
  ahora: number,
  umbrales: UmbralesSalud,
): Promise<SaludOperativa["fabrica"]> {
  const base: SaludOperativa["fabrica"] = {
    estado: "desconocido",
    actualizado: null,
    detalle: "No se pudo consultar el estado de la fábrica.",
    videos: [],
    videosTruncados: false,
    enCurso: null,
    colgados: null,
    aprobaciones: null,
    programados: null,
    pausados: null,
    cancelados: null,
    publicados: null,
    gastoDiarioUsd: null,
    gastoFuente: "desconocida",
    gastoFecha: null,
    gastoZona: "America/Lima",
  };
  const esRemoto = remoto();
  const local = db()
    .select({
      id: videos.id,
      title: videos.title,
      stage: videos.stage,
      updatedAt: videos.updatedAt,
      productionState: videos.productionState,
    })
    .from(videos)
    .all();
  const adaptador = new FabricaN8n({ timeoutMs: 4000, backoffMs: 50 });
  const [datos, operacion, gastos] = await Promise.allSettled([
    esRemoto
      ? adaptador
          .request(user, "estado", {})
          .then((r) => estadoRemotoSchema.parse(r))
      : Promise.resolve(null),
    leerOperacion(user),
    esRemoto ? adaptador.gastos(user) : Promise.resolve(administracion(user)),
  ]);
  if (gastos.status === "fulfilled") {
    const g = gastos.value;
    const total =
      "gastos" in g
        ? g.gastos.reduce((s, x) => s + x.dia, 0)
        : g.users.reduce((s, x) => s + x.day, 0);
    if (Number.isFinite(total) && total >= 0) {
      base.gastoDiarioUsd = Math.round(total * 100) / 100;
      base.gastoFuente =
        "gastos" in g ? (g.estimados ? "n8n_estimado" : "n8n") : "simulada";
      base.gastoFecha = new Date(ahora).toISOString();
    }
  }
  if (datos.status === "rejected" || operacion.status === "rejected")
    return {
      ...base,
      estado: "error",
      detalle:
        "No se pudo confirmar el estado completo de la fábrica. Los contadores quedan desconocidos; no se sustituyen por datos locales antiguos.",
    };
  const op = operacion.value;
  const cancelados = new Set(
    local.filter((v) => v.productionState === "cancelada").map((v) => v.id),
  );
  const pausados = new Set(op.fallos.map((v) => v.videoId));
  const aprobaciones = new Set(op.decisiones.map((v) => v.videoId));
  const filas =
    esRemoto && datos.value
      ? datos.value.videos.map((v) => ({
          id: v.id,
          title: v.titulo,
          stage: v.stage,
          updatedAt: v.actualizado_en,
          productionState: cancelados.has(v.id) ? "cancelada" : "activa",
        }))
      : local;
  base.videos = filas.map((v): VideoSalud => {
    const actualizado =
      Number.isFinite(v.updatedAt) &&
      v.updatedAt > 0 &&
      v.updatedAt <= 8640000000000000
        ? new Date(v.updatedAt).toISOString()
        : null;
    const edad = antiguedad(actualizado, ahora, MINUTO);
    const estado: VideoSalud["estado"] =
      v.productionState === "cancelada"
        ? "cancelado"
        : v.productionState === "pausada" || pausados.has(v.id)
          ? "pausado"
          : v.stage === 11
            ? "publicado"
            : [3, 9].includes(v.stage) || aprobaciones.has(v.id)
              ? "aprobacion"
              : v.stage === 10
                ? "programado"
                : edad === null
                  ? "desconocido"
                  : edad >= umbrales.videoSinAvanceMinutos
                    ? "colgado"
                    : "en_curso";
    return {
      id: v.id,
      titulo: etiqueta(v.title),
      etapa: v.stage,
      actualizado,
      sinAvanceMinutos: edad,
      estado,
    };
  });
  for (const [clave, estado] of [
    ["enCurso", "en_curso"],
    ["colgados", "colgado"],
    ["aprobaciones", "aprobacion"],
    ["programados", "programado"],
    ["pausados", "pausado"],
    ["cancelados", "cancelado"],
    ["publicados", "publicado"],
  ] as const)
    base[clave] = base.videos.filter((v) => v.estado === estado).length;
  base.videos.sort(
    (a, b) =>
      Number(b.estado === "colgado") - Number(a.estado === "colgado") ||
      (b.sinAvanceMinutos || 0) - (a.sinAvanceMinutos || 0),
  );
  base.videosTruncados = base.videos.length > 200;
  base.videos = base.videos.slice(0, 200);
  base.actualizado = new Date(ahora).toISOString();
  base.estado = !esRemoto
    ? "simulada"
    : base.colgados || base.pausados || base.gastoDiarioUsd === null
      ? "degradado"
      : "ok";
  base.detalle = esRemoto
    ? "Estado y gasto leídos del puente de fábrica. Las esperas humanas, la programación y las pausas se separan de los videos sin avance. Las cancelaciones conservan el freno local de Cooper."
    : "Producción y gasto simulados; no representan actividad ni cargos reales.";
  return base;
}

function derivarAlertas(
  salud: SaludOperativa,
  umbrales: UmbralesSalud,
): AlertaSalud[] {
  const alertas: AlertaSalud[] = [];
  const agregar = (
    codigo: string,
    fuente: AlertaSalud["fuente"],
    severidad: AlertaSalud["severidad"],
    titulo: string,
    detalle: string,
  ) => alertas.push({ codigo, fuente, severidad, titulo, detalle });
  if (salud.modo === "n8n") {
    if (!salud.n8n.ejecucionesDisponibles || !salud.n8n.workflowsDisponibles)
      agregar(
        "n8n_fuente",
        "n8n",
        "aviso",
        "Lectura de n8n no disponible",
        salud.n8n.detalle,
      );
    if (salud.n8n.fallosRecientes.length >= umbrales.fallosN8n)
      agregar(
        "n8n_fallos",
        "n8n",
        "critica",
        "Fallos recientes en n8n",
        `${salud.n8n.fallosRecientes.length} ejecuciones fallidas observadas en las últimas 24 horas; umbral ${umbrales.fallosN8n}.`,
      );
    if (salud.n8n.workflowsActivos === 0 && !salud.n8n.workflowsTruncados)
      agregar(
        "n8n_sin_workflows",
        "n8n",
        "aviso",
        "No hay workflows activos",
        "La lectura de n8n no encontró workflows activos para esta clave.",
      );
  }
  const vps = salud.vps;
  if (vps.estado === "simulada") {
    // Demostración: no hay una lectura real que deba disparar alertas.
  } else if (["sin_configurar", "error"].includes(vps.estado))
    agregar(
      "vps_fuente",
      "vps",
      "aviso",
      "Salud del VPS desconocida",
      vps.detalle,
    );
  else if ((vps.antiguedadMinutos ?? Infinity) >= umbrales.datosVpsMinutos)
    agregar(
      "vps_desactualizado",
      "vps",
      "aviso",
      "Medición del VPS desactualizada",
      "El recolector no ha entregado datos dentro del intervalo configurado.",
    );
  else if (vps.mantenimiento)
    agregar(
      "vps_mantenimiento",
      "vps",
      "aviso",
      "VPS en mantenimiento",
      "Las comprobaciones están suspendidas temporalmente; no se afirma que los servicios estén recuperados.",
    );
  else {
    if (vps.disco && vps.disco.librePorcentaje <= umbrales.discoLibrePorcentaje)
      agregar(
        "vps_disco",
        "vps",
        "critica",
        "Poco espacio libre en el VPS",
        `${formatoPorcentaje(vps.disco.librePorcentaje)} libre; umbral ${formatoPorcentaje(umbrales.discoLibrePorcentaje)}.`,
      );
    if (
      vps.memoria &&
      vps.memoria.usadaPorcentaje >= umbrales.memoriaUsadaPorcentaje
    )
      agregar(
        "vps_memoria",
        "vps",
        "aviso",
        "Uso alto de memoria",
        `${formatoPorcentaje(vps.memoria.usadaPorcentaje)} en uso; umbral ${formatoPorcentaje(umbrales.memoriaUsadaPorcentaje)}.`,
      );
    if (!vps.disco || !vps.memoria)
      agregar(
        "vps_metricas",
        "vps",
        "aviso",
        "Métricas del VPS incompletas",
        "No se pudo comprobar el disco o la memoria; una métrica ausente no significa que esté saludable.",
      );
    for (const cert of vps.certificados) {
      if (cert.diasRestantes === null)
        agregar(
          `vps_certificado_${cert.servicio}`,
          "vps",
          "aviso",
          "Certificado sin comprobar",
          `No se pudo comprobar el vencimiento del certificado de ${cert.servicio}.`,
        );
      else if (cert.diasRestantes <= umbrales.certificadoDias)
        agregar(
          `vps_certificado_${cert.servicio}`,
          "vps",
          cert.diasRestantes <= 0 ? "critica" : "aviso",
          cert.diasRestantes <= 0
            ? "Certificado vencido"
            : "Certificado próximo a vencer",
          `Certificado de ${cert.servicio}: ${Math.floor(cert.diasRestantes)} días restantes; umbral ${umbrales.certificadoDias}.`,
        );
    }
    for (const copia of vps.copias) {
      const limite =
        copia.tipo === "local"
          ? umbrales.copiaLocalHoras
          : umbrales.copiaRemotaHoras;
      if (copia.antiguedadHoras === null || copia.antiguedadHoras >= limite)
        agregar(
          `vps_copia_${copia.tipo}`,
          "vps",
          "aviso",
          `Copia ${copia.tipo} pendiente de comprobar`,
          copia.antiguedadHoras === null
            ? "No hay evidencia de una copia terminada correctamente."
            : `Última copia hace ${Math.floor(copia.antiguedadHoras)} horas; umbral ${limite}.`,
        );
    }
    for (const servicio of ["cooper", "n8n", "runner", "caddy"] as const)
      if (vps.servicios[servicio] !== "ok")
        agregar(
          `vps_servicio_${servicio}`,
          "vps",
          vps.servicios[servicio] === "down" ? "critica" : "aviso",
          `Servicio ${servicio} ${vps.servicios[servicio] === "down" ? "sin respuesta" : "sin comprobar"}`,
          "Revisa el estado del servicio en el VPS.",
        );
  }
  if (salud.modo === "n8n") {
    if (salud.fabrica.estado === "error")
      agregar(
        "fabrica_fuente",
        "fabrica",
        "aviso",
        "Estado de la fábrica desconocido",
        salud.fabrica.detalle,
      );
    if (salud.fabrica.colgados)
      agregar(
        "fabrica_sin_avance",
        "fabrica",
        "aviso",
        "Videos sin avance",
        `${salud.fabrica.colgados} videos superan ${umbrales.videoSinAvanceMinutos} minutos sin avance y sin una espera conocida.`,
      );
    if (salud.fabrica.gastoDiarioUsd === null)
      agregar(
        "fabrica_gasto_desconocido",
        "fabrica",
        "aviso",
        "Gasto diario desconocido",
        "No se pudo confirmar el gasto; no se interpreta como cero.",
      );
    else if (salud.fabrica.gastoDiarioUsd >= umbrales.gastoDiarioUsd)
      agregar(
        "fabrica_gasto",
        "fabrica",
        "aviso",
        "Gasto diario elevado",
        `${formatoMoneda(salud.fabrica.gastoDiarioUsd)} ${salud.fabrica.gastoFuente === "n8n_estimado" ? "estimados" : "registrados"}; umbral ${formatoMoneda(umbrales.gastoDiarioUsd)}, día de Lima.`,
      );
  }
  return alertas;
}

export async function leerSaludOperativa(
  user: User,
  input: UmbralesSalud,
): Promise<SaludOperativa> {
  requireAdmin(user);
  user = cuentaActiva(user.id);
  requireAdmin(user);
  const umbrales = umbralesSaludSchema.parse(input);
  const ahora = Date.now();
  const [n8n, vps, fabrica] = await Promise.all([
    leerN8n(ahora, umbrales),
    leerVps(ahora, umbrales),
    leerFabrica(user, ahora, umbrales),
  ]);
  const salud: SaludOperativa = {
    actualizado: new Date(ahora).toISOString(),
    modo: remoto() ? "n8n" : "simulada",
    n8n,
    vps,
    fabrica,
    alertas: [],
  };
  salud.alertas = derivarAlertas(salud, umbrales);
  requireAdmin(cuentaActiva(user.id));
  if (
    salud.alertas.some((a) => a.fuente === "vps") &&
    salud.vps.estado === "ok"
  )
    salud.vps.estado = "degradado";
  return salud;
}
