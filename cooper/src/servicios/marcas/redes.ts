import { z } from "zod";
import type { CuentaMarca, PiezaMarca } from "@/db/schema";
import { ErrorHttp } from "@/lib/permisos";
import type { Checkpoint, Historica, Metricas, ResultadoRed } from "./tipos";
export interface RedSocial {
  readonly simulada: boolean;
  comprobar(cuenta: CuentaMarca): Promise<{ tipo: string }>;
  historial(cuenta: CuentaMarca): Promise<Historica[]>;
  publicar(
    cuenta: CuentaMarca,
    pieza: PiezaMarca,
    medios: string[],
    guardar: (c: Checkpoint) => void,
  ): Promise<ResultadoRed>;
  metricas(cuenta: CuentaMarca, remoto: string): Promise<Metricas>;
}
const objeto = (v: unknown): Record<string, unknown> =>
  z.record(z.string(), z.unknown()).parse(v);
const lista = (v: unknown): Record<string, unknown>[] =>
  z.array(z.record(z.string(), z.unknown())).parse(v ?? []);
const texto = (v: unknown) => (typeof v === "string" ? v : "");
const numero = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
const id = (v: unknown) =>
  z
    .string()
    .regex(/^[\w-]{1,150}$/)
    .parse(typeof v === "number" ? String(v) : v);
