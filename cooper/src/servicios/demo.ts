import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { channels, videos, events, type User } from "@/db/schema";

// Piezas de un mismo video en distintas redes: cada una con su título, formato
// y cifras, para que la pared de ejemplo no repita una imagen ni una medida.
const piezasDemo = [
  {
    red: "youtube",
    titulo: "Por qué el cielo cambia de color",
    retencion: [0.41, 0.46, 0.5, 0.54],
    ancho: 1920,
    alto: 1080,
    dias: 7,
    vistas: 6200,
  },
  {
    red: "tiktok",
    titulo: "El cielo no cambia de pintura",
    retencion: [0.52, 0.5, 0.48, 0.51],
    ancho: 1080,
    alto: 1920,
    dias: 6,
    vistas: 4400,
  },
  {
    red: "instagram",
    titulo: "Cambia el camino de la luz",
    retencion: [0.55, 0.58, 0.6, 0.62],
    ancho: 1080,
    alto: 1920,
    dias: 6,
    vistas: 1900,
  },
  {
    red: "youtube",
    titulo: "¿Por qué el atardecer es rojo?",
    retencion: [0.55, 0.58, 0.6, 0.62],
    ancho: 1080,
    alto: 1920,
    dias: 5,
    vistas: 2700,
  },
  {
    red: "tiktok",
    titulo: "La luz azul se dispersa primero",
    retencion: [0.55, 0.58, 0.6, 0.62],
    ancho: 1080,
    alto: 1920,
    dias: 4,
    vistas: 3300,
  },
  {
    red: "instagram",
    titulo: "Un cielo, tres colores",
    retencion: [0.55, 0.58, 0.6, 0.62],
    ancho: 1080,
    alto: 1080,
    dias: 3,
    vistas: 1100,
  },
];

