import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { channels, videos, events, type User } from "@/db/schema";

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
    tx.insert(channels)
      .values([
        {
          id: ciencia,
          ownerId: user.id,
          learning: JSON.stringify([
            {
              id: "demo-leccion",
              fecha: new Date(now - 86400000).toISOString(),
              resumen:
                "Abrir con una pregunta concreta ayudó a sostener la atención en tres historias de ejemplo.",
              ganchos: ["Una pregunta cotidiana antes de la explicación."],
              temas: ["Fenómenos que podemos observar en casa."],
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
                ? ["youtube", "tiktok", "instagram"].map((red, k) => ({
                    id: `demo-${red}`,
                    red,
                    url: "",
                    fecha: new Date(now - 7 * 86400000).toISOString(),
                    miniatura: "",
                    historial: [7, 5, 2, 0].map((dias, j) => ({
                      fecha: new Date(now - dias * 86400000).toISOString(),
                      vistas: (j + 1) * 1230 + k * 200,
                      meGusta: (j + 1) * 45,
                      comentarios: (j + 1) * 8,
                      retencion: k === 2 ? null : 0.55 + j * 0.03,
                    })),
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
