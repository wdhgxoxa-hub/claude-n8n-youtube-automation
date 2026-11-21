// Contrato de operación: listas cerradas; nunca devolver filas completas ni formularios firmados.
function textoOperacion(v, max = 6000) {
  return textoCooper(typeof v === "string" ? v : JSON.stringify(v ?? ""), max);
}
function ajusteValor(obj, path) {
  return path.split(".").reduce((v, k) => v?.[k], obj);
}
function ponerAjuste(obj, path, value) {
  const partes = path.split(".");
  let o = obj;
  for (const p of partes.slice(0, -1)) o = o[p] || (o[p] = {});
  o[partes.at(-1)] =
    path === "calendario.cortesDias" && typeof value === "string"
      ? value.split(",").map(Number)
      : value;
}
function ajustesPublicos(base) {
  return Object.fromEntries(
    Object.keys(CATALOGO_AJUSTES).map((k) => [
      k,
      k === "calendario.cortesDias" && Array.isArray(ajusteValor(base, k))
        ? ajusteValor(base, k).join(",")
        : (ajusteValor(base, k) ?? CATALOGO_AJUSTES[k].valor),
    ]),
  );
}
function validarValoresAjustes(valores) {
  if (
    !valores ||
    typeof valores !== "object" ||
    Array.isArray(valores) ||
    !Object.keys(valores).length
  )
    return false;
  return Object.entries(valores).every(([k, v]) => {
    const f = CATALOGO_AJUSTES[k];
    if (!f || typeof v !== f.tipo) return false;
    if (typeof v === "number")
      return (
        Number.isFinite(v) &&
        v >= f.min &&
        v <= f.max &&
        (!f.entero || Number.isInteger(v))
      );
    if (typeof v === "string") {
      if (k === "calendario.cortesDias")
        return /^(?:[1-9]|[12][0-9]|30)(?:,(?:[1-9]|[12][0-9]|30)){0,9}$/.test(
          v,
        );
      if (!/^[a-zA-Z0-9_./:-]{1,100}$/.test(v)) return false;
      if (
        k === "privacidadYoutube" &&
        !["public", "private", "unlisted"].includes(v)
      )
        return false;
      if (k === "calendario.zona") {
        try {
          new Intl.DateTimeFormat("es", { timeZone: v });
        } catch {
          return false;
        }
      }
    }
    return true;
  });
}
function revisionAjustes(base) {
  return require("crypto")
    .createHash("sha256")
    .update(JSON.stringify(ajustesPublicos(base)))
    .digest("hex");
}
// El Code runner de n8n no incluye URL. Se acepta solo el origen configurado y
// una ruta de formulario; ni credenciales, fragmentos, redirecciones ni rutas arbitrarias.
function urlEsperaCooper(value, base) {
  const origin = (x) =>
    String(x)
      .toLowerCase()
      .replace(/^https:(.*):443$/, "https:$1")
      .replace(/^http:(.*):80$/, "http:$1");
  const b = String(base || "").match(
    /^(https?:\/\/[a-z0-9.-]+(?::[0-9]+)?)\/?$/i,
  );
  const u = String(value || "").match(
    /^(https?:\/\/[a-z0-9.-]+(?::[0-9]+)?)(\/form-waiting\/[a-z0-9_-]+\/?)(\?[a-z0-9._~%&=+\/-]*)?$/i,
  );
  return b && u && origin(b[1]) === origin(u[1]) ? u[0] : "";
}
function motivoOperacion(error) {
  const s = String(error || "");
  if (/429|rate.?limit|too many/i.test(s))
    return [
      "El servicio está atendiendo demasiados pedidos.",
      "Espera unos minutos y vuelve a consultar.",
    ];
  if (/timeout|timed out|network|ECONN|5\d\d/i.test(s))
    return [
      "La conexión se interrumpió.",
      "Consulta el estado antes de repetir el trabajo.",
    ];
  if (/401|403|credential|auth/i.test(s))
    return [
      "Una conexión necesita atención del administrador.",
      "Pide a Walter que revise la conexión.",
    ];
  if (/402|quota|billing|credits|presupuesto|tope/i.test(s))
    return [
      "La producción se detuvo por un límite de la fábrica.",
      "Walter puede revisar los ajustes y el permiso pendiente.",
    ];
  return [
    "La producción no pudo completar este paso.",
    "Revisa la última versión y solicita una corrección.",
  ];
}
function conexionCooper(c, filas, aj) {
  const fila = filas.find((x) => x.canal_id === c.canal_id) || {};
  let url = "";
  if (
    fila.estado === "pendiente" &&
    /^[a-f0-9]{32}$/.test(fila.nonce || "") &&
    aj.googleClientId &&
    Date.now() - Date.parse(fila.updatedAt || fila.createdAt || 0) < 600000
  ) {
    const p = {
      client_id: aj.googleClientId,
      redirect_uri: aj.baseUrl + "/webhook/youtube-callback",
      response_type: "code",
      access_type: "offline",
      prompt: "consent select_account",
      include_granted_scopes: "false",
      state: c.canal_id + "." + fila.nonce,
      scope: [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/yt-analytics.readonly",
      ].join(" "),
    };
    url =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      Object.entries(p)
        .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
        .join("&");
  }
  return {
    estado:
      typeof fila.estado === "string"
        ? textoOperacion(fila.estado)
        : "sin conectar",
    nombre: textoOperacion(fila.canal_youtube || ""),
    url,
  };
}
function operacionCooper(
  canales,
  videos,
  trabajos,
  eventos,
  aprobaciones,
  publicaciones,
  admin,
  ajustes,
  conexiones = [],
) {
  const redValida = (x) =>
    ["youtube", "tiktok", "instagram", "facebook"].includes(x);
  const cs = new Set(canales.map((c) => c.canal_id)),
    vs = new Set(videos.map((v) => v.video_id));
  const per = (c) => {
    const fila = trabajos.find(
      (t) => t.job_id === String(c.biblia_ruta || "").replace("trabajo:", ""),
    );
    const env = jsonCooper(fila?.resultado, {}),
      bib = env.resultado || env,
      rad = jsonCooper(c.tendencias, {}),
      metas = jsonCooper(c.metas, {}),
      cuenta = jsonCooper(c.cuenta, {});
    if (c.modo_noticia) {
      const n = jsonCooper(c.noticia_hoy, null);
      rad.fecha = n?.fecha || "";
      rad.resumen = n
        ? "Noticia del día contrastada con fuentes."
        : "No hay noticia verificada para hoy.";
      rad.ideas = n
        ? [
            {
              titulo: n.titulo,
              red: "todas",
              gancho: n.titulo,
              por_que: (n.hechos || []).map((h) => h.dato).join(" "),
              fuente:
                n.hechos?.[0]?.fuentes?.[0]?.titulo || "Fuentes verificadas",
              fuente_url: n.hechos?.[0]?.fuentes?.[0]?.url || "",
              formato: "short",
            },
          ]
        : [];
      rad.sonidos = [];
    }
    const biblePaths = Object.keys(CAMPOS_BIBLIA);
    const propios = videos.filter((v) => v.canal_id === c.canal_id);
    const versiones = trabajos
      .filter(
        (t) =>
          t.canal_id === c.canal_id &&
          t.modo === "storyboard" &&
          ["listo", "ok"].includes(t.estado) &&
          vs.has(t.video_id),
      )
      .sort((a, b) =>
        String(a.updatedAt || a.createdAt || "").localeCompare(
          String(b.updatedAt || b.createdAt || ""),
        ),
      );
    const ultimas = new Map();
    for (const t of versiones) ultimas.set(t.video_id, t);
    const especialistas = [...ultimas.values()]
      .flatMap((t) => {
        const r = jsonCooper(t.resultado, {}).resultado || {},
          p = r.publicacion || {};
        return Object.entries(p)
          .filter(([red]) => redValida(red))
          .map(([red, x]) => ({
            videoId: t.video_id,
            titulo: textoOperacion(
              propios.find((v) => v.video_id === t.video_id)?.tema,
            ),
            red,
            hora: String(x.hora ?? ajustes?.calendario?.horas?.[red] ?? ""),
            formato: textoOperacion(x.formato || r.formato || ""),
            sonido: textoOperacion(
              x.sonido_sugerido || x.sonido || x.audio || "",
            ),
            recomendacion: textoOperacion(
              x.recomendacion || x.descripcion || x.caption || x.texto || "",
            ),
          }));
      })
      .slice(-80);
    return {
      id: c.canal_id,
      nombre: textoOperacion(c.nombre),
      estado: textoOperacion(c.estado),
      conexion: conexionCooper(c, conexiones, ajustes),
      biblia: Object.fromEntries(
        biblePaths.map((k) => [
          k,
          Array.isArray(ajusteValor(bib, k))
            ? ajusteValor(bib, k)
                .map((x) => textoOperacion(x))
                .join("\n")
            : textoOperacion(
                k.startsWith("publicacion.")
                  ? ajusteValor(bib, k)?.indicaciones || ""
                  : ajusteValor(bib, k),
              ),
        ]),
      ),
      perfil: String(c.uploadpost_perfil || ""),
      redes: String(c.redes || c.plataformas || "")
        .split(",")
        .map((x) => x.trim())
        .filter(redValida),
      zona:
        c.zona || c.zona_horaria || ajustes?.calendario?.zona || "America/Lima",
      metas: {
        videos_semana: Number(metas.videos_semana) || 0,
        formato: metas.formato === "largo" ? "largo" : "short",
        auto: metas.auto === true,
        retencion_min: Number(metas.retencion_min) || 0,
      },
      cuenta: {
        red: textoOperacion(cuenta.red),
        handle: textoOperacion(cuenta.handle || cuenta.url),
        diagnostico: textoOperacion(
          cuenta.diagnostico || bib.diagnostico || "",
        ),
      },
      radar: {
        competencia: proyectarCompetencia(rad.competencia, c.nombre),
        fecha: fechaCooper(rad.fecha) || "",
        resumen: textoOperacion(rad.resumen),
        ideas: (Array.isArray(rad.ideas) ? rad.ideas : [])
          .slice(0, 20)
          .map((i, k) => ({
            id: String(k) + ":" + String(rad.fecha || ""),
            titulo: textoOperacion(i.titulo),
            red: textoOperacion(i.red),
            gancho: textoOperacion(i.gancho),
            motivo: textoOperacion(i.por_que),
            fuente: textoOperacion(i.fuente || "Investigación del radar"),
            url: urlCooper(i.url || i.fuente_url),
            formato: /largo/.test(i.formato) ? "largo" : "short",
          })),
        sonidos: (rad.sonidos || []).slice(0, 10).map((s) => ({
          nombre: textoOperacion(s.nombre),
          uso: textoOperacion(s.uso),
          url: urlCooper(s.url),
        })),
      },
      rutina: eventos
        .filter((e) => e.canal_id === c.canal_id && e.tipo === "rutina_cooper")
        .slice(-30)
        .map((e) => {
          const d = jsonCooper(e.detalle, {});
          return {
            fecha: fechaCooper(e.createdAt) || "",
            decision:
              textoOperacion(d.decision) +
              (vs.has(e.video_id)
                ? ": " +
                  textoOperacion(
                    videos.find((v) => v.video_id === e.video_id)?.tema,
                  )
                : ""),
            motivo: textoOperacion(d.motivo),
            frenos: (d.frenos || []).map((x) => textoOperacion(x)),
            videoId: vs.has(e.video_id) ? e.video_id : "",
          };
        }),
      referencias: ["personajes", "escenarios"]
        .flatMap((tipo) =>
          (Array.isArray(bib[tipo]) ? bib[tipo] : []).map((r) => ({
            id: String(r.id || r.nombre),
            nombre: textoOperacion(r.nombre || r.id),
            tipo,
            descripcion: textoOperacion(r.descripcion_fija || r.descripcion),
            urls: (r.referencias_urls || []).map(urlCooper).filter(Boolean),
          })),
        )
        .slice(0, 100),
      especialistas,
    };
  };
  const decisiones = aprobaciones
    .filter(
      (a) =>
        a.estado === "pendiente" &&
        cs.has(a.canal_id) &&
        (!a.video_id || vs.has(a.video_id)) &&
        (admin || a.etapa !== "gasto"),
    )
    .map((a) => {
      const p = jsonCooper(a.pedido, {}),
        ctx = p.contexto || {};
      const contenido =
        a.etapa === "storyboard"
          ? ctx.storyboard || ctx
          : a.etapa === "canal"
            ? ctx
            : p.mensaje || a.resumen;
      // Solo campos de producto; nunca prompts de proveedor, presupuestos ni enlaces de espera.
      const detalle =
        typeof contenido === "string"
          ? textoOperacion(contenido)
          : textoOperacion(
              JSON.stringify(contenido, (k, v) =>
                /costo|presupuesto|gasto|token|secret|credencial|url|prompt|provider/i.test(
                  k,
                )
                  ? undefined
                  : v,
              ),
            );
      return {
        id: String(a.aprobacion_id),
        canalId: a.canal_id || "",
        videoId: a.video_id || "",
        etapa: a.etapa,
        resumen: textoOperacion(a.resumen),
        detalle,
        fecha: fechaCooper(a.createdAt) || "",
        renovable: !!a.url && a.etapa !== "gasto",
        opciones:
          a.etapa === "gasto" ? ["aprobar", "detener"] : ["aprobar", "cambios"],
      };
    });
  const pubs = publicaciones
    .filter((p) => vs.has(p.video_id))
    .flatMap((p) => {
      const r = jsonCooper(p.resultado, {}),
        resultados = r.publicaciones || [];
      const redes = String(p.plataformas || p.plataforma || "")
        .split(",")
        .filter(redValida);
      return redes.map((red) => {
        const x = resultados.find((x) => x.red === red);
        return {
          id: String(p.request_id || p.job_id) + ":" + red,
          canalId: videos.find((v) => v.video_id === p.video_id).canal_id,
          videoId: p.video_id,
          titulo: textoOperacion(
            p.titulo || videos.find((v) => v.video_id === p.video_id).tema,
          ),
          red,
          estado:
            x?.estado || (x?.publicado ? "publicado" : p.estado || "pendiente"),
          fecha: fechaCooper(p.publicar_en || p.publicado_en) || "",
          url: urlCooper(x?.url || p.url),
          detalle: x?.borrador
            ? "Abre la red para terminar la publicación."
            : x?.omitido
              ? "Conecta esta red antes de volver a publicar."
              : p.estado === "error"
                ? "Una red no confirmó la publicación. Consulta el estado antes de repetir."
                : "",
        };
      });
    });
  const avisos = eventos
    .filter(
      (e) =>
        e.tipo === "aviso_cooper" &&
        (e.video_id
          ? vs.has(e.video_id)
          : e.canal_id
            ? cs.has(e.canal_id)
            : admin),
    )
    .slice(-100)
    .map((e) => {
      const d = jsonCooper(e.detalle, {});
      return {
        id: String(e.evento || e.id),
        canalId: e.canal_id || "",
        videoId: e.video_id || "",
        medio: "telegram",
        tipo: textoOperacion(d.tipo),
        estado:
          d.estado === "enviado"
            ? "enviado"
            : d.estado === "fallido"
              ? "fallido"
              : "incierto",
        fecha: fechaCooper(e.createdAt) || "",
        resumen: textoOperacion(d.resumen),
      };
    });
  const fallos = videos
    .filter(
      (v) =>
        v.error ||
        ["detenido", "con_fallas", "error_publicacion"].includes(v.estado),
    )
    .map((v) => {
      const [motivo, sugerencia] = motivoOperacion(v.error);
      return {
        id: "fallo:" + v.video_id,
        canalId: v.canal_id,
        videoId: v.video_id,
        titulo: textoOperacion(v.tema),
        fecha: fechaCooper(v.updatedAt) || "",
        motivo,
        sugerencia,
        reintento:
          v.estado === "error_publicacion"
            ? "consultar"
            : ["detenido", "con_fallas"].includes(v.estado)
              ? "corregir"
              : "ninguno",
      };
    });
  for (const e of eventos
    .filter(
      (e) =>
        e.tipo === "incidencia_cooper" &&
        !e.video_id &&
        (e.canal_id ? cs.has(e.canal_id) : admin),
    )
    .slice(-50)) {
    const d = jsonCooper(e.detalle, {});
    if (d.tipo !== "ejecucion") continue;
    fallos.push({
      id: String(e.evento || e.id),
      canalId: e.canal_id || "",
      videoId: "",
      titulo: textoOperacion(d.proceso || "Preparación de la fábrica"),
      fecha: fechaCooper(e.createdAt) || "",
      motivo: textoOperacion(d.resumen),
      sugerencia: textoOperacion(
        d.sugerencia ||
          "Revisa los ajustes y las decisiones antes de repetir la solicitud.",
      ),
      reintento: "ninguno",
    });
  }
  return {
    modo: "n8n",
    actualizado: new Date().toISOString(),
    canales: canales.map(per),
    decisiones,
    publicaciones: pubs,
    avisos,
    fallos,
  };
}
