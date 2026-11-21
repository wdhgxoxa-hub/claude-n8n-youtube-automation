// Contratos de las ramas opcionales con Code real generado y medios sintéticos.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const root = path.join(__dirname, "..");
const moduleUrl = pathToFileURL(
  path.join(root, "cooper/scripts/ensayo-total-transportes.mjs"),
).href;
const workflow = (id) =>
  JSON.parse(
    fs.readFileSync(path.join(root, "workflows/v2", id + ".json"), "utf8"),
  );
const prod = workflow("FabProduccion001");
const sonido = workflow("FabSonido0000001");
const asItem = (v) => (v?.json ? v : { json: v });
function ejecutar(node, input = [], nodes = {}, indice = 0) {
  const items = input.map(asItem);
  const $ = (name) => {
    const lista = (nodes[name] || []).map(asItem);
    return {
      isExecuted: Object.hasOwn(nodes, name),
      first: () => lista[0],
      last: () => lista.at(-1),
      item: lista[indice] || lista[0],
      itemMatching: (i) => lista[i] || lista[0],
      all: (_branch, run) => (run && run > 0 ? [] : lista),
    };
  };
  return new Function(
    "$",
    "$input",
    "$json",
    "$binary",
    "$execution",
    "$runIndex",
    node.parameters.jsCode,
  )(
    $,
    { all: () => items },
    items[indice]?.json || {},
    items[indice]?.binary || {},
    { id: "local-42" },
    0,
  );
}
async function adaptado(w, name, opciones = {}) {
  const { adaptarTransportes } = await import(moduleUrl);
  return adaptarTransportes(w, opciones).workflow.nodes.find(
    (n) => n.name === name,
  );
}
function original(w, name) {
  const n = w.nodes.find((n) => n.name === name);
  assert.ok(n, `Nodo existente: ${name}`);
  return n;
}
const plano = (id) => ({
  video_id: "v-ficticio",
  plano_id: id,
  plano: {
    id,
    tipo: "clip",
    texto_narrado: "Texto de voz local",
    duracion_clip_s: 8,
  },
});
function comprobarMp4(binary) {
  assert.equal(binary.mimeType, "video/mp4");
  assert.match(binary.fileName, /\.mp4$/);
  const b = Buffer.from(binary.data, "base64");
  assert.equal(b.toString("ascii", 4, 8), "ftyp");
  assert.ok(b.includes(Buffer.from("moov")) && b.includes(Buffer.from("mdat")));
}

test("ramas: los transportes conservan conexiones, nodos de negocio y HTTP internos", async () => {
  const { adaptarTransportes } = await import(moduleUrl);
  const w = workflow("FabOrquestador01");
  const antes = structuredClone(w);
  const result = adaptarTransportes(w);
  assert.deepEqual(w, antes);
  assert.deepEqual(result.workflow.connections, w.connections);
  for (const n of w.nodes.filter(
    (n) =>
      !["n8n-nodes-base.httpRequest", "n8n-nodes-base.telegram"].includes(
        n.type,
      ),
  ))
    assert.deepEqual(
      result.workflow.nodes.find((x) => x.id === n.id),
      n,
    );
  for (const n of result.workflow.nodes.filter(
    (n) => n.type === "n8n-nodes-base.code",
  ))
    assert.equal(n.credentials, undefined);
  const presentacion = workflow("FabPresentacion1");
  assert.deepEqual(
    original(adaptarTransportes(presentacion).workflow, "Consultar Cooper"),
    original(presentacion, "Consultar Cooper"),
  );
  assert.equal(
    result.sustituciones.find((n) => n.nodo === "Descargar render").fixture,
    "mp4-sintetico-8s",
  );
  assert.throws(
    () => adaptarTransportes(w, { clips: "desconocido" }),
    /modo de fixture/,
  );
});