const progreso = (c: Checkpoint): ResultadoRed => ({
  estado: "procesando",
  remoto: "",
  checkpoint: c,
});
const publicada = (remoto: string, c: Checkpoint): ResultadoRed => ({
  estado: "publicada",
  remoto,
  checkpoint: c,
});
export class RedSimulada implements RedSocial {
  readonly simulada = true;
  async comprobar() {
    return { tipo: "BUSINESS" };
  }
  async historial(): Promise<Historica[]> {
    return [0, 1, 2, 3, 4, 5].map((i) => ({
      id: `ejemplo-${i}`,
      texto:
        i % 2
          ? "Compartimos una historia de nuestra comunidad."
          : "Nos encontramos este domingo. Te esperamos.",
      fecha: new Date(Date.UTC(2026, 10, 1 + i * 2, 23)).toISOString(),
      tipo: i % 2 ? "REELS" : "IMAGE",
      imagen: "",
      metricas: {
        vistas: 100 + i * 40,
        alcance: 90 + i * 30,
        interacciones: 10 + i * 3,
        capturadas: Date.now(),
      },
    }));
  }
  async publicar(c: CuentaMarca, p: PiezaMarca): Promise<ResultadoRed> {
    return publicada(`simulada-${c.red}-${p.id}`, {});
  }
  async metricas(): Promise<Metricas> {
    return {
      vistas: 240,
      alcance: 180,
      interacciones: 24,
      capturadas: Date.now(),
    };
  }
}
export class RedOficial implements RedSocial {
  readonly simulada = false;
  constructor(
    private transporte: typeof fetch = fetch,
    private config = {
      meta: process.env.COOPER_META_SYSTEM_TOKEN ?? "",
      upload: process.env.UPLOAD_POST_API_KEY ?? "",
      version: process.env.COOPER_META_GRAPH_VERSION ?? "v27.0",
    },
  ) {}
  private async solicitar(
    url: URL,
    token: string,
    method = "GET",
    body?: BodyInit,
    headers: Record<string, string> = {},
  ) {
    if (!token)
      throw new ErrorHttp(503, "La conexión necesita configuración de Walter.");
    const r = await this.transporte(url, {
      method,
      body,
      headers: { Authorization: token, ...headers },
      redirect: "error",
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
    if (!r.ok) {
      await r.body?.cancel();
      throw new ErrorHttp(
        r.status === 429 ? 429 : 502,
        r.status === 429
          ? "La red pide esperar antes de continuar."
          : "La red no confirmó la operación. Revisa la conexión.",
      );
    }
    const result = objeto(await r.json());
    if (result.error || result.success === false)
      throw new ErrorHttp(502, "La red no confirmó la operación.");
    return result;
  }
  private graph(
    path: string,
    token: string,
    data?: Record<string, unknown>,
    query: Record<string, string> = {},
  ) {
    if (!/^v\d+\.0$/.test(this.config.version) || !/^[\w/-]+$/.test(path))
      throw new ErrorHttp(503, "Versión o recurso no válido.");
    const url = new URL(
      `https://graph.facebook.com/${this.config.version}/${path}`,
    );
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    return this.solicitar(
      url,
      `Bearer ${token}`,
      data ? "POST" : "GET",
      data ? JSON.stringify(data) : undefined,
      data ? { "Content-Type": "application/json" } : {},
    );
  }
  private upload(
    path: string,
    query: Record<string, string> = {},
    form?: FormData,
    key?: string,
  ) {
    const url = new URL(`https://api.upload-post.com/api/${path}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    return this.solicitar(
      url,
      `Apikey ${this.config.upload}`,
      form ? "POST" : "GET",
      form,
      key ? { "Idempotency-Key": key } : {},
    );
  }
  private async pagina(c: CuentaMarca) {
    // El token de página derivado vive únicamente en memoria; jamás va a SQLite o al navegador.
    const p = await this.graph(
      id(c.pagina || c.remoto),
      this.config.meta,
      undefined,
      { fields: "id,access_token,instagram_business_account" },
    );
    if (
      c.red === "instagram" &&
      id(objeto(p.instagram_business_account).id) !== c.remoto
    )
      throw new ErrorHttp(
        409,
        "Instagram no corresponde a la página asignada.",
      );
    const token = texto(p.access_token);
    if (!token)
      throw new ErrorHttp(
        409,
        "Asigna los activos y permisos al usuario de sistema de Cooper.",
      );
    return token;
  }
  async comprobar(c: CuentaMarca) {
    if (c.red === "instagram" || c.red === "facebook") {
      await this.pagina(c);
      if (c.red === "facebook") return { tipo: "PAGE" };
      const ig = await this.graph(id(c.remoto), this.config.meta, undefined, {
        fields: "id,username",
      });
      if (id(ig.id) !== c.remoto)
        throw new ErrorHttp(
          409,
          "Instagram no corresponde al activo asignado.",
        );
      return { tipo: "PROFESSIONAL" };
    }
    const p = await this.upload(
      `uploadposts/users/${encodeURIComponent(c.remoto)}`,
    );
    const account = objeto(objeto(p.profile).social_accounts)[c.red];
    if (
      !account ||
      (typeof account === "object" && Object.keys(account).length === 0)
    )
      throw new ErrorHttp(
        409,
        "Completa la conexión de esta red en el perfil de publicación.",
      );
    return { tipo: "PROFILE" };
  }
  async historial(c: CuentaMarca): Promise<Historica[]> {
    const result: Historica[] = [];
    if (c.red === "instagram" || c.red === "facebook") {
      const pageToken = await this.pagina(c);
      const token = c.red === "instagram" ? this.config.meta : pageToken;
      let after = "";
      for (let page = 0; page < 3; page++) {
        const r = await this.graph(
          `${id(c.remoto)}/${c.red === "instagram" ? "media" : "published_posts"}`,
          token,
          undefined,
          {
            fields:
              c.red === "instagram"
                ? "id,caption,timestamp,media_type,media_url,thumbnail_url"
                : "id,message,created_time,full_picture",
            limit: "25",
            ...(after ? { after } : {}),
          },
        );
        for (const m of lista(r.data)) {
          let metrics: Metricas = {
            vistas: null,
            alcance: null,
            interacciones: null,
            capturadas: Date.now(),
          };
          try {
            metrics = await this.metricasConToken(c, id(m.id), token);
          } catch {
            /* Los permisos/umbrales de insights pueden devolver ausencia; no inventar ceros. */
          }
          const image =
            texto(m.thumbnail_url) ||
            texto(m.media_url) ||
            texto(m.full_picture);
          result.push({
            id: id(m.id),
            texto: texto(m.caption) || texto(m.message),
            fecha: texto(m.timestamp) || texto(m.created_time),
            tipo: texto(m.media_type) || "POST",
            imagen: image.startsWith("https://") ? image : "",
            metricas: metrics,
          });
        }
        const paging = r.paging ? objeto(r.paging) : {};
        after = paging.cursors ? texto(objeto(paging.cursors).after) : "";
        if (!paging.next || !after) break;
      }
    } else {
      for (let page = 1; page <= 3; page++) {
        const r = await this.upload("uploadposts/history", {
          profile_username: c.remoto,
          platform: c.red,
          status: "success",
          page: String(page),
          limit: "20",
        });
        const rows = lista(r.history);
        for (const m of rows) {
          if (
            m.profile_username !== c.remoto ||
            m.platform !== c.red ||
            m.fallback_to_inbox
          )
            continue;
          const requestId = texto(m.request_id);
          let metricas: Metricas = {
            vistas: null,
            interacciones: null,
            alcance: null,
            capturadas: Date.now(),
          };
          if (requestId) {
            try {
              metricas = await this.metricas(c, requestId);
            } catch {
              /* Información no disponible. */
            }
          }
          result.push({
            id: requestId || id(m.platform_post_id),
            texto: texto(m.post_caption) || texto(m.post_title),
            fecha: texto(m.upload_timestamp),
            tipo: texto(m.media_type),
            imagen: "",
            metricas,
          });
        }
        if (rows.length < 20) break;
      }
    }
    return result;
  }
  private async metricasConToken(
    c: CuentaMarca,
    remote: string,
    token: string,
  ): Promise<Metricas> {
    const r = await this.graph(`${id(remote)}/insights`, token, undefined, {
      metric:
        c.red === "instagram"
          ? "views,reach,total_interactions"
          : "post_media_view,post_total_media_view_unique",
    });
    const values = new Map(
      lista(r.data).map((m) => [
        texto(m.name),
        numero(lista(m.values)[0]?.value) ??
          (m.total_value ? numero(objeto(m.total_value).value) : null),
      ]),
    );
    return {
      vistas:
        values.get(c.red === "instagram" ? "views" : "post_media_view") ?? null,
      alcance:
        values.get(
          c.red === "instagram" ? "reach" : "post_total_media_view_unique",
        ) ?? null,
      interacciones: values.get("total_interactions") ?? null,
      capturadas: Date.now(),
    };
  }
  async metricas(c: CuentaMarca, remote: string): Promise<Metricas> {
    if (c.red === "instagram" || c.red === "facebook") {
      const pageToken = await this.pagina(c);
      return this.metricasConToken(
        c,
        remote,
        c.red === "instagram" ? this.config.meta : pageToken,
      );
    }
    const r = await this.upload(
      `uploadposts/post-analytics/${encodeURIComponent(remote)}`,
      { platform: c.red },
    );
    const platform = objeto(objeto(r.platforms)[c.red]);
    const p = objeto(platform.post_metrics);
    const likes = numero(p.likes),
      comments = numero(p.comments);
    return {
      vistas: numero(p.views),
      alcance: numero(p.reach),
      interacciones:
        likes !== null && comments !== null ? likes + comments : null,
      capturadas: Date.now(),
    };
  }
  async publicar(
    c: CuentaMarca,
    p: PiezaMarca,
    medios: string[],
    guardar: (v: Checkpoint) => void,
  ): Promise<ResultadoRed> {
    const cp = { ...p.checkpoint };
    const save = (v: Checkpoint) => {
      Object.assign(cp, v);
      guardar(cp);
    };
    const tipo = p.datos.formato;
    if (c.red === "youtube" || c.red === "tiktok") {
      const key = `marca-${p.id}-${p.revision}`;
      if (cp.id) {
        const r = await this.upload("uploadposts/history", {
          request_id: cp.id,
          profile_username: c.remoto,
          platform: c.red,
          limit: "10",
        });
        const row = lista(r.history).find(
          (m) =>
            m.platform === c.red &&
            m.profile_username === c.remoto &&
            m.request_id === cp.id,
        );
        if (!row) return progreso(cp);
        if (
          row.fallback_to_inbox ||
          row.success !== true ||
          !texto(row.post_url).startsWith("https://")
        )
          return {
            estado: "revision",
            remoto: cp.id,
            checkpoint: cp,
            aviso:
              "La red requiere revisión; puede haber enviado el video a borradores.",
          };
        return publicada(cp.id, cp);
      }
      const form = new FormData();
      form.set("user", c.remoto);
      form.append("platform[]", c.red);
      form.set("title", p.datos.titulo);
      form.set("description", p.datos.texto);
      form.set("async_upload", "true");
      form.set("request_id", key);
      medios.forEach((url) =>
        form.append(tipo === "reel" ? "video" : "photos[]", url),
      );
      save({ envio: key });
      const r = await this.upload(
        tipo === "reel" ? "upload" : "upload_photos",
        {},
        form,
        key,
      );
      // Siempre conciliar el historial; HTTP 200/202 no demuestra publicación.
      save({ id: texto(r.request_id) || key, fase: "historial" });
      return progreso(cp);
    }
    const token = await this.pagina(c);
    if (c.red === "instagram") {
      if (!cp.id) {
        const limit = await this.graph(
          `${id(c.remoto)}/content_publishing_limit`,
          token,
          undefined,
          { fields: "quota_usage,config" },
        );
        const usage = lista(limit.data)[0];
        if (
          !usage ||
          numero(usage.quota_usage) === null ||
          Number(usage.quota_usage) >= 100
        )
          throw new ErrorHttp(
            429,
            "Instagram no tiene cuota de publicación disponible.",
          );
        const hijos = [...(cp.hijos ?? [])];
        const carousel = tipo === "carrusel";
        for (let i = hijos.length; i < medios.length; i++) {
          const v = await this.graph(`${id(c.remoto)}/media`, token, {
            [tipo === "reel" ? "video_url" : "image_url"]: medios[i],
            ...(carousel
              ? { is_carousel_item: true }
              : { caption: p.datos.texto }),
            ...(tipo === "reel"
              ? { media_type: "REELS" }
              : tipo === "historia"
                ? { media_type: "STORIES" }
                : {}),
          });
          hijos.push(id(v.id));
          save({ hijos });
        }
        if (carousel) {
          const v = await this.graph(`${id(c.remoto)}/media`, token, {
            media_type: "CAROUSEL",
            children: hijos,
            caption: p.datos.texto,
          });
          save({ id: id(v.id), fase: "contenedor" });
        } else save({ id: hijos[0], fase: "contenedor" });
        return progreso(cp);
      }
      const status = await this.graph(id(cp.id), token, undefined, {
        fields: "status_code",
      });
      if (["ERROR", "EXPIRED"].includes(texto(status.status_code)))
        throw new ErrorHttp(
          409,
          "El contenedor de Instagram necesita revisión.",
        );
      if (status.status_code !== "FINISHED") return progreso(cp);
      save({ fase: "publicando" });
      const result = await this.graph(`${id(c.remoto)}/media_publish`, token, {
        creation_id: cp.id,
      });
      return publicada(id(result.id), cp);
    }
    if (tipo === "reel") {
      if (!cp.id) {
        const start = await this.graph(`${id(c.remoto)}/video_reels`, token, {
          upload_phase: "start",
        });
        save({ id: id(start.video_id), fase: "subiendo" });
        const url = new URL(texto(start.upload_url));
        if (
          url.origin !== "https://rupload.facebook.com" ||
          url.username ||
          url.password
        )
          throw new ErrorHttp(502, "Destino de subida inválido.");
        await this.solicitar(url, `OAuth ${token}`, "POST", undefined, {
          file_url: medios[0],
        });
        save({ fase: "procesando" });
        return progreso(cp);
      }
      const r = await this.graph(id(cp.id), token, undefined, {
        fields: "status",
      });
      const status = objeto(r.status);
      if (
        status.publishing_phase &&
        objeto(status.publishing_phase).publish_status === "published"
      )
        return publicada(cp.id, cp);
      if (
        ["error", "expired", "upload_failed"].includes(
          texto(status.video_status),
        )
      )
        throw new ErrorHttp(409, "Facebook no pudo procesar el reel.");
      if (cp.fase === "publicando" || status.video_status !== "ready")
        return progreso(cp);
      save({ fase: "publicando" });
      await this.graph(`${id(c.remoto)}/video_reels`, token, {
        upload_phase: "finish",
        video_id: cp.id,
        video_state: "PUBLISHED",
        description: p.datos.texto,
      });
      return progreso(cp);
    }
    const fotos = [...(cp.hijos ?? [])];
    for (let i = fotos.length; i < medios.length; i++) {
      const r = await this.graph(`${id(c.remoto)}/photos`, token, {
        url: medios[i],
        published: false,
      });
      fotos.push(id(r.id));
      save({ hijos: fotos });
    }
    save({ fase: "publicando" });
    const r = await this.graph(
      `${id(c.remoto)}/${tipo === "historia" ? "photo_stories" : "feed"}`,
      token,
      tipo === "historia"
        ? { photo_id: fotos[0] }
        : {
            message: p.datos.texto,
            attached_media: fotos.map((media_fbid) => ({ media_fbid })),
          },
    );
    return publicada(id(r.post_id ?? r.id), cp);
  }
}
export function proveedorRed(): RedSocial {
  if (
    process.env.COOPER_DEMO === "1" ||
    (process.env.COOPER_MARCAS ?? "simulada") === "simulada"
  )
    return new RedSimulada();
  if (process.env.COOPER_MARCAS !== "real")
    throw new ErrorHttp(503, "Modo de marcas no válido.");
  return new RedOficial();
}
