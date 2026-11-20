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
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    const release = reserveStream(user.id);
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let stop = () => {};
    let lastSync = 0;
    let cursorTime = 0;
    const lastEvent = request.headers.get("last-event-id");
    if (lastEvent) {
      const receipt = db()
        .select()
        .from(events)
        .where(and(eq(events.id, lastEvent), eq(events.ownerId, user.id)))
        .get();
      if (receipt) cursorTime = receipt.createdAt;
    }
    let cursorId = lastEvent ?? "";
    const stream = new ReadableStream({
      start(controller) {
        stop = () => {
          if (stopped) return;
          release();
          request.signal.removeEventListener("abort", stop);
          stopped = true;
          if (timer) clearTimeout(timer);
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
        const tick = async () => {
          if (stopped) return;
          try {
            const fresh = await currentUser();
            if (fresh.id !== user.id) {
              stop();
              return;
            }
            const owners =
              fresh.role === "admin"
                ? db().select().from(users).all()
                : [fresh];
            if (
              process.env.COOPER_FABRICA !== "n8n" ||
              Date.now() - lastSync >= 60000
            ) {
              lastSync = Date.now();
              try {
                await Promise.all(
                  owners.map((owner) => fabrica().sincronizar(owner)),
                );
              } catch (error) {
                if (process.env.COOPER_FABRICA !== "n8n") throw error;
                if (!stopped && (controller.desiredSize ?? 0) > 0)
                  controller.enqueue(
                    encoder.encode(
                      'event: fallo\ndata: {"error":"La conciliación está pendiente. Seguimos recibiendo el progreso."}\n\n',
                    ),
                  );
              }
            }
            const authorized = await currentUser();
            if (authorized.id !== user.id) {
              stop();
              return;
            }
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
              if (stopped || (controller.desiredSize ?? 0) <= 0) break;
              controller.enqueue(
                encoder.encode(
                  `id: ${event.id}\nevent: progreso\ndata: ${event.payload}\n\n`,
                ),
              );
              cursorTime = event.createdAt;
              cursorId = event.id;
            }
            if (!stopped && (controller.desiredSize ?? 0) > 0)
              controller.enqueue(
                encoder.encode(
                  `event: estado\ndata: ${JSON.stringify(estado(authorized))}\n\n`,
                ),
              );
          } catch (error) {
            if (
              error instanceof ErrorHttp &&
              [401, 403].includes(error.status)
            ) {
              stop();
              return;
            }
            if (!stopped && (controller.desiredSize ?? 0) > 0)
              controller.enqueue(
                encoder.encode(
                  'event: fallo\ndata: {"error":"No se pudo actualizar la fábrica. Vuelve a entrar si tu sesión cambió."}\n\n',
                ),
              );
          }
          if (!stopped)
            timer = setTimeout(
              tick,
              Math.max(
                250,
                Math.min(
                  Number(process.env.COOPER_SIMULACION_MS) || 2000,
                  2000,
                ),
              ),
            );
        };
        void tick();
      },
      cancel() {
        stop();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
