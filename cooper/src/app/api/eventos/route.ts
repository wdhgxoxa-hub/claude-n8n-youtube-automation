import { db } from "@/db";
import { and, eq, gt, asc } from "drizzle-orm";
import { users, events } from "@/db/schema";
import { ErrorHttp } from "@/lib/permisos";
import { currentUser } from "@/lib/sesion";
import { failure, reserveStream } from "@/lib/http";
import { estado } from "@/servicios/datos";
import { fabrica } from "@/servicios/fabrica";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LATIDO_MS = 15000;
const CONCILIACION_MS = 60000;
const CACHE_PRIVADA = "private, no-cache, no-store, no-transform";
const UUID_EVENTO =
  /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

// EventSource no expone el estado HTTP del error. Esta sonda comprueba también
// suspensión/lista permitida sin consultar la fábrica ni ocupar un cupo SSE.
export async function HEAD() {
  try {
    await currentUser();
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": CACHE_PRIVADA },
    });
  } catch (error) {
    const response = failure(error);
    return new Response(null, {
      status: response.status,
      headers: response.headers,
    });
  }
}

export async function GET(request: Request) {
  let release: (() => void) | undefined;
  try {
    const user = await currentUser();
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
    let syncTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let stop = () => {};
    const interval = Math.max(
      250,
      Math.min(Number(process.env.COOPER_SIMULACION_MS) || 2000, 2000),
    );
    const remote =
      process.env.COOPER_DEMO !== "1" && process.env.COOPER_FABRICA === "n8n";
    let cursorTime = 0;
    let cursorId = "";
    // Un EventSource nuevo no conserva Last-Event-ID. El cliente puede retomar
    // por URL; la cabecera nativa tiene precedencia si el navegador la aporta.
    const lastEvent =
      request.headers.get("last-event-id") ??
      new URL(request.url).searchParams.get("ultimoEvento");
    if (lastEvent && lastEvent.length <= 128 && UUID_EVENTO.test(lastEvent)) {
      const receipt = db()
        .select()
        .from(events)
        .where(
          and(
            eq(events.id, lastEvent),
            user.role === "admin" ? undefined : eq(events.ownerId, user.id),
          ),
        )
        .get();
      if (receipt) {
        cursorTime = receipt.createdAt;
        cursorId = receipt.id;
      }
    }
    release = reserveStream(user.id);
    const stream = new ReadableStream({
      start(controller) {
        stop = () => {
          if (stopped) return;
          stopped = true;
          release?.();
          request.signal.removeEventListener("abort", stop);
          if (timer) clearTimeout(timer);
          if (heartbeatTimer) clearTimeout(heartbeatTimer);
          if (syncTimer) clearTimeout(syncTimer);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };
        request.signal.addEventListener("abort", stop, { once: true });
        if (request.signal.aborted) {
          stop();
          return;
        }

        const send = (frame: string) => {
          if (stopped || (controller.desiredSize ?? 0) <= 0) return false;
          controller.enqueue(encoder.encode(frame));
          return true;
        };
        const sessionEnded = () => {
          send("event: sesion-finalizada\ndata: {}\n\n");
          stop();
        };
        const authorize = async () => {
          if (stopped) return;
          try {
            const fresh = await currentUser();
            if (stopped) return;
            if (fresh.id === user.id) return fresh;
            sessionEnded();
          } catch (error) {
            if (error instanceof ErrorHttp && [401, 403].includes(error.status))
              sessionEnded();
            else
              send(
                'event: fallo\ndata: {"error":"No se pudo actualizar el estudio. Volveremos a intentarlo."}\n\n',
              );
          }
        };

        // El primer byte libera las cabeceras de Next/proxy. Una conciliación
        // lenta o fallida no representa un corte del transporte del navegador.
        send("event: latido\ndata: {}\n\n");
        const heartbeat = async () => {
          if (await authorize()) send("event: latido\ndata: {}\n\n");
          if (!stopped) heartbeatTimer = setTimeout(heartbeat, LATIDO_MS);
        };
        heartbeatTimer = setTimeout(heartbeat, LATIDO_MS);

        // La fábrica tiene sus propios timeout/reintentos y serialización.
        // Mantenerla fuera del sondeo permite recibir webhooks y revocar acceso
        // mientras una lectura remota sigue pendiente, sin solapar conciliaciones.
        const synchronize = async () => {
          const started = Date.now();
          const fresh = await authorize();
          if (fresh) {
            try {
              const owners =
                fresh.role === "admin"
                  ? db().select().from(users).all()
                  : [fresh];
              const results = await Promise.allSettled(
                owners.map((owner) => fabrica().sincronizar(owner)),
              );
              if (
                (await authorize()) &&
                results.some((result) => result.status === "rejected")
              )
                send(
                  'event: fallo\ndata: {"error":"La actualización está pendiente. Seguimos recibiendo el progreso."}\n\n',
                );
            } catch {
              // Un 401 del puente no es un 401 de la sesión del navegador.
              if (await authorize())
                send(
                  'event: fallo\ndata: {"error":"La actualización está pendiente. Seguimos recibiendo el progreso."}\n\n',
                );
            }
          }
          if (!stopped)
            syncTimer = setTimeout(
              synchronize,
              remote
                ? Math.max(interval, CONCILIACION_MS - (Date.now() - started))
                : interval,
            );
        };

        const tick = async () => {
          if (stopped) return;
          try {
            const authorized = await authorize();
            if (!authorized) return;
            const progress = db()
              .select()
              .from(events)
              .where(
                and(
                  eq(events.type, "progreso"),
                  authorized.role === "admin"
                    ? undefined
                    : eq(events.ownerId, authorized.id),
                  gt(events.createdAt, cursorTime - 1),
                ),
              )
              .orderBy(asc(events.createdAt), asc(events.id))
              .limit(100)
              .all();
            for (const event of progress) {
              if (
                event.createdAt < cursorTime ||
                (event.createdAt === cursorTime && event.id <= cursorId)
              )
                continue;
              if (
                !send(
                  `id: ${event.id}\nevent: progreso\ndata: ${event.payload}\n\n`,
                )
              )
                break;
              cursorTime = event.createdAt;
              cursorId = event.id;
            }
            if (!stopped && (controller.desiredSize ?? 0) > 0)
              send(
                `event: estado\ndata: ${JSON.stringify(estado(authorized))}\n\n`,
              );
          } catch {
            send(
              'event: fallo\ndata: {"error":"No se pudo actualizar el estudio. Volveremos a intentarlo."}\n\n',
            );
          } finally {
            if (!stopped) timer = setTimeout(tick, interval);
          }
        };
        void synchronize();
        timer = setTimeout(tick, 0);
      },
      cancel() {
        stop();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": CACHE_PRIVADA,
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    release?.();
    return failure(error);
  }
}
