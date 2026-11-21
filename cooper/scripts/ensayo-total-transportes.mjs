/**
 * Transportes ficticios para la copia aislada de n8n del ensayo total.
 * No hacen peticiones, no contienen credenciales y no modifican lógica de negocio.
 * Contratos contrastados con los parsers de workflows/v2 y la documentación de n8n:
 * https://docs.n8n.io/data/data-structure/
 * https://docs.n8n.io/data/data-mapping/data-item-linking/item-linking-code-node/
 *
 * Una respuesta aceptada prueba el cableado, no la calidad ni disponibilidad del
 * proveedor. Los medios son un PNG, un tono PCM y un MP4 sintético de 8 s;
 * no son medios generados por proveedores ni comprueban su calidad.
 * El archivo de Pexels contiene únicamente metadatos ficticios: sus URLs .invalid
 * no sirven bytes de video, y el render simulado tampoco los descarga.
 * Contratos opcionales contrastados el 21-11-2026:
 * https://aistudio.google.com/docs/omni
 * https://developers.google.com/youtube/data/guides/using_resumable_upload_protocol
 * https://developers.heygen.com/reference/create-video
 * https://developers.epidemicsound.com/docs/mcp/
 */

const HTTP = "n8n-nodes-base.httpRequest";
const TELEGRAM = "n8n-nodes-base.telegram";
const INTERNOS = new Set([
  "FabCooperAPI0001:Consultar orden",
  "FabCooperAPI0001:Reservar orden",
  "FabCooperAPI0001:Confirmar orden",
  "FabCooperAPI0001:Responder decisión de Cooper",
  "FabCooperProgr01:Avisar a Cooper",
  "FabPresentacion1:Consultar Cooper",
  "CooperMarcasPub1:Atender marcas en Cooper",
  "CooperMarcasMet1:Atender marcas en Cooper",
]);

function familia(workflow, node) {
  if (node.type === TELEGRAM) return "telegram";
  const nombreInterno = node.name.replace(/ · intento [1-4]$/, "");
  const key = `${workflow.id}:${nombreInterno}`;
  if (INTERNOS.has(key)) return null;
  const url = String(node.parameters?.url || "");
  if (node.name === "Despertar routine") return "claude";
  if (node.name === "Analizar con el plan de la PC") return "aprendizaje-plan";
  if (node.name === "Intentar Codex" || /puente-codex/.test(url))
    return "texto";
  if (/api\.openai\.com/.test(url))
    return /Texto/.test(workflow.id) ? "texto" : "openai";
  if (/mcp\.vidiq\.com/.test(url)) return "vidiq";
  if (/www\.googleapis\.com\/(?:upload\/)?drive\/v3/.test(url)) return "drive";
  if (/generativelanguage\.googleapis\.com/.test(url)) return "gemini";
  if (/api\.creatomate\.com/.test(url)) return "creatomate";
  if (/api\.upload-post\.com/.test(url)) return "uploadpost";
  if (/youtubeanalytics\.googleapis\.com/.test(url)) return "metricas-youtube";
  if (/api\.heygen\.com/.test(url)) return "heygen";
  if (/api\.elevenlabs\.io/.test(url)) return "elevenlabs";
  if (/epidemicsound\.com/.test(url)) return "epidemic";
  if (/api\.pexels\.com/.test(url)) return "pexels";
  if (/pixabay\.com/.test(url)) return "pixabay";
  if (
    /oauth2\.googleapis\.com|www\.googleapis\.com\/(?:upload\/)?youtube\/v3/.test(
      url,
    ) ||
    node.name === "Subir a YouTube"
  )
    return "youtube";
  if (
    ["Descargar render", "Descargar clip", "Probar enlace"].includes(node.name)
  )
    return "descarga";
  // Un transporte nuevo no obtiene un éxito genérico que pudiera ocultar un corte.
  return "no-soportado";
}

