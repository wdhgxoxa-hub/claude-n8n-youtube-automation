/** Recorridos opcionales sobre los workflows reales importados por ensayo-total. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { until } from "./ensayo-infra.mjs";

const escenarios = [
  { nombre: "avatar-completo", avatar: "completo", voz: "gemini" },
  { nombre: "avatar-partes-heygen", avatar: "partes", voz: "heygen" },
  { nombre: "avatar-partes-elevenlabs", avatar: "partes", voz: "elevenlabs" },
  { nombre: "clips", clips: true },
  { nombre: "youtube-directo", youtube: true },
  { nombre: "musica", musica: true },
  { nombre: "noticia", noticia: true },
];
const hash = (x) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");

export async function ejecutarRamas(ctx) {
  const {
    api,
    ids,
    modified,
    body,
    insert,
    rows,
    rounds,
    evidence,
    save,
    call,
    job,
    callback,
    approval,
    wait,
    payloadTrabajo,
    biblia,
  } = ctx;
  const ajustesBase = structuredClone(
    modified.find((w) => w.id === ids.FabAjustes000001),
  );
  evidence.ramas = [];
  const seleccion = process.env.COOPER_RAMAS_CASOS?.split(",");
  for (const caso of escenarios.filter(
    (c) => !seleccion || seleccion.includes(c.nombre),
  )) {
    const ajustes = structuredClone(ajustesBase);
    const nodo = ajustes.nodes.find((n) => n.name === "Ajustes");
    for (const [flag, enabled] of Object.entries({
      allowAvatar: !!caso.avatar,
      allowClips: !!caso.clips,
      allowMusica: !!caso.musica,
      allowEfectos: !!caso.musica,
      allowYoutube: !!caso.youtube,
    }))
      nodo.parameters.jsCode = nodo.parameters.jsCode.replace(
        new RegExp(`(${flag}:\\s*)(?:true|false)`),
        `$1${enabled}`,
      );
    nodo.parameters.jsCode = nodo.parameters.jsCode.replace(
      /(maxVideosDiaTotal:\s*)\d+/,
      (_, prefix) => prefix + "100",
    );
    await api.request("PUT", `/workflows/${ajustes.id}`, body(ajustes));
    await api.request("POST", `/workflows/${ajustes.id}/publish`, {});
    for (let ronda = 1; ronda <= rounds; ronda++) {
      const inicio = Date.now(),
        canal_id = `ramas-${caso.nombre}-${ronda}`,
        video_id = canal_id + "-video";
      const previo = new Set((await api.all("/executions")).map((e) => e.id));
      const registro = {
        rama: caso.nombre,
        ronda,
        canal_id,
        video_id,
        inicio: new Date(inicio).toISOString(),
        pasos: [],
      };
      evidence.ramas.push(registro);
      save();
      await insert("canales", [
        {
          canal_id,
          nombre: caso.nombre,
          nicho: "Ciencia de ensayo",
          estado: "activo",
          eliminado: false,
          dueno_email: "total@example.test",
          biblia_ruta: "trabajo:" + canal_id + "-biblia",
          formato_defecto: "short",
          presupuesto_short_usd: 100,
          presupuesto_largo_usd: 100,
          uploadpost_perfil: caso.youtube ? "" : "perfil-ficticio",
          redes: "youtube",
          plataformas: "youtube",
        },
      ]);
      await insert("trabajos", [
        {
          job_id: canal_id + "-biblia",
          canal_id,
          modo: "crear_biblia",
          estado: "listo",
          resultado: JSON.stringify({ resultado: biblia }),
        },
      ]);
      if (caso.youtube)
        await insert("youtube", [
          {
            canal_id,
            estado: "conectado",
            refresh_token: "REFRESH_FICTICIO_SIN_AUTORIDAD",
            canal_youtube_id: "UC_ENSAYO_LOCAL",
          },
        ]);
      const presentacion = caso.avatar
        ? {
            version: 1,
            presencia: caso.avatar,
            avatar: {
              recurso_id: "avatar-local",
              proveedor: "heygen",
              id: "look-ficticio",
              tipo: "propio",
            },
            voz: {
              recurso_id: "voz-local",
              proveedor: caso.voz,
              id: caso.voz === "gemini" ? "Charon" : "voz-ficticia",
              tipo: caso.voz === "gemini" ? "catalogo" : "propio",
            },
          }
        : null;
      await call("orquestador", {
        evento: "nuevo_video",
        canal_id,
        video_id,
        formato: "short",
        tema: caso.noticia
          ? "Medición sintética del día"
          : "Cielo al atardecer",
        modo_noticia: !!caso.noticia,
        ...(presentacion
          ? { presentacion, cooper_orden_id: `orden-${video_id}` }
          : {}),
      });
      const guion = {
        titulo: caso.noticia
          ? "La medición es de 12 unidades"
          : "La luz del atardecer",
        tema_elegido: "Ciencia de ensayo",
        ganchos: ["Mira cómo cambia la luz"],
        gancho_elegido: 0,
        guion: caso.noticia
          ? "La medición es de 12 unidades. El esquema presenta esa medición, y la cifra de 12 unidades aparece representada en pantalla."
          : "La luz del sol cruza el aire. Al atardecer vemos colores cálidos.",
        rubrica: {
          gancho: 9,
          promesa: 9,
          claridad: 9,
          emocion: 9,
          exactitud: 9,
          originalidad: 9,
        },
      };
      const t = await job("guion", canal_id, video_id);
      const pedido = await payloadTrabajo(t.job_id);
      if (caso.noticia) assert.equal(pedido.datos.modo_noticia, true);
      if (presentacion)
        assert.deepEqual(pedido.datos.presentacion, presentacion);
      await callback(t, guion);
      await approval(canal_id, video_id, "guion");
      registro.pasos.push("guion verificado y aprobado");
      save();
      const storyJob = await job("storyboard", canal_id, video_id);
      const storyboard = {
        planos: [1, 2, 3].map((i) => ({
          id: `p0${i}`,
          tipo: caso.clips
            ? i < 3
              ? "clip"
              : "imagen"
            : caso.noticia || caso.avatar
              ? "imagen"
              : i < 3
                ? "archivo"
                : "imagen",
          ...(caso.avatar === "partes" ? { usa_avatar: i === 1 } : {}),
          ...(caso.noticia
            ? {
                origen_visual: "generado",
                recurso_didactico: "cifra",
                hecho_ids: ["h1"],
              }
            : {}),
          texto_narrado: caso.noticia
            ? "La medición es de 12 unidades. El esquema presenta esa medición, y la cifra de 12 unidades aparece representada en pantalla."
            : "La luz del sol cruza el aire y sus colores se dispersan en distintas direcciones mientras observamos el cielo desde nuestra ventana.",
          prompt_imagen: caso.noticia
            ? "Esquema original de doce unidades"
            : "Diagrama propio del cielo y la luz",
          busqueda: "cielo",
          encuadre: "general",
          movimiento: "zoom lento",
          personajes: [],
          escenario: "cielo",
          transicion: "corte",
          texto_pantalla: "",
        })),
        musica: caso.musica ? { estilo: "cinematic calm" } : {},
        efectos: caso.musica
          ? [
              { plano: "p01", efecto: "soft wind" },
              { plano: "p02", efecto: "bell" },
            ]
          : [],
        cortes: [],
        miniatura: {},
        publicacion: {
          youtube: {
            titulos: [guion.titulo],
            descripcion: "Ensayo sintético local",
          },
        },
      };
      await callback(storyJob, storyboard);
      await approval(canal_id, video_id, "storyboard");
      const final = await wait(
        async () => {
          const v = (await rows("videos")).find((v) => v.video_id === video_id);
          assert.ok(
            !["con_fallas", "detenido"].includes(v?.estado),
            `${caso.nombre}: ${v?.etapa}: ${v?.error}`,
          );
          return (await rows("aprobaciones")).find(
            (a) =>
              a.video_id === video_id &&
              a.etapa === "final" &&
              a.estado === "pendiente",
          );
        },
        "rama " + caso.nombre + " en aprobación final",
      );
      let video = (await rows("videos")).find((v) => v.video_id === video_id);
      assert.ok(video.render_url);
      const escenas = JSON.parse(video.cooper_escenas);
      assert.equal(escenas.length, 3);
      assert.ok(escenas.every((p) => p.voz && (p.imagen || p.clip)));
      if (caso.noticia) {
        assert.equal(JSON.parse(video.noticia).verificado, true);
        assert.equal(video.noticia_guion_hash, hash(guion));
        assert.equal(video.noticia_storyboard_hash, hash(storyboard));
      }
      registro.pasos.push(
        "storyboard aprobado, medios y montaje, aprobación final",
      );
      save();
      await approval(canal_id, video_id, "final");
      if (!caso.youtube) {
        await wait(
          async () =>
            (await rows("publicaciones")).some((p) => p.video_id === video_id),
          "envío simulado",
        );
        await call("confirmar", { video_id });
      }
      video = await wait(
        async () =>
          (await rows("videos")).find(
            (v) => v.video_id === video_id && v.estado === "publicado",
          ),
        "publicado " + caso.nombre,
      );
      await until(
        async () =>
          !(await api.all("/executions")).some((e) =>
            ["new", "running", "waiting"].includes(e.status),
          ),
        "rama sin ejecuciones pendientes",
        30000,
      );
      const ejecuciones = (await api.all("/executions")).filter(
        (e) => !previo.has(e.id),
      );
      const cobertura = [];
      for (const e of ejecuciones) {
        assert.equal(e.status, "success", `Ejecución ${e.id}`);
        const debeGuardar =
          modified.find((w) => w.id === e.workflowId)?.settings
            .saveDataSuccessExecution === "all";
        const detalle = await until(
          async () => {
            const d = await api.request(
              "GET",
              `/executions/${e.id}?includeData=true`,
            );
            return !debeGuardar || d.data?.resultData?.runData ? d : false;
          },
          "traza persistida " + e.id,
          30000,
        );
        const data = detalle.data?.resultData?.runData || {};
        const workflow =
          Object.keys(ids).find((k) => ids[k] === e.workflowId) ||
          "entrada-ensayo";
        cobertura.push({ id: e.id, workflow, nodos: Object.keys(data) });
        if (workflow === "FabSonido0000001" && caso.musica) {
          const sonido =
            data["Resultado sonido"]?.[0]?.data?.main?.[0]?.[0]?.json;
          assert.ok(sonido?.musica?.url);
          assert.equal(sonido.efectos.length, 2);
        }
        if (workflow === "FabProduccion001") {
          const plan =
            data["Plan de producción"]?.[0]?.data?.main?.[0]?.[0]?.json;
          if (caso.avatar)
            assert.equal(
              plan.planos.filter((p) => p.tipo === "avatar").length,
              caso.avatar === "completo" ? 3 : 1,
            );
          if (caso.clips) {
            assert.ok(plan.planos.filter((p) => p.tipo === "clip").length >= 2);
            const estados = data["Clip · estado archivo"].flatMap((r) =>
              r.data.main[0].map((i) => i.json),
            );
            assert.ok(
              estados.some(
                (e) => e.clip_consultas === 1 && !e.clip_listo && !e.clip_error,
              ),
            );
            assert.ok(
              estados.some((e) => e.clip_consultas === 2 && e.clip_listo),
            );
            assert.ok(escenas.filter((p) => p.clip).length >= 2);
            registro.archivoClip = estados.map((e) => ({
              consulta: e.clip_consultas,
              listo: e.clip_listo,
              error: e.clip_error,
            }));
          }
        }
      }
      const ejecutado = (workflow, nombre) =>
        assert.ok(
          cobertura.some(
            (e) => e.workflow === workflow && e.nodos.includes(nombre),
          ),
          `${caso.nombre}: falta ${workflow}/${nombre}`,
        );
      if (caso.avatar) {
        ejecutado("FabAvatar0000001", "Crear avatar");
        ejecutado("FabAvatar0000001", "Consultar avatar");
        ejecutado("FabPresentacion1", "Consultar Cooper");
        ejecutado(
          "FabSonido0000001",
          caso.voz === "heygen"
            ? "Voz (HeyGen)"
            : caso.voz === "elevenlabs"
              ? "Voz (ElevenLabs)"
              : "Voz (Gemini TTS)",
        );
      }
      if (caso.clips) {
        ejecutado("FabProduccion001", "Animar (Gemini Omni)");
        ejecutado("FabProduccion001", "Descargar clip");
        ejecutado("FabProduccion001", "Consultar archivo de clip");
        ejecutado("FabProduccion001", "Esperar archivo de clip");
      }
      if (caso.youtube) {
        ejecutado("FabOrquestador01", "Abrir subida YouTube");
        ejecutado("FabOrquestador01", "Subir a YouTube");
        assert.equal(video.youtube_id, "ENSAYO00001");
        assert.equal(
          (await rows("publicaciones")).filter((p) => p.video_id === video_id)
            .length,
          0,
        );
      }
      if (caso.musica) {
        ejecutado("FabSonido0000001", "Pedir descarga");
        ejecutado("FabSonido0000001", "Pedir efecto");
      }
      if (caso.noticia) {
        ejecutado("FabNoticia000001", "Verificador de noticia");
        ejecutado("FabOrquestador01", "Certificar guion noticia");
        ejecutado("FabOrquestador01", "Certificar storyboard noticia");
      }
      const propias = (await rows("aprobaciones")).filter(
        (a) => a.video_id === video_id,
      );
      assert.ok(propias.every((a) => a.estado !== "pendiente"));
      registro.pasos.push(
        "publicación confirmada simulada y aprobaciones consumidas",
      );
      Object.assign(registro, {
        resultado: "PASS",
        duracionMs: Date.now() - inicio,
        estado: video.estado,
        etapa: video.etapa,
        escenas,
        aprobacionFinal: final.aprobacion_id,
        ejecuciones: cobertura,
      });
      save();
      console.log(
        `Rama ${caso.nombre} R${ronda}: PASS (${registro.duracionMs}ms)`,
      );
    }
  }
  await api.request("PUT", `/workflows/${ajustesBase.id}`, body(ajustesBase));
  await api.request("POST", `/workflows/${ajustesBase.id}/publish`, {});
}
