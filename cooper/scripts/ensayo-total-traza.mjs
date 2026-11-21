import { createHash } from "node:crypto";

const PASOS = new Set([
  "Pedir nichos",
  "Nuevo canal",
  "Canal activo",
  "Radar del canal",
  "Pedir guion",
  "Mensaje de guion",
  "Pedir storyboard",
  "Encargo de producción",
  "Plan de producción",
  "Extraer imagen",
  "URL del plano",
  "WAV",
  "Voz lista",
  "Resultado sonido",
  "Composición Creatomate",
  "Consultar render",
  "Chequeos objetivos",
  "Aprobación · preparar",
  "Aprobación · cerrar",
  "Plan de publicación",
  "Filas de publicación",
  "Leer resultados",
  "Videos a cerrar",
  "Cooper · historial de redes",
  "Pedir lecciones",
  "Fila actualizada",
  "Render · limitar espera",
  "Render · fallo durable",
]);

// La traza contiene únicamente la copia saneada y los datos ficticios del ensayo.
// Aun así, se excluyen autenticación, firmas, cabeceras y bytes de medios.
function resumir(value, key = "") {
  if (/token|secret|firma|signature|headers|authorization/i.test(key))
    return "[omitido]";
  if (typeof value === "string") {
    if (value.length > 1800)
      return {
        caracteres: value.length,
        sha256: createHash("sha256").update(value).digest("hex"),
        ...(key === "guion" ? { inicio: value.slice(0, 300) } : {}),
      };
    if (/^https?:\/\//.test(value) && /form-waiting/.test(value))
      return value.split("?")[0];
    return value;
  }
  if (Array.isArray(value)) return value.map((x) => resumir(x));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resumir(v, k)]),
    );
  return value;
}

export async function trazarPasos(api, ejecuciones) {
  const traza = [];
  for (const execution of ejecuciones) {
    const detalle = await api.request(
      "GET",
      `/executions/${execution.id}?includeData=true`,
    );
    const runs = detalle.data?.resultData?.runData || {};
    for (const [nodo, pasadas] of Object.entries(runs)) {
      if (!PASOS.has(nodo)) continue;
      pasadas.forEach((pasada, indice) => {
        const entrada = (pasada.source || []).flatMap((source) => {
          const run = runs[source.previousNode]?.[source.previousNodeRun || 0];
          return run?.data?.main?.[source.previousNodeOutput || 0] || [];
        });
        const items = (xs) =>
          xs.map((x) => ({
            json: resumir(x.json),
            ...(x.binary
              ? {
                  binarios: Object.fromEntries(
                    Object.entries(x.binary).map(([k, b]) => [
                      k,
                      {
                        mimeType: b.mimeType,
                        fileName: b.fileName,
                        fileSize: b.fileSize,
                      },
                    ]),
                  ),
                }
              : {}),
          }));
        traza.push({
          ejecucion: execution.id,
          flujo: detalle.workflowData?.name || execution.workflowId,
          nodo,
          pasada: indice,
          inicio: new Date(pasada.startTime).toISOString(),
          duracionMs: pasada.executionTime,
          entrada: items(entrada),
          salida: (pasada.data?.main || []).map((xs) => items(xs || [])),
        });
      });
    }
  }
  return traza.sort((a, b) => a.inicio.localeCompare(b.inicio));
}
