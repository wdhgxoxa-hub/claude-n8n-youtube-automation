if (["operacion", "ajustes", "control_fabrica"].includes(b.evento)) {
  const trabajos = filasCooper("Lecciones de Cooper"),
    eventos = filasCooper("Historial de Cooper"),
    aps = filasCooper("Decisiones de Cooper"),
    pubs = filasCooper("Publicaciones de Cooper");
  const aj = $("Ajustes de Cooper").first().json;
  if (b.evento === "ajustes") {
    if (!auth.admin) return fail(403, "Solo administración");
    return [
      {
        json: {
          accion: "responder",
          status: 200,
          respuesta: {
            revision: revisionAjustes(aj),
            valores: ajustesPublicos(aj),
            historial: eventos
              .filter((e) => e.tipo === "ajustes_cooper")
              .slice(-100)
              .reverse()
              .map((e) => {
                const x = jsonCooper(e.detalle, {});
                return {
                  fecha: fechaCooper(e.createdAt) || "",
                  actor: String(x.actor || ""),
                  cambios: Object.keys(x.valores || {}).filter(
                    (k) => CATALOGO_AJUSTES[k],
                  ),
                };
              }),
          },
        },
      },
    ];
  }
  const op = operacionCooper(
    canales,
    videos,
    trabajos,
    eventos,
    aps,
    pubs,
    auth.admin,
    aj,
    filasCooper("Conexiones de Cooper"),
  );
  if (b.evento === "operacion")
    return [{ json: { accion: "responder", status: 200, respuesta: op } }];
  if (d.confirmado !== true) return fail(400, "Falta confirmar");
  const c = canales.find((c) => c.canal_id === d.canalId);
  const e = {
    evento: "",
    dueno_email: c?.dueno_email || auth.dueno_email,
    canal_id: c?.canal_id || "",
    video_id: "",
    cooper: true,
  };
  if (
    [
      "conectar",
      "radar",
      "biblia",
      "redes",
      "metas",
      "referencias",
      "referencia",
      "adoptar",
      "idea",
    ].includes(d.accion) &&
    !c
  )
    return fail(404, "Canal no disponible");
  switch (d.accion) {
    case "conectar":
      if (!aj.googleClientId)
        return fail(409, "Walter debe configurar la conexión de YouTube");
      return [
        {
          json: {
            accion: "orden",
            status: 200,
            evento: {
              evento: "control_fabrica",
              accion: "conectar",
              canal_id: c.canal_id,
            },
          },
        },
      ];
    case "radar":
      if (c.estado !== "activo")
        return fail(409, "El canal todavía se está preparando");
      if (aj.allowRadar !== true)
        return fail(
          409,
          "El radar está apagado; Walter puede revisar los ajustes",
        );
      return [
        {
          json: {
            accion: "orden",
            status: 200,
            evento: {
              evento: "control_fabrica",
              accion: "radar",
              canal_id: c.canal_id,
              dueno_email: c.dueno_email,
            },
          },
        },
      ];
    case "renovar": {
      const a = aps.find(
        (x) =>
          x.aprobacion_id === d.id &&
          x.estado === "pendiente" &&
          x.url &&
          x.etapa !== "gasto" &&
          canales.some((c) => c.canal_id === x.canal_id) &&
          (!x.video_id ||
            videos.some(
              (v) => v.video_id === x.video_id && v.estado !== "cancelado",
            )),
      );
      if (!a) return fail(409, "La decisión no se puede renovar");
      return [
        {
          json: {
            accion: "orden",
            status: 200,
            evento: {
              evento: "control_fabrica",
              accion: "renovar",
              aprobacion_id: a.aprobacion_id,
              canal_id: a.canal_id,
              video_id: a.video_id || "",
            },
          },
        },
      ];
    }
    case "ajustes":
      if (!auth.admin) return fail(403, "Solo administración");
      if (!validarValoresAjustes(d.valores))
        return fail(400, "Ajustes inválidos");
      if (d.revision !== revisionAjustes(aj))
        return fail(409, "Los ajustes cambiaron; actualiza y revisa");
      return [
        {
          json: {
            accion: "orden",
            status: 200,
            evento: {
              evento: "control_fabrica",
              accion: "ajustes",
              fila: {
                tipo: "ajustes_cooper",
                evento: b.id_evento,
                video_id: "",
                canal_id: "",
                detalle: JSON.stringify({
                  actor: auth.dueno_email,
                  valores: d.valores,
                  revision: d.revision,
                }),
              },
            },
          },
        },
      ];
    case "biblia": {
      if (
        !op.canales.find((x) => x.id === c.canal_id) ||
        !Object.hasOwn(
          op.canales.find((x) => x.id === c.canal_id).biblia,
          d.campo,
        ) ||
        typeof d.valor !== "string" ||
        d.valor.length > 6000
      )
        return fail(400, "Campo inválido");
      if (!String(c.biblia_ruta).startsWith("trabajo:"))
        return fail(409, "La biblia todavía no está lista");
      e.evento = "ajustar_biblia";
      e.campo = d.campo;
      e.valor = JSON.stringify(d.valor);
      const tipo = CAMPOS_BIBLIA[d.campo]?.tipo;
      if (tipo === "lista") {
        const vs = d.valor
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean);
        if (vs.length > 30) return fail(400, "Lista demasiado larga");
        e.valor = JSON.stringify(vs);
      }
      if (tipo === "numero") {
        if (
          !d.valor.trim() ||
          !Number.isFinite(Number(d.valor)) ||
          Number(d.valor) <= 0 ||
          Number(d.valor) > 120
        )
          return fail(400, "Duración inválida");
        e.valor = JSON.stringify(Number(d.valor));
      }
      if (d.campo.startsWith("publicacion.")) {
        e.campo = d.campo + ".indicaciones";
      }
      break;
    }
    case "redes":
      if (
        typeof d.perfil !== "string" ||
        !/^[A-Za-z0-9_.-]{2,60}$/.test(d.perfil) ||
        !Array.isArray(d.redes) ||
        !d.redes.length ||
        d.redes.some(
          (r) => !["youtube", "tiktok", "instagram", "facebook"].includes(r),
        )
      )
        return fail(400, "Redes inválidas");
      try {
        new Intl.DateTimeFormat("es", { timeZone: d.zona });
      } catch {
        return fail(400, "Zona inválida");
      }
      Object.assign(e, {
        evento: "configurar_redes",
        perfil: d.perfil,
        redes: d.redes.join(","),
        zona: d.zona,
      });
      break;
    case "metas":
      if (
        !Number.isInteger(d.videos_semana) ||
        d.videos_semana < 0 ||
        d.videos_semana > 21 ||
        !["short", "largo"].includes(d.formato) ||
        typeof d.auto !== "boolean" ||
        !Number.isFinite(d.retencion_min) ||
        d.retencion_min < 0 ||
        d.retencion_min > 1
      )
        return fail(400, "Metas inválidas");
      if (
        d.gasto_semana_usd !== undefined &&
        (!auth.admin ||
          !Number.isFinite(d.gasto_semana_usd) ||
          d.gasto_semana_usd < 0 ||
          d.gasto_semana_usd > 200)
      )
        return fail(403, "Presupuesto solo administrativo");
      Object.assign(e, {
        evento: "metas",
        videos_semana: d.videos_semana,
        formato: d.formato,
        auto: d.auto,
        retencion_min: d.retencion_min,
        ...(auth.admin && d.gasto_semana_usd !== undefined
          ? { gasto_semana_usd: d.gasto_semana_usd }
          : {}),
      });
      break;
    case "referencias":
      e.evento = "referencias";
      break;
    case "referencia": {
      if (
        !["personajes", "escenarios"].includes(d.tipo) ||
        !/^[-a-z0-9_]{1,60}$/.test(d.id || "") ||
        typeof d.descripcion !== "string" ||
        !d.descripcion.trim() ||
        d.descripcion.length > 4000 ||
        !Array.isArray(d.urls) ||
        d.urls.length > 8
      )
        return fail(400, "Referencia inválida");
      if (d.urls.some((x) => typeof x !== "string" || !urlCooper(x)))
        return fail(400, "Enlace inválido");
      const fila = trabajos.find(
        (t) => t.job_id === String(c.biblia_ruta || "").replace("trabajo:", ""),
      );
      if (!fila) return fail(409, "La biblia todavía no está lista");
      const bib = jsonCooper(fila.resultado, {}).resultado || {},
        lista = Array.isArray(bib[d.tipo]) ? bib[d.tipo] : [],
        anterior = lista.find((x) => x.id === d.id);
      const valor = {
        ...anterior,
        id: d.id,
        descripcion_fija: d.descripcion,
        referencias_urls: d.urls,
      };
      if (anterior) lista.splice(lista.indexOf(anterior), 1, valor);
      else {
        if (lista.length >= 50) return fail(400, "Demasiadas referencias");
        lista.push(valor);
      }
      Object.assign(e, {
        evento: "ajustar_biblia",
        campo: d.tipo,
        valor: JSON.stringify(lista),
      });
      break;
    }
    case "adoptar":
      if (
        !["youtube", "tiktok", "instagram"].includes(d.red) ||
        !/^@?[\w.-]{2,60}$/.test(d.cuenta || "")
      )
        return fail(400, "Cuenta inválida");
      if (
        videos.some(
          (v) => v.canal_id === c.canal_id && v.estado === "en_proceso",
        )
      )
        return fail(409, "Espera a que termine la producción del canal");
      Object.assign(e, { evento: "adoptar_cuenta", url: d.cuenta, red: d.red });
      break;
    case "idea": {
      const ch = op.canales.find((x) => x.id === c.canal_id),
        idea = ch.radar.ideas.find((x) => x.id === d.ideaId);
      if (!idea || Date.now() - Date.parse(ch.radar.fecha) > 3 * 86400000)
        return fail(409, "Actualiza las ideas del radar");
      if (
        c.estado !== "activo" ||
        !String(c.biblia_ruta).startsWith("trabajo:")
      )
        return fail(409, "El canal todavía se está preparando");
      Object.assign(e, {
        evento: "nuevo_video",
        video_id: d.id,
        tema: idea.titulo,
        formato: idea.formato,
        modo_noticia: c.modo_noticia === true,
        indicaciones: idea.gancho,
        cooper_orden_id: b.id_evento,
      });
      break;
    }
    case "decidir": {
      const a = aps.find(
        (a) =>
          a.aprobacion_id === d.id &&
          a.estado === "pendiente" &&
          canales.some((c) => c.canal_id === a.canal_id) &&
          (!a.video_id || videos.some((v) => v.video_id === a.video_id)),
      );
      if (!a) return fail(409, "La decisión ya no está pendiente");
      if (a.etapa === "gasto" && !auth.admin)
        return fail(403, "Permiso de gasto solo administrativo");
      if (!["canal", "guion", "storyboard", "final", "gasto"].includes(a.etapa))
        return fail(400, "Etapa inválida");
      if (
        !["aprobar", "cambios", "detener"].includes(d.decision) ||
        (d.decision === "cambios" &&
          (typeof d.cambios !== "string" ||
            !d.cambios.trim() ||
            d.cambios.length > 4000)) ||
        (a.etapa === "gasto" && d.decision === "cambios") ||
        (a.etapa !== "gasto" && d.decision === "detener")
      )
        return fail(400, "Decisión inválida");
      const video = videos.find((v) => v.video_id === a.video_id);
      if (video?.estado === "cancelado")
        return fail(409, "El video está cancelado");
      if (!a.url && video && ["guion", "final"].includes(a.etapa)) {
        if (video.etapa !== "aprobacion_" + a.etapa)
          return fail(409, "La etapa ya cambió");
        let pedido;
        try {
          pedido = JSON.parse(a.pedido);
          if (!pedido.contexto) throw Error();
        } catch {
          return fail(409, "Decisión incompleta");
        }
        Object.assign(e, {
          evento: d.decision === "aprobar" ? "aprobado" : "cambios",
          canal_id: video.canal_id,
          video_id: video.video_id,
          dueno_email: video.dueno_email,
          etapa: a.etapa,
          contexto: pedido.contexto,
          aprobacion_id: a.aprobacion_id,
          cambios: d.cambios || "",
        });
        break;
      }
      const url = urlEsperaCooper(a.url, aj.baseUrl);
      if (!url) return fail(409, "El formulario necesita renovarse");
      const etiqueta =
        a.etapa === "gasto"
          ? d.decision === "aprobar"
            ? "Seguir"
            : "Detener"
          : d.decision === "aprobar"
            ? "Aprobar"
            : "Pedir cambios";
      return [
        {
          json: {
            accion: "orden",
            status: 200,
            evento: {
              evento: "control_fabrica",
              accion: "decision",
              url,
              datos: {
                data: {
                  "field-0": etiqueta,
                  "field-1": String(d.cambios || ""),
                },
              },
            },
          },
        },
      ];
    }
    case "reintentar": {
      const v = videos.find((v) => v.video_id === d.videoId),
        f = op.fallos.find((f) => f.videoId === d.videoId);
      if (!v || !f) return fail(409, "No hay un fallo pendiente");
      if (f.reintento === "consultar")
        return [
          {
            json: {
              accion: "orden",
              status: 200,
              evento: {
                evento: "control_fabrica",
                accion: "consultar",
                video_id: v.video_id,
              },
            },
          },
        ];
      if (f.reintento !== "corregir" || v.estado === "cancelado")
        return fail(409, "Revisa el resultado antes de repetir");
      Object.assign(e, {
        evento: "corregir",
        video_id: v.video_id,
        canal_id: v.canal_id,
        dueno_email: v.dueno_email,
        etapa: ["guion", "verificacion", "aprobacion_guion"].includes(v.etapa)
          ? "guion"
          : "storyboard",
        instruccion:
          "Reintento solicitado desde Cooper: revisa el fallo anterior y corrige la última versión conservando las aprobaciones.",
      });
      break;
    }
    default:
      return fail(400, "Acción desconocida");
  }
  return [{ json: { accion: "orden", status: 200, evento: e } }];
}
