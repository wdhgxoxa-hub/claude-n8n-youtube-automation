// Fixture determinista y privado para H19. No se importa desde la aplicación.
import { db } from "../src/db";
import {
  users,
  allowedEmails,
  channels,
  videos,
  messages,
  whatsappContacts,
  whatsappOutbox,
} from "../src/db/schema";
import { sinObservabilidad } from "../src/contratos/observabilidad";

export const AHORA_VOLUMEN = Date.parse("2026-11-21T12:00:00Z");
export const TOTAL_VOLUMEN = 10_000;
export function fixtureVolumen() {
  if (db().select().from(users).get())
    throw new Error("El fixture exige una base vacía");
  db().transaction((tx) => {
    for (let i = 0; i < 10; i++) {
      const id = `dueno-${i}`,
        phone = `+5190000000${i}`;
      tx.insert(users)
        .values({
          id,
          email: `${id}@example.test`,
          name: id,
          role: i === 0 ? "admin" : "usuario",
          whatsapp: phone,
        })
        .run();
      tx.insert(allowedEmails)
        .values({ email: `${id}@example.test`, createdAt: AHORA_VOLUMEN })
        .run();
      tx.insert(whatsappContacts)
        .values({
          ownerId: id,
          phone,
          verifiedAt: i < 8 ? AHORA_VOLUMEN - 1000 : 0,
          consentAt: AHORA_VOLUMEN - 1000,
          preferences: JSON.stringify({
            guion: true,
            final: true,
            publicado: true,
            gasto: false,
          }),
        })
        .run();
    }
    for (let i = 0; i < 100; i++)
      tx.insert(channels)
        .values({
          id: `canal-${i}`,
          ownerId: `dueno-${i % 10}`,
          name: `Canal ${i}`,
          niche: "Ensayo H19",
          createdAt: AHORA_VOLUMEN - i,
        })
        .run();
    for (let i = 0; i < TOTAL_VOLUMEN; i++) {
      const id = `video-${i}`,
        ownerId = `dueno-${i % 10}`;
      const stage = i < 9000 ? 11 : [3, 9, 1][i % 3];
      const updatedAt = AHORA_VOLUMEN - TOTAL_VOLUMEN + i;
      const remoteUpdatedAt = i % 2 ? updatedAt - 1 : 0;
      const productionState = i % 37 === 0 ? "pausada" : "activa";
      tx.insert(videos)
        .values({
          id,
          ownerId,
          channelId: `canal-${i % 100}`,
          title: `Video ${i}`,
          stage,
          productionState,
          updatedAt,
          remoteUpdatedAt,
          createdAt: updatedAt,
          script: "Guion ficticio. ".repeat(256),
          observability: JSON.stringify({
            ...sinObservabilidad,
            publicaciones: [
              {
                id,
                red: i % 2 ? "youtube" : "tiktok",
                url: "",
                miniatura: "",
                fecha: new Date(updatedAt).toISOString(),
                historial: [2, 1].map((dia) => ({
                  fecha: new Date(updatedAt + dia * 86400000).toISOString(),
                  vistas: i + dia,
                  meGusta: dia,
                  comentarios: 0,
                  retencion: null,
                })),
              },
            ],
          }),
        })
        .run();
      tx.insert(messages)
        .values({
          id: `mensaje-${i}`,
          ownerId,
          channelId: `canal-${i % 100}`,
          role: "user",
          content: `Mensaje ${i}`,
          createdAt: updatedAt,
        })
        .run();
      // Historial durable: también hay fallidos, inciertos y cancelados. Nunca reenviarlos.
      if (i % 10 < 8 && stage !== 1 && productionState === "activa") {
        const revision = `${stage}:${remoteUpdatedAt || updatedAt}`;
        tx.insert(whatsappOutbox)
          .values({
            id: `aviso-${i}`,
            ownerId,
            phone: `+5190000000${i % 10}`,
            kind: stage === 3 ? "guion" : stage === 9 ? "final" : "publicado",
            resourceId: id,
            revision,
            contactVerifiedAt: AHORA_VOLUMEN - 1000,
            dedupeKey: `aviso:${ownerId}:${id}:${revision}:${AHORA_VOLUMEN - 1000}`,
            state: (["aceptado", "fallido", "incierto", "cancelado"] as const)[
              i % 4
            ],
            createdAt: updatedAt,
            nextAt: AHORA_VOLUMEN,
            expiresAt: AHORA_VOLUMEN + 86400000,
          })
          .run();
      }
    }
  });
  return db().select().from(users).all();
}