test("ramas: dos clips recorren base64 y URI usando los extractores reales", async () => {
  assert.ok(prod);
  const entradas = [plano("p01"), plano("p02")];
  const animar = await adaptado(prod, "Animar (Gemini Omni)");
  const salida = ejecutar(animar, entradas);
  const nodoImagen = { "Extraer imagen": entradas };
  const inline = ejecutar(
    original(prod, "Extraer clip"),
    salida,
    nodoImagen,
    0,
  );
  comprobarMp4(inline.binary.imagen);
  assert.equal(inline.json.plano.id, "p01");
  const uri = ejecutar(original(prod, "Extraer clip"), salida, nodoImagen, 1);
  assert.match(
    uri.json.clip_uri,
    /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\//,
  );
  assert.equal(uri.binary, undefined);
  let archivo = ejecutar(original(prod, "Clip · preparar archivo"), [uri]);
  const consultar = await adaptado(prod, "Consultar archivo de clip");
  const bajar = await adaptado(prod, "Descargar clip");
  const consulta = () =>
    ejecutar(
      original(prod, "Clip · estado archivo"),
      ejecutar(consultar, [archivo]),
      { "Clip · consultar entrada": [archivo] },
    );
  archivo = consulta();
  assert.equal(archivo.json.clip_listo, false);
  assert.equal(archivo.json.clip_consultas, 1);
  assert.throws(() => ejecutar(bajar, [archivo]), /todavía no está ACTIVE/);
  archivo = consulta();
  assert.equal(archivo.json.clip_listo, true);
  assert.equal(archivo.json.clip_consultas, 2);
  const descarga = ejecutar(bajar, [archivo]);
  const descargado = ejecutar(original(prod, "Clip descargado"), descarga, {
    "Extraer imagen": [entradas[1]],
  });
  comprobarMp4(descargado.binary.imagen);
  assert.equal(descargado.binary.imagen.fileName, "p02.mp4");
  assert.equal(descargado.json.clip_uri, "");
  assert.deepEqual(
    salida.map((x) => x.pairedItem.item),
    [0, 1],
  );
});

test("ramas: cada modo de clip queda explícito en el manifiesto de sustitución", async () => {
  const { adaptarTransportes } = await import(moduleUrl);
  for (const modo of ["inline", "uri"]) {
    const { workflow: w, sustituciones } = adaptarTransportes(prod, {
      clips: modo,
    });
    const out = ejecutar(original(w, "Animar (Gemini Omni)"), [plano("p01")])[0]
      .json.steps[0].content[0];
    assert.equal(typeof out[modo === "uri" ? "uri" : "data"], "string");
    const manifiesto = sustituciones.find(
      (n) => n.nodo === "Animar (Gemini Omni)",
    );
    assert.equal(manifiesto.soportado, true);
    assert.equal(manifiesto.fixture, modo);
  }
});

