// Solo se ejecuta en procesos de ensayo con base nueva y transporte ficticio.
import { appendFileSync, existsSync } from "node:fs";
import { randomBytes, createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import {
  allowedEmails,
  users,
  chatActions,
  chatSessions,
  bridgeCommands,
  whatsappOutbox,
  piezasMarca,
  marcaIngestas,
  attachments,
  whatsappContacts,
  type User,
} from "../../src/db/schema";
import {
  confirmarChat,
  responderChat,
  estadoChat,
} from "../../src/servicios/chat";
import { recibirWebhook } from "../../src/servicios/puente";
import { solicitarCodigo } from "../../src/servicios/mensajeria/cuentas";
import { procesarCola } from "../../src/servicios/mensajeria/cola";
import { recibirWhatsApp } from "../../src/servicios/mensajeria/webhook";
import {
  guardarMarca,
  agregarCuenta,
  conectarCuenta,
  guardarPieza,
  enviarRevision,
  decidirPieza,
  procesarMarcas,
} from "../../src/servicios/marcas/servicio";
import { RedSimulada } from "../../src/servicios/marcas/redes";
import { importarMediosWhatsApp } from "../../src/servicios/marcas/adjuntos-whatsapp";
import {
  conciliarOperacion,
  consultarCaso,
} from "../../src/servicios/conciliacion";
const [modo, tipo, fase] = process.argv.slice(2);
const database = process.env.COOPER_DATABASE_PATH!;
if (!database.includes("/conciliacion-caida-"))
  throw new Error("Se exige base aislada de ensayo.");
const accepted = `${database}.aceptada`,
  intentos = `${database}.intentos`;
process.env.AUTH_SECRET = randomBytes(32).toString("hex");
process.env.AUTH_URL = "http://localhost:3000";
process.env.COOPER_CHAT = "simulada";
process.env.COOPER_FABRICA = "simulada";
process.env.COOPER_MENSAJERIA = "simulada";
process.env.COOPER_MARCAS = "simulada";
globalThis.fetch = async () => {
  throw new Error("Red prohibida en este ensayo");
};
function persona(id: string, role: User["role"]) {
  db()
    .insert(allowedEmails)
    .values({ email: `${id}@example.test`, createdAt: Date.now() })
    .onConflictDoNothing()
    .run();
  db()
    .insert(users)
    .values({
      id,
      email: `${id}@example.test`,
      name: id,
      role,
      whatsapp: "+51911111111",
    })
    .onConflictDoNothing()
    .run();
  return db().select().from(users).where(eq(users.id, id)).get()!;
}
const admin = persona("admin", "admin"),
  ana = persona("ana", "usuario");
async function detener(id: string): Promise<never> {
  process.send!({ punto: true, id });
  return new Promise(() => {
    setInterval(() => {}, 1000);
  });
}
async function transporte(id: string): Promise<never> {
  appendFileSync(intentos, "intento\n");
  if (modo === "recuperar")
    throw new Error("Duplicado: se intentó enviar después de reiniciar");
  if (fase === "despues") appendFileSync(accepted, "aceptada\n");
  return detener(id);
}
async function cerrar(
  kind: Parameters<typeof consultarCaso>[1],
  id: string,
  confirm = false,
  remoto = "",
) {
  const c = consultarCaso(admin, kind, id);
  if (!c.pendiente) return c;
  return conciliarOperacion(admin, {
    tipo: kind,
    id,
    huella: c.huella,
    accion: confirm ? "confirmar" : "archivar",
    remoto,
    referencia: "recibo-ficticio-del-transporte",
    comprobado: true,
  });
}
async function main() {
  if (tipo === "chat") {
    if (modo === "iniciar") {
      await responderChat(ana, {
        texto: "Crea un canal: Ciencia",
        adjuntos: [],
      });
      const card = estadoChat(ana).tarjetas.at(-1)!;
      process.env.COOPER_FABRICA = "n8n";
      process.env.COOPER_N8N_URL = "http://127.0.0.1/ficticio";
      process.env.COOPER_N8N_TOKEN = "valor-ficticio";
      globalThis.fetch = async (_u, init) => {
        const request = JSON.parse(String(init?.body));
        recibirWebhook(
          {
            version: "cooper-v1",
            tipo: "orden",
            fase: "reservar",
            ejecucion: "n8n-ficticia",
            id_evento: request.id_evento,
            solicitud: request,
          },
          "",
        );
        return transporte(card.id);
      };
      await confirmarChat(ana, { id: card.id, aceptar: true });
    } else {
      const card = db().select().from(chatActions).get()!;
      const o = db().select().from(bridgeCommands).get()!;
      db().update(chatSessions).set({ busyUntil: 0 }).run();
      db()
        .update(bridgeCommands)
        .set({ createdAt: Date.now() - 600000 })
        .run();
      let replayBloqueado = false;
      try {
        await confirmarChat(ana, { id: card.id, aceptar: true });
      } catch {
        replayBloqueado = true;
      }
      if (!replayBloqueado) throw new Error("La tarjeta se repitió");
      if (existsSync(accepted)) {
        recibirWebhook(
          {
            version: "cooper-v1",
            tipo: "orden",
            fase: "confirmar",
            ejecucion: o.execution,
            id_evento: o.id,
            solicitud: JSON.parse(o.request),
          },
          "",
        );
        const c = consultarCaso(admin, "chat", card.id);
        if (c.pendiente)
          await conciliarOperacion(admin, {
            tipo: "chat",
            id: card.id,
            huella: c.huella,
            accion: "consultar",
          });
      } else {
        await cerrar("fabrica", o.id);
        await cerrar("chat", card.id);
      }
      return {
        estado: consultarCaso(admin, "chat", card.id).estado,
        reserva: db().select().from(bridgeCommands).get()!.execution,
        replayBloqueado,
      };
    }
  }
  if (tipo === "whatsapp") {
    if (modo === "iniciar") solicitarCodigo(ana, { consentimiento: true });
    if (modo === "recuperar")
      db()
        .update(whatsappOutbox)
        .set({ leaseAt: Date.now() - 600000 })
        .run();
    await procesarCola({
      simulada: true,
      enviar: async (_m, id) => transporte(id),
    });
    const job = db().select().from(whatsappOutbox).get()!;
    if (existsSync(accepted)) {
      const secret = randomBytes(32).toString("hex");
      process.env.WHATSAPP_APP_SECRET = secret;
      process.env.WHATSAPP_PHONE_NUMBER_ID = "12345";
      const body = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: "12345" },
                  statuses: [
                    {
                      id: "wamid.ficticio",
                      status: "delivered",
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      recipient_id: "51911111111",
                    },
                  ],
                },
              },
            ],
          },
        ],
      });
      await recibirWhatsApp(
        new Request("http://localhost/api/whatsapp/webhook", {
          method: "POST",
          headers: {
            "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
          },
          body,
        }),
      );
    }
    const r = await cerrar(
      "whatsapp",
      job.id,
      existsSync(accepted),
      "wamid.ficticio",
    );
    await procesarCola({
      simulada: true,
      enviar: async (_m, id) => transporte(id),
    });
    return { estado: r.estado };
  }
  if (tipo === "marca") {
    const red = Object.assign(new RedSimulada(), {
      publicar: async (
        _c: unknown,
        p: { id: string },
        _m: string[],
        guardar: (c: { envio: string }) => void,
      ) => {
        guardar({ envio: `marca-${p.id}-1` });
        return transporte(p.id);
      },
      consultarPublicacion: async () => ({
        publicada: existsSync(accepted),
        remoto: "post-ficticio",
      }),
    });
    if (modo === "iniciar") {
      const m = guardarMarca(ana, { nombre: "Ensayo", rubro: "general" });
      const c = agregarCuenta(ana, m.id, {
        red: "instagram",
        alias: "Ensayo",
        remoto: "12345",
        pagina: "12345",
      });
      await conectarCuenta(admin, c.id);
      const p = guardarPieza(ana, m.id, {
        cuentaId: c.id,
        formato: "imagen",
        plantilla: "libre",
        titulo: "Ensayo",
        texto: "Texto ficticio",
        programada: new Date(Date.now() + 600000).toISOString(),
      });
      await enviarRevision(ana, p.id, 1);
      decidirPieza(admin, p.id, 1, true);
      await procesarMarcas(red, p.programada + 1);
    } else {
      db()
        .update(piezasMarca)
        .set({ leaseAt: Date.now() - 600000 })
        .run();
      await procesarMarcas(red);
      const p = db().select().from(piezasMarca).get()!;
      const c = consultarCaso(admin, "marca", p.id);
      if (existsSync(accepted) && c.pendiente)
        await conciliarOperacion(
          admin,
          { tipo: "marca", id: p.id, huella: c.huella, accion: "consultar" },
          red,
        );
      else await cerrar("marca", p.id);
      await procesarMarcas(red);
      return { estado: consultarCaso(admin, "marca", p.id).estado };
    }
  }
  if (tipo === "ingesta") {
    const jpeg = Buffer.from("ffd8ffffd9", "hex");
    process.env.WHATSAPP_TOKEN = "ficticio";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "12345";
    if (modo === "iniciar") {
      db()
        .insert(whatsappContacts)
        .values({
          ownerId: ana.id,
          phone: ana.whatsapp,
          consentAt: Date.now(),
          verifiedAt: Date.now(),
        })
        .run();
      db()
        .insert(marcaIngestas)
        .values({
          id: "ingesta-ficticia",
          ownerId: ana.id,
          mediaId: "12345",
          caption: "Ensayo",
          createdAt: Date.now(),
        })
        .run();
    }
    await importarMediosWhatsApp(async (url) => {
      if (String(url).includes("graph.facebook.com")) {
        if (fase === "antes" || modo === "recuperar")
          return transporte("ingesta-ficticia");
        appendFileSync(intentos, "intento\n");
        return Response.json({
          url: "https://lookaside.fbsbx.com/ensayo",
          mime_type: "image/jpeg",
          file_size: jpeg.length,
        });
      }
      return new Response(jpeg);
    });
    if (modo === "iniciar") {
      appendFileSync(accepted, "aceptada\n");
      await detener("ingesta-ficticia");
    }
    await cerrar("ingesta", "ingesta-ficticia");
    return {
      estado: consultarCaso(admin, "ingesta", "ingesta-ficticia").estado,
      adjuntos: db().select().from(attachments).all().length,
    };
  }
  throw new Error("Escenario desconocido");
}
main()
  .then((result) => {
    process.send!({ resultado: result });
    process.disconnect!();
  })
  .catch(() => {
    process.send!({ fallo: true });
    process.exitCode = 1;
    process.disconnect!();
  });