/** Se serializa dentro de Code v2. No cerrar sobre variables de este módulo. */
function responderTransporte(config, entrada, indice, contexto) {
  const { proveedor, nombre, flujo, clips, noticia } = config;
  const { nodo, ejecucion, pasada, binario } = contexto;
  const id = (prefijo) =>
    `${prefijo}-${ejecucion}-${nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 32)}-${pasada}-${indice}`;
  const salida = (json, binary) => ({
    json,
    ...(binary ? { binary } : {}),
    pairedItem: { item: indice },
  });
  const url = (tipo) =>
    `https://ensayo.invalid/${tipo}/${encodeURIComponent(id(tipo))}`;
  const respuestaTexto = (valor) => ({
    id: id("respuesta"),
    status: "completed",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [
          { type: "output_text", text: JSON.stringify(valor), annotations: [] },
        ],
      },
    ],
    usage: { input_tokens: 100, output_tokens: 100, total_tokens: 200 },
  });
  const mcp = (valor) => {
    const mensaje = {
      jsonrpc: "2.0",
      id: 1,
      result: {
        content: [
          {
            type: "text",
            text: typeof valor === "string" ? valor : JSON.stringify(valor),
          },
        ],
        isError: false,
      },
    };
    return salida({
      data: JSON.stringify(mensaje),
      body: JSON.stringify(mensaje),
      statusCode: 200,
      headers: { "mcp-session-id": "sesion-ficticia-sin-credenciales" },
    });
  };
  const duracionVoz = () => {
    const p = nodo("Textos de voz", indice) || entrada;
    const palabras = String(p.texto || "")
      .replace(/<[^>]+>/g, "")
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, palabras / 2.5);
  };
  const pcm = () => {
    const frecuencia = 24000,
      muestras = Math.round(duracionVoz() * frecuencia);
    const b = Buffer.alloc(muestras * 2);
    for (let i = 0; i < muestras; i++)
      b.writeInt16LE(
        Math.round(4000 * Math.sin((2 * Math.PI * 440 * i) / frecuencia)),
        i * 2,
      );
    return b.toString("base64");
  };
  // MP4 H.264 de 16x16, ocho segundos, color liso y sin audio, creado offline:
  // ffmpeg -f lavfi -i color=c=0x192d40:s=16x16:r=1 -t 8 -an -c:v libx264
  //   -pix_fmt yuv420p -movflags +faststart -map_metadata -1 sintetico.mp4
  const mp4 =
    "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAOQbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAH0AAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAArt0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAH0AAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAB9AAACAAAABAAAAAAIzbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAACAABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAAB3m1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAZ5zdGJsAAAAvnN0c2QAAAAAAAAAAQAAAK5hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFExhdmM2My4xLjEwMiBsaWJ4MjY0AAAAAAAAAAAAAAAAGP//AAAANGF2Y0MBZAAK/+EAF2dkAAqs2V7ARAAAAwAEAAADAAg8SJZYAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAAMlAAAAAAAAABhzdHRzAAAAAAAAAAEAAAAIAABAAAAAABRzdHNzAAAAAAAAAAEAAAABAAAASGN0dHMAAAAAAAAABwAAAAEAAIAAAAAAAQABQAAAAAABAACAAAAAAAEAAAAAAAAAAQAAQAAAAAABAAEAAAAAAAIAAEAAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAAIAAAAAQAAADRzdHN6AAAAAAAAAAAAAAAIAAACyQAAAAwAAAAMAAAADAAAAAwAAAASAAAADgAAAAwAAAAUc3RjbwAAAAAAAAABAAADwAAAAGF1ZHRhAAAAWW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxkYXRhAAAAAQAAAABMYXZmNjMuMS4xMDIAAAAIZnJlZQAAAy1tZGF0AAACrQYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NSByMzIyMiBiMzU2MDVhIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAAUZYiEABf//u6CvgU3SlA+7slpoEUAAAAIQZokbEF//vAAAAAIQZ5CeILfjIEAAAAIAZ5hdEFfkoAAAAAIAZ5jakFfkoEAAAAOQZpnSahBaJlMCCv//vEAAAAKQZ6FRREsFf+SgQAAAAgBnqZqQV+SgQ==";
  const videoBinario = (campo) => ({
    [campo]: {
      data: mp4,
      mimeType: "video/mp4",
      fileName: "ensayo-sintetico.mp4",
    },
  });
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMoX3XmPwAGdgLtG/Qd7AAAAABJRU5ErkJggg==";
  if (proveedor === "telegram")
    return salida({
      ok: true,
      result: {
        message_id: 1000 + indice,
        chat: { id: 0, type: "private" },
        text: "Aviso ficticio del ensayo local",
      },
    });
  if (proveedor === "claude")
    return salida({ ok: true, aceptado: true, ensayo: true });
  if (proveedor === "aprendizaje-plan") {
    const pedido = nodo("Pedido al plan de aprendizaje", indice) || entrada;
    const evidencias = JSON.parse(pedido.prompt.split("EVIDENCIA: ").at(-1));
    const evidencia = evidencias.find((e) => e.metricas.vistas !== null);
    if (!evidencia)
      throw new Error("Ensayo: aprendizaje sin evidencia de vistas");
    return salida({
      texto: JSON.stringify({
        resumen: "Ensayo: hipótesis visual basada en datos ficticios.",
        lecciones: [
          {
            regla: "Mostrar el cambio de color desde el primer plano",
            causa:
              "Hipótesis de ensayo: el inicio visual puede influir en las vistas, sin demostrar causalidad.",
            correccion:
              "Probar una apertura visual y comparar otra publicación.",
            origenes: [
              {
                video_id: evidencia.video_id,
                red: evidencia.red,
                ventana: evidencia.ventana,
                metrica: "vistas",
              },
            ],
          },
        ],
      }),
      llamadas: [],
    });
  }
  if (proveedor === "texto") {
    const pedido = nodo("Pedido de texto", 0) || entrada;
    const tarea = pedido.tarea || pedido.local?.tarea;
    const respuestas = {
      critico_nicho: {
        sin_fuente: [],
        riesgos: [],
        veredicto: "Apto para el ensayo ficticio.",
      },
      critico: {
        gancho: 9,
        promesa: 9,
        claridad: 9,
        emocion: 9,
        exactitud: 9,
        originalidad: 9,
        problemas: [],
      },
      verificador: { cifras: [], faltantes: [], cuenta: [] },
      radar: null,
      radar_noticia: {
        noticia: noticia
          ? {
              titulo: "Boletín ficticio: medición de 12 unidades",
              fecha: new Date(Date.now() - 1000).toISOString(),
              hechos: [
                {
                  id: "h1",
                  dato: "La medición es de 12 unidades.",
                  fuentes: [
                    {
                      url: "https://ensayo.invalid/radar/datos",
                      titulo: "Boletín primario ficticio",
                      fecha: new Date(Date.now() - 1000).toISOString(),
                    },
                  ],
                },
              ],
            }
          : null,
      },
    };
    let fuentes = ["https://ensayo.invalid/radar/datos"];
    if (tarea === "radar") {
      const prompt =
        pedido.local?.prompt ||
        (pedido.body?.input || [])
          .flatMap((m) => m.content || [])
          .find((c) => c.type === "input_text")?.text ||
        "";
      const canal = JSON.parse(
        prompt.match(/Canal\/marca: (\{[^\n]*\})\./)?.[1] || "{}",
      );
      if (!canal.nombre) throw new Error("Ensayo: Radar sin nombre de canal");
      const competidores = [1, 2, 3].map((i) => ({
        nombre: `Cuenta ficticia ${i}`,
        red: "youtube",
        url: `https://www.youtube.com/@ensayo${i}`,
        pais: "Perú",
        patron: "Hipótesis ficticia de contraste visual",
        muestras: [100, 120, 80, 600].map((vistas, k) => ({
          titulo: `Ensayo ${k}`,
          formato: "short",
          vistas,
          fecha: new Date(Date.now() - (10 - k) * 86400000).toISOString(),
          url: `https://www.youtube.com/shorts/ensayo${i}${k}`,
        })),
      }));
      const comprobaciones = ["youtube", "tiktok"].map((red) => ({
        red,
        consulta: `"${canal.nombre}" ${red}`,
        estado: "consultado",
        alcance: "Resultados ficticios locales; ninguna consulta a la red.",
        url:
          red === "youtube"
            ? `https://www.youtube.com/results?search_query=${encodeURIComponent(canal.nombre)}`
            : `https://www.tiktok.com/search?q=${encodeURIComponent(canal.nombre)}`,
      }));
      respuestas.radar = {
        resumen:
          "Evidencia ficticia local para probar el contrato de competencia",
        competidores,
        comprobaciones,
        homonimos: [],
        ideas: [
          {
            titulo: "3 pasos para explicar un margen",
            gancho: "Vender más no siempre deja más.",
            red: "youtube",
            formato: "short",
            por_que: "Hipótesis de vistas con datos ficticios",
            fuente_url: competidores[0].muestras[3].url,
          },
        ],
      };
      fuentes = [
        ...competidores.flatMap((c) => [
          c.url,
          ...c.muestras.map((m) => m.url),
        ]),
        ...comprobaciones.map((c) => c.url),
      ];
    }
    if (tarea === "verificador_noticia") {
      const textos = (pedido.body?.input || [])
        .flatMap((m) => m.content || [])
        .filter((c) => c.type === "input_text")
        .map((c) => c.text);
      const encargo = JSON.parse(
        String(textos.at(-1) || pedido.local?.prompt || "")
          .split("\n")
          .at(-1),
      );
      const fuente = encargo.noticia || encargo;
      if (!Array.isArray(fuente.hechos) || !fuente.hechos.length)
        throw new Error(
          "Ensayo: noticia sin hechos en el pedido de verificación",
        );
      respuestas.verificador_noticia = {
        verificado: true,
        guion_cubierto: true,
        hechos: fuente.hechos.map((h) => ({ ...h, estado: "ok" })),
        resumen: "Verificación ficticia local",
      };
    }
    const valor = respuestas[tarea];
    if (!valor) throw new Error(`Ensayo: tarea de texto sin fixture: ${tarea}`);
    const respuesta = respuestaTexto(valor);
    if (nombre === "Respaldo OpenAI" && pedido.local?.buscar_web) {
      respuesta.output.push({
        type: "web_search_call",
        status: "completed",
        action: {
          type: "search",
          sources: fuentes.map((url) => ({ url })),
        },
      });
    }
    return salida({
      ...respuesta,
      ruta: nombre === "Respaldo OpenAI" ? "openai_api" : "codex",
      busqueda_real: true,
      fuentes_consultadas: fuentes,
      ensayo: true,
    });
  }
  if (proveedor === "vidiq") {
    if (/^Iniciar|listo$/.test(nombre))
      return mcp("Sesión ficticia inicializada");
    if (nombre === "Puntuar título")
      return mcp(`score: ${90 - indice} / 100. Resultado ficticio.`);
    return mcp({
      origen: "fixture local, sin consultas externas",
      fuente_url: "https://ensayo.invalid/radar/datos",
      termino:
        entrada.args?.query || entrada.args?.keyword || "economía cotidiana",
      videos: [
        {
          titulo: "3 pasos para explicar un margen",
          url: "https://ensayo.invalid/radar/formato",
          vistas: 1200,
          retencion: 0.72,
        },
      ],
      palabras_clave: ["margen", "costos", "ventas"],
    });
  }
  if (proveedor === "drive") {
    if (nombre === "Carpeta del canal: buscar") return salida({ files: [] });
    if (/^Compartir/.test(nombre))
      return salida({ id: id("permiso"), type: "anyone", role: "reader" });
    if (/^Nombrar|: nombrar$/.test(nombre)) return salida({ id: entrada.id });
    return salida({
      id: id("archivo"),
      name:
        entrada.nombre ||
        entrada.plano_id ||
        entrada.plano?.id ||
        "medio-ficticio",
      mimeType: "application/octet-stream",
    });
  }
  if (proveedor === "openai") {
    if (nombre === "Revisar archivo")
      return salida(
        respuestaTexto({ elegido: 1, motivo: "Archivo ficticio compatible." }),
      );
    if (nombre === "Revisar plano")
      return salida(respuestaTexto({ aprobado: true, problemas: [] }));
    if (/Generar|Imagen de miniatura/.test(nombre))
      return salida({
        id: id("imagen"),
        status: "completed",
        output: [
          { type: "image_generation_call", status: "completed", result: png },
        ],
        usage: { input_tokens: 100, output_tokens: 100, total_tokens: 200 },
      });
    throw new Error(`Ensayo: transporte OpenAI sin fixture: ${nombre}`);
  }
  if (proveedor === "gemini") {
    if (nombre === "Consultar archivo de clip")
      return salida({
        name: entrada.clip_nombre,
        state: Number(entrada.clip_consultas || 0) ? "ACTIVE" : "PROCESSING",
      });
    if (nombre === "Animar (Gemini Omni)") {
      // Dos planos en una ejecución cubren los dos formatos oficiales de entrega.
      const porUri =
        clips === "uri" || (clips === "alternar" && indice % 2 === 1);
      return salida({
        id: id("clip"),
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [
              {
                type: "video",
                mime_type: "video/mp4",
                ...(porUri
                  ? {
                      uri:
                        "https://generativelanguage.googleapis.com/v1beta/files/clip-" +
                        indice +
                        ":download?alt=media",
                    }
                  : { data: mp4 }),
              },
            ],
          },
        ],
      });
    }
    if (nombre !== "Voz (Gemini TTS)")
      throw new Error(`Ensayo: transporte Gemini sin fixture: ${nombre}`);
    return salida({
      id: id("voz"),
      steps: [
        {
          type: "model_output",
          content: [
            { type: "audio", mime_type: "audio/l16;rate=24000", data: pcm() },
          ],
        },
      ],
    });
  }
  if (proveedor === "elevenlabs")
    return salida({
      audio_base64: pcm(),
      alignment: {
        characters: [],
        character_start_times_seconds: [],
        character_end_times_seconds: [],
      },
    });
  if (proveedor === "heygen") {
    if (nombre === "Voz (HeyGen)")
      return salida({
        data: { audio_url: url("voz"), duration: duracionVoz() },
      });
    if (nombre === "Crear avatar")
      return salida({ data: { video_id: id("avatar") } });
    const inicio = nodo("Inicio", 0) || {};
    return salida({
      data: {
        id: nodo("Trabajo avatar", 0)?.id || id("avatar"),
        status: "completed",
        video_url: url("avatar"),
        duration: inicio.voz?.duracion_s || 10,
      },
    });
  }
  if (proveedor === "creatomate") {
    const esMiniatura = /miniatura/.test(nombre);
    const creador = esMiniatura
      ? "Renderizar miniatura"
      : flujo === "FabDerivados0001"
        ? "Renderizar corte"
        : "Renderizar";
    const creada = nodo(creador, indice);
    if (/^Consultar/.test(nombre) && creada)
      return salida({ ...creada, status: "succeeded" });
    const source = entrada.source || {};
    const duracion = (source.elements || [])
      .filter((x) => x.type === "composition")
      .reduce((suma, x) => suma + Number(x.duration || 0), 0);
    return salida({
      id: id("render"),
      status: "succeeded",
      url: url(esMiniatura ? "miniatura.png" : "render.mp4"),
      duration: Number(duracion.toFixed(2)) || source.duration || 1,
      width: source.width || 1920,
      height: source.height || 1080,
    });
  }
  if (proveedor === "uploadpost") {
    if (nombre === "Subir a redes")
      return salida({
        request_id: id("publicacion"),
        job_id: id("publicacion"),
        status: "scheduled",
      });
    const redes = String(entrada.plataformas || "youtube")
      .split(",")
      .filter(Boolean);
    if (nombre === "Métricas en redes")
      return salida({
        platforms: Object.fromEntries(
          redes.map((red) => [
            red,
            {
              success: true,
              post_metrics: {
                views: 1200,
                likes: 84,
                comments: 12,
                retention: [
                  { second: 0, percentage: 1 },
                  { second: 5, percentage: 0.72 },
                ],
              },
            },
          ]),
        ),
      });
    return salida({
      status: "completed",
      results: redes.map((red) => ({
        platform: red,
        success: true,
        platform_post_id: "ENSAYO00001",
        post_url: `https://ensayo.invalid/${red}/${encodeURIComponent(entrada.video_id || id("post"))}`,
        skipped: false,
        fallback_to_inbox: false,
      })),
    });
  }
  if (proveedor === "metricas-youtube") {
    if (nombre === "Retención")
      return salida({
        columnHeaders: [
          { name: "elapsedVideoTimeRatio" },
          { name: "audienceWatchRatio" },
        ],
        rows: [
          [0, 1],
          [0.5, 0.75],
          [1, 0.55],
        ],
      });
    return salida({
      columnHeaders: [
        "views",
        "likes",
        "comments",
        "averageViewPercentage",
      ].map((name) => ({ name })),
      rows: [[1200, 84, 12, 72]],
    });
  }
  if (proveedor === "epidemic") {
    if (/^Iniciar|listo$/.test(nombre))
      return mcp("Sesión ficticia inicializada");
    if (/^Pedir/.test(nombre))
      return mcp({ data: { asset: { assetUrl: url("audio.wav") } } });
    const recording = {
      id: "pista-ficticia",
      title: "Tono del ensayo",
      durationInSeconds: 300,
      mainArtists: [{ name: "Fixture local" }],
    };
    const soundEffect = {
      id: "efecto-ficticio",
      title: "Tono del ensayo",
      audioFile: { durationInMilliseconds: 1000 },
    };
    return mcp({ data: { search: { nodes: [{ recording, soundEffect }] } } });
  }
  if (proveedor === "pexels") {
    const consulta = String(
      entrada.plano?.busqueda_archivo ||
        entrada.plano?.prompt_imagen ||
        entrada.query ||
        "",
    );
    if (/sin[\s_-]*resultados/i.test(consulta)) return salida({ videos: [] });
    const vertical =
      (nodo("Plan de producción", 0)?.formato || entrada.formato) === "short";
    const width = vertical ? 1080 : 1920;
    const height = vertical ? 1920 : 1080;
    // Solo contrato de búsqueda: no representa un archivo descargado o generado.
    return salida({
      page: 1,
      per_page: 10,
      total_results: 1,
      videos: [
        {
          id: 1000 + indice,
          width,
          height,
          duration: 12,
          url: url("archivo-metadatos"),
          image: url("archivo-miniatura.png"),
          user: { name: "Fixture local de metadatos" },
          video_files: [
            {
              id: 2000 + indice,
              file_type: "video/mp4",
              quality: "hd",
              width,
              height,
              link: url("archivo-ficticio.mp4"),
            },
          ],
        },
      ],
    });
  }
  if (proveedor === "pixabay") return salida({ hits: [] });
  if (proveedor === "youtube") {
    if (/Renovar|Canjear/.test(nombre))
      return salida({
        access_token: "TOKEN_FICTICIO_SIN_AUTORIDAD",
        token_type: "Bearer",
        expires_in: 3600,
      });
    if (/Abrir subida/.test(nombre))
      return salida({
        headers: { location: "https://ensayo.invalid/subida-youtube" },
        statusCode: 200,
      });
    if (nombre === "Subir a YouTube") {
      if (!binario?.data || binario.data.mimeType !== "video/mp4")
        throw new Error("Ensayo: YouTube no recibió el binario MP4 en data");
      return salida({
        id: "ENSAYO00001",
        status: { uploadStatus: "processed", privacyStatus: "private" },
      });
    }
    return salida({
      items: [
        {
          id: "UC_ENSAYO_LOCAL",
          snippet: { title: "Canal ficticio local" },
          statistics: {
            subscriberCount: "100",
            videoCount: "3",
            viewCount: "3600",
          },
        },
      ],
    });
  }
  if (
    proveedor === "descarga" &&
    ["Descargar clip", "Descargar render"].includes(nombre)
  ) {
    if (nombre === "Descargar clip" && entrada.clip_listo !== true)
      throw new Error("Ensayo: el archivo del clip todavía no está ACTIVE");
    return salida(
      {},
      videoBinario(nombre === "Descargar clip" ? "imagen" : "data"),
    );
  }
  if (proveedor === "descarga" && nombre === "Probar enlace")
    return salida({
      statusCode: 200,
      headers: { "content-type": "image/png" },
    });
  throw new Error(
    `Ensayo: transporte sin fixture válido: ${flujo}/${nombre} (${proveedor})`,
  );
}