test("ramas: YouTube requiere el binario que Descargar render entrega en data", async () => {
  const w = workflow("FabOrquestador01");
  const subir = await adaptado(w, "Subir a YouTube");
  assert.throws(() => ejecutar(subir, [{}]), /no recibió el binario MP4/);
  const descarga = ejecutar(await adaptado(w, "Descargar render"), [{}]);
  comprobarMp4(descarga[0].binary.data);
  const out = ejecutar(subir, descarga);
  assert.equal(out[0].json.id, "ENSAYO00001");
  assert.equal(out[0].json.status.privacyStatus, "private");
  const subida = ejecutar(await adaptado(w, "Abrir subida YouTube"), [{}]);
  assert.match(subida[0].json.headers.location, /^https:\/\/ensayo\.invalid\//);
  assert.equal(
    ejecutar(original(w, "Video publicado"), out, {
      "Video (publicar)": [{}],
    })[0].json.youtube_id,
    "ENSAYO00001",
  );
});

test("ramas: música y efectos atraviesan los parsers MCP reales y conservan créditos", async () => {
  const buscar = ejecutar(await adaptado(sonido, "Buscar música"), [{}]);
  const elegida = ejecutar(original(sonido, "Elegir pista"), buscar, {
    "Búsqueda de música": [{ total_s: 24 }],
  });
  assert.equal(elegida[0].json.id, "pista-ficticia");
  const descarga = ejecutar(await adaptado(sonido, "Pedir descarga"), elegida);
  const musica = ejecutar(original(sonido, "Música lista"), descarga, {
    "Elegir pista": elegida,
  });
  assert.match(musica[0].json.musica.url, /^https:\/\/ensayo\.invalid\//);
  assert.match(musica[0].json.musica.credito, /Epidemic Sound/);
  const efectos = ejecutar(await adaptado(sonido, "Buscar efecto"), [
    { plano: "p01", termino: "soft tone" },
  ]);
  const elegido = ejecutar(original(sonido, "Elegir efecto"), efectos, {
    "Efectos pedidos": [{ plano: "p01", termino: "soft tone" }],
  });
  const efecto = ejecutar(
    original(sonido, "Efecto listo"),
    ejecutar(await adaptado(sonido, "Pedir efecto"), elegido),
    { "Elegir efecto": elegido },
  );
  assert.equal(efecto[0].json.plano, "p01");
  assert.equal(efecto[0].json.duracion_s, 1);
  assert.match(efecto[0].json.credito, /Epidemic Sound/);
});

test("ramas: HeyGen y ElevenLabs usan el contrato de voz y avatar real", async () => {
  const textos = [
    {
      plano_id: "p01",
      texto: "Esta es una voz de prueba local",
      costo_voz_usd: 0.01,
    },
  ];
  const heygen = ejecutar(await adaptado(sonido, "Voz (HeyGen)"), textos, {
    "Textos de voz": textos,
  });
  const voz = ejecutar(original(sonido, "Voz HeyGen lista"), heygen, {
    "Textos de voz": textos,
  });
  assert.equal(voz.json.plano_id, "p01");
  assert.ok(voz.json.duracion_s > 0);
  const eleven = ejecutar(await adaptado(sonido, "Voz (ElevenLabs)"), textos, {
    "Textos de voz": textos,
  });
  const pcm = ejecutar(original(sonido, "PCM ElevenLabs"), eleven);
  const wav = ejecutar(original(sonido, "WAV"), [pcm], {
    "Textos de voz": textos,
  });
  assert.equal(wav.binary.archivo.mimeType, "audio/wav");
  assert.equal(
    Buffer.from(wav.binary.archivo.data, "base64").toString("ascii", 0, 4),
    "RIFF",
  );
  const avatar = workflow("FabAvatar0000001");
  const creado = ejecutar(await adaptado(avatar, "Crear avatar"), [{}]);
  const trabajo = ejecutar(original(avatar, "Trabajo avatar"), creado);
  const context = {
    Inicio: [
      {
        voz: voz.json,
        video_id: "v-ficticio",
        plano: { id: "p01", tipo: "avatar" },
      },
    ],
    "Trabajo avatar": trabajo,
    "Leer ajustes": [{ costoAvatarSegUsd: 0.01 }],
  };
  const consultado = ejecutar(
    await adaptado(avatar, "Consultar avatar"),
    trabajo,
    context,
  );
  const estado = ejecutar(original(avatar, "Estado avatar"), consultado);
  const listo = ejecutar(original(avatar, "Avatar listo"), estado, {
    ...context,
    "Estado avatar": estado,
  });
  assert.equal(listo[0].json.plano_id, "p01");
  assert.equal(listo[0].json.remoto_id, trabajo[0].json.id);
  assert.equal(listo[0].json.duracion_s, voz.json.duracion_s);
});

test("ramas: noticia es opcional y su verificador conserva hechos y fuentes del pedido", async () => {
  const w = workflow("FabTextoGPT0001");
  const leer = (out) => JSON.parse(out[0].json.output[0].content[0].text);
  const radar = { tarea: "radar_noticia", local: {} };
  const n = await adaptado(w, "Intentar Codex");
  assert.equal(
    leer(ejecutar(n, [radar], { "Pedido de texto": [radar] })).noticia,
    null,
  );
  const enabled = await adaptado(w, "Intentar Codex", { noticia: true });
  const noticia = leer(
    ejecutar(enabled, [radar], { "Pedido de texto": [radar] }),
  ).noticia;
  assert.equal(noticia.hechos[0].id, "h1");
  assert.ok(Date.parse(noticia.fecha) <= Date.now());
  for (const encargo of [
    noticia,
    { noticia, guion: "La medición es de 12 unidades." },
  ]) {
    const pedido = {
      tarea: "verificador_noticia",
      body: {
        input: [
          {
            content: [
              {
                type: "input_text",
                text: "Verifica los hechos.\n" + JSON.stringify(encargo),
              },
            ],
          },
        ],
      },
    };
    const respuesta = ejecutar(enabled, [pedido], {
      "Pedido de texto": [pedido],
    });
    const verificacion = leer(respuesta);
    assert.equal(verificacion.verificado, true);
    assert.equal(verificacion.hechos[0].estado, "ok");
    assert.deepEqual(verificacion.hechos[0].fuentes, noticia.hechos[0].fuentes);
    assert.equal(respuesta[0].json.busqueda_real, true);
    assert.ok(
      respuesta[0].json.fuentes_consultadas.includes(
        noticia.hechos[0].fuentes[0].url,
      ),
    );
  }
});

test("ramas: un transporte desconocido falla y nunca produce éxito genérico", async () => {
  const { adaptarTransportes } = await import(moduleUrl);
  const result = adaptarTransportes({
    id: "desconocido",
    nodes: [
      {
        id: "x",
        name: "Proveedor nuevo",
        type: "n8n-nodes-base.httpRequest",
        parameters: { url: "https://sin-fixture.invalid" },
      },
    ],
    connections: {},
  });
  assert.equal(result.sustituciones[0].soportado, false);
  assert.throws(
    () => ejecutar(result.workflow.nodes[0], [{}]),
    /transporte sin fixture válido/,
  );
});

const destino = (name, output = 0) =>
  (prod.connections[name]?.main[output] || []).map((e) => e.node);
const archivoClip = (extra = {}) => ({
  ...plano("p01"),
  clip_nombre: "files/clip-local",
  clip_consultas: 0,
  clip_uri:
    "https://generativelanguage.googleapis.com/v1beta/files/clip-local:download?alt=media",
  ...extra,
});
const estadoClip = (respuesta, consultas = 0) =>
  ejecutar(original(prod, "Clip · estado archivo"), [respuesta], {
    "Clip · consultar entrada": [archivoClip({ clip_consultas: consultas })],
  }).json;

test("ramas: Files solo descarga ACTIVE y limita PROCESSING con contador durable por archivo", () => {
  const pendiente = { name: "files/clip-local", state: "PROCESSING" };
  assert.equal(estadoClip(pendiente).clip_consultas, 1);
  assert.equal(estadoClip(pendiente, 38).clip_error, "");
  const agotado = estadoClip(pendiente, 39);
  assert.equal(agotado.clip_consultas, 40);
  assert.equal(agotado.clip_listo, false);
  assert.match(agotado.clip_error, /40 consultas/);
  assert.equal(
    estadoClip({ ...pendiente, state: "ACTIVE" }, 39).clip_listo,
    true,
  );
  assert.deepEqual(destino("¿Clip por URI?"), ["Clip · preparar archivo"]);
  assert.deepEqual(destino("¿Archivo de clip activo?"), ["Descargar clip"]);
  assert.deepEqual(destino("¿Archivo de clip activo?", 1), [
    "Esperar archivo de clip",
  ]);
  assert.deepEqual(destino("Esperar archivo de clip"), [
    "Clip · consultar entrada",
  ]);
  assert.equal(original(prod, "Esperar archivo de clip").parameters.amount, 5);
  assert.equal(
    original(prod, "Esperar archivo de clip").parameters.unit,
    "seconds",
  );
  assert.ok(destino("Clip · consultar entrada")[0].includes("Presentación"));
});

test("ramas: Files fallido, desconocido, distinto o con error HTTP guarda un fallo sin mensajes remotos", () => {
  for (const respuesta of [
    { name: "files/clip-local", state: "FAILED" },
    { name: "files/clip-local", state: "STATE_UNSPECIFIED" },
    { name: "files/otro-clip", state: "ACTIVE" },
    { error: { message: "CONTENIDO PRIVADO REMOTO" } },
    {},
  ]) {
    const result = estadoClip(respuesta);
    assert.equal(result.clip_listo, false);
    assert.ok(result.clip_error);
    const fallo = ejecutar(original(prod, "Clip · fallo durable"), [result])[0]
      .json;
    assert.equal(fallo.estado, "con_fallas");
    assert.equal(fallo.etapa, "produccion");
    assert.doesNotMatch(fallo.error, /CONTENIDO PRIVADO/);
  }
  assert.equal(
    original(prod, "Consultar archivo de clip").onError,
    "continueRegularOutput",
  );
  const filtros = original(prod, "Clip · guardar fallo").parameters.filters
    .conditions;
  assert.ok(
    filtros.some(
      (f) =>
        f.keyName === "eliminado" &&
        f.keyValue === true &&
        f.condition === "neq",
    ),
  );
  assert.ok(
    filtros.some(
      (f) =>
        f.keyName === "estado" &&
        f.keyValue === "cancelado" &&
        f.condition === "neq",
    ),
  );
  assert.ok(original(prod, "Cooper · sello Clip · guardar fallo"));
  assert.ok(original(prod, "Cooper · sello Clip · guardar fallo aviso"));
  assert.deepEqual(destino("¿Consulta de clip válida?", 1), [
    "Clip · fallo durable",
  ]);
});

test("ramas: la referencia Files limita origen y ruta antes de usar la credencial", () => {
  const preparar = (uri) =>
    ejecutar(original(prod, "Clip · preparar archivo"), [
      { ...plano("p01"), clip_uri: uri },
    ]).json;
  for (const uri of [
    "https://evil.invalid/v1beta/files/clip-local",
    "https://generativelanguage.googleapis.com.evil.invalid/v1beta/files/clip-local",
    "https://user:password@generativelanguage.googleapis.com/v1beta/files/clip-local",
    "http://generativelanguage.googleapis.com/v1beta/files/clip-local",
    "https://generativelanguage.googleapis.com/v1beta/files/clip-local?key=no-permitida",
    "https://generativelanguage.googleapis.com/v1beta/files/clip-local#fragmento",
    "https://generativelanguage.googleapis.com/v1beta/files/../../otro",
  ]) {
    const invalid = preparar(uri);
    assert.ok(invalid.clip_error);
    assert.equal(invalid.clip_uri, "");
    assert.equal(invalid.clip_nombre, "");
  }
  for (const tail of ["", ":download", ":download?alt=media"]) {
    const result = preparar(
      "https://generativelanguage.googleapis.com/v1beta/files/clip-local" +
        tail,
    );
    assert.equal(result.clip_nombre, "files/clip-local");
    assert.equal(result.clip_uri, archivoClip().clip_uri);
    assert.equal(result.clip_error, "");
  }
  assert.deepEqual(destino("¿Referencia de clip válida?", 1), [
    "Clip · fallo durable",
  ]);
});