// La marca persiste aunque el usuario borre los ejemplos: no se recrean al entrar.
export function prepararDemo(user: User) {
  if (process.env.COOPER_DEMO !== "1") return;
  db().transaction((tx) => {
    if (
      tx
        .select()
        .from(events)
        .where(
          and(
            eq(events.ownerId, user.id),
            eq(events.type, "demo_inicializada"),
          ),
        )
        .get()
    )
      return;
    const now = Date.now();
    const ciencia = `demo-${user.id}-ciencia`;
    const ciudad = `demo-${user.id}-ciudad`;
    const lluvia = `demo-${user.id}-1`;
    const cielo = `demo-${user.id}-3`;
    tx.insert(channels)
      .values([
        {
          id: ciencia,
          ownerId: user.id,
          learning: JSON.stringify([
            {
              id: "demo-leccion-respuesta",
              fecha: new Date(now - 86400000).toISOString(),
              resumen: "La respuesta tiene que llegar antes que la explicación",
              causa:
                "La explicación tardaba ocho segundos en llegar y mucha gente se fue antes.",
              correccion: "Abrir con la respuesta y contar el porqué después.",
              nivel: "hipotesis",
              ganchos: ["Una pregunta cotidiana antes de la explicación."],
              temas: ["Fenómenos que podemos observar en casa."],
              origenes: [
                {
                  videoId: cielo,
                  red: "youtube",
                  ventana: "24h",
                  fecha: new Date(now - 6 * 86400000).toISOString(),
                  metrica: "retencion",
                  valor: 0.41,
                  demoraHoras: 0,
                },
              ],
              aplicaciones: [
                {
                  videoId: lluvia,
                  cambio:
                    "La respuesta abre el video y la explicación llega después.",
                },
              ],
            },
            {
              id: "demo-leccion-primer-plano",
              fecha: new Date(now - 2 * 86400000).toISOString(),
              resumen: "El primer plano decide si siguen mirando",
              causa:
                "La primera imagen no mostraba qué estaba en juego hasta el tercer segundo.",
              correccion:
                "Mostrar la escena principal desde el primer segundo.",
              nivel: "hipotesis",
              ganchos: [],
              temas: [],
              origenes: [
                {
                  videoId: cielo,
                  red: "tiktok",
                  ventana: "72h",
                  fecha: new Date(now - 3 * 86400000).toISOString(),
                  metrica: "retencion",
                  valor: 0.48,
                  demoraHoras: 0,
                },
              ],
              aplicaciones: [],
            },
          ]),
          name: "Ciencia cotidiana",
          niche:
            "Las preguntas pequeñas esconden grandes historias. Ciencia visual para mentes curiosas.",
          bible:
            "Una pregunta, un experimento y una explicación clara. Voz cálida, rigor y asombro.",
          networks: "YouTube Shorts · Instagram Reels",
          goals: "Dos historias por semana",
          createdAt: now,
        },
        {
          id: ciudad,
          ownerId: user.id,
          name: "La ciudad a pie",
          niche:
            "Arquitectura, memoria y vida entre calles. Otra forma de mirar los lugares que habitamos.",
          bible:
            "Documental cercano. Sonido ambiente, planos pausados y detalles que suelen pasar inadvertidos.",
          networks: "YouTube · Instagram",
          goals: "Una crónica cada viernes",
          createdAt: now - 86400000,
        },
      ])
      .run();
    const ejemplos = [
      {
        title: "El mar también respira",
        channelId: ciencia,
        stage: 7,
        topic:
          "Las mareas transforman la costa dos veces al día. La atracción de la Luna y el Sol explica ese movimiento; el litoral le da a cada lugar su propio ritmo.",
        hook: "El agua se retira. Seis horas después, esta misma roca estará bajo el mar.",
      },
      {
        title: "¿A qué huele la lluvia?",
        channelId: ciencia,
        stage: 3,
        topic:
          "Cuando una gota golpea el suelo seco, libera diminutas partículas al aire. Entre ellas viaja la geosmina, producida por microorganismos del suelo.",
        hook: "Antes de ver la primera gota, a veces ya sabes que va a llover.",
      },
      {
        title: "La ciudad antes del ruido",
        channelId: ciudad,
        stage: 9,
        topic:
          "Acompañamos la apertura del mercado: las persianas, el primer café y los pasos de quienes despiertan el barrio. Una historia contada con sonido ambiente.",
        hook: "Son las cinco de la mañana. La ciudad todavía habla en voz baja.",
      },
      {
        title: "Por qué el cielo cambia de color",
        channelId: ciencia,
        stage: 11,
        topic:
          "Al atardecer, la luz recorre más atmósfera. La luz azul se dispersa en otras direcciones y predominan los tonos cálidos que llegan hasta nuestros ojos.",
        hook: "El cielo no cambia de pintura. Cambia el camino de la luz.",
      },
    ];
    tx.insert(videos)
      .values(
        ejemplos.map((v, i) => ({
          id: `demo-${user.id}-${i}`,
          ownerId: user.id,
          channelId: v.channelId,
          title: v.title,
          stage: v.stage,
          observability: JSON.stringify({
            montaje: "",
            miniatura: "",
            escenas: [],
            publicaciones:
              i === 3
                ? piezasDemo.map((pieza, k) => ({
                    id: `demo-${k + 1}-${pieza.red}`,
                    red: pieza.red,
                    titulo: pieza.titulo,
                    url: "",
                    fecha: new Date(now - pieza.dias * 86400000).toISOString(),
                    miniatura: "",
                    ancho: pieza.ancho,
                    alto: pieza.alto,
                    historial: [...new Set([1, 2, 3, pieza.dias])].map(
                      (dias, j, todas) => ({
                        fecha: new Date(
                          now - (pieza.dias - dias) * 86400000,
                        ).toISOString(),
                        vistas: Math.round(
                          (pieza.vistas * (j + 1)) / todas.length,
                        ),
                        meGusta: Math.round(
                          (pieza.vistas * 0.037 * (j + 1)) / todas.length,
                        ),
                        comentarios: (j + 1) * 8,
                        retencion:
                          pieza.red === "instagram" ? null : pieza.retencion[j],
                        ventana:
                          dias === 1 ? "24h" : dias === 3 ? "72h" : undefined,
                      }),
                    ),
                  }))
                : [],
            incidencias:
              i === 1
                ? [
                    {
                      id: "demo-fallo",
                      tipo: "verificador",
                      resumen:
                        "Una cifra del guion necesitaba una fuente más reciente.",
                      fecha: new Date(now - 2 * 86400000).toISOString(),
                      estado: "corregido",
                      corregidoEn: new Date(now - 86400000).toISOString(),
                      cambio:
                        "Se sustituyó la cifra y se comprobó su fuente antes de repetir la revisión.",
                    },
                  ]
                : i === 2
                  ? [
                      {
                        id: "demo-cambio",
                        tipo: "correccion",
                        resumen: "Dar más espacio al sonido de la calle.",
                        fecha: new Date(now - 86400000).toISOString(),
                        estado: "pendiente",
                        corregidoEn: null,
                        cambio: "",
                      },
                    ]
                  : [],
          }),
          avatarId: i === 2 ? "" : "cooper",
          voiceId: "clara",
          script: `# ${v.title}\n\nApertura · 0:00–0:08\n${v.hook}\n\nDesarrollo · 0:08–0:48\n${v.topic}\n\nCierre · 0:48–1:00\nLa próxima vez que lo veas, detente un momento. Hay una historia ahí.\n\nDirección visual\nPlanos de detalle, luz natural y subtítulos breves. Contrastar el guion antes de producir.`,
          createdAt: now - i * 86400000,
          updatedAt: now,
        })),
      )
      .run();
    tx.insert(events)
      .values({
        id: `demo-${user.id}`,
        ownerId: user.id,
        type: "demo_inicializada",
        payload: "{}",
        createdAt: now,
      })
      .run();
  });
}