/**
 * Devuelve una copia; jamás altera el workflow original ni reescribe conexiones,
 * nodos Code, esperas, aprobaciones, acceso a Data Tables o lógica de negocio.
 * Los HTTP internos conservados requieren el aislamiento de red del runner.
 */
export function adaptarTransportes(workflow, opciones = {}) {
  const clips = opciones.clips || "alternar";
  if (!["inline", "uri", "alternar"].includes(clips))
    throw new Error("Ensayo: modo de fixture de clips inválido");
  const copia = structuredClone(workflow);
  const sustituciones = [];
  for (const node of copia.nodes) {
    if (![HTTP, TELEGRAM].includes(node.type)) continue;
    const proveedor = familia(copia, node);
    if (!proveedor) continue;
    const config = {
      proveedor,
      nombre: node.name,
      flujo: copia.id,
      clips,
      noticia: opciones.noticia === true,
    };
    sustituciones.push({
      workflow_id: copia.id,
      nodo_id: node.id,
      nodo: node.name,
      tipo_original: node.type,
      proveedor,
      soportado:
        proveedor !== "no-soportado" &&
        !(
          proveedor === "gemini" &&
          ![
            "Voz (Gemini TTS)",
            "Animar (Gemini Omni)",
            "Consultar archivo de clip",
          ].includes(node.name)
        ),
      ...(proveedor === "gemini" && node.name === "Animar (Gemini Omni)"
        ? { fixture: clips }
        : {}),
      ...(proveedor === "descarga" && node.name !== "Probar enlace"
        ? { fixture: "mp4-sintetico-8s" }
        : {}),
    });
    node.type = "n8n-nodes-base.code";
    node.typeVersion = 2;
    node.parameters = {
      mode: "runOnceForAllItems",
      jsCode: `// Transporte ficticio: ${proveedor}; nunca sale a la red.\nconst responder = ${responderTransporte.toString()};\nconst config = ${JSON.stringify(config)};\nconst contexto = { ejecucion: String($execution.id), pasada: $runIndex, nodo: (nombre, indice) => { try { const n = $(nombre); if (!n.isExecuted) return null; try { return n.itemMatching(indice).json; } catch { return n.all()[indice]?.json || n.first().json; } } catch { return null; } } };\nreturn $input.all().map((item, indice) => responder(config, item.json, indice, { ...contexto, binario: item.binary }));`,
    };
    delete node.credentials;
    delete node.webhookId;
  }
  return { workflow: copia, sustituciones };
}
