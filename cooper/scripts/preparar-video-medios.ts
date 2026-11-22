// Precarga manual en una COPIA dentro de .cache. No lee .env, no migra producción
// ni publica archivos. Sin --permitir-red solo reutiliza montajes ya guardados.
import { realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

async function main() {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf("--base");
  if (
    baseIndex < 0 ||
    !args[baseIndex + 1] ||
    args.some(
      (arg, i) =>
        i !== baseIndex + 1 && !["--base", "--permitir-red"].includes(arg),
    )
  )
    throw new Error(
      "Uso: tsx scripts/preparar-video-medios.ts --base .cache/copia.sqlite [--permitir-red]",
    );
  const raiz = realpathSync(resolve(".cache"));
  const base = realpathSync(resolve(args[baseIndex + 1]));
  const resto = relative(raiz, base);
  if (
    !resto ||
    resto.startsWith("..") ||
    isAbsolute(resto) ||
    !statSync(base).isFile()
  )
    throw new Error(
      "La base debe ser una copia existente dentro de cooper/.cache.",
    );
  process.env.COOPER_DATABASE_PATH = base;
  process.env.COOPER_DEMO = "0";
  process.env.COOPER_FABRICA = "simulada";
  const [
    { db },
    { users, videos },
    { leerObservabilidad },
    { sincronizarVideoMedios, leerVideoMedios },
  ] = await Promise.all([
    import("../src/db"),
    import("../src/db/schema"),
    import("../src/contratos/observabilidad"),
    import("../src/servicios/video-medios"),
  ]);
  const personas = new Map(
    db()
      .select()
      .from(users)
      .all()
      .filter((u) => u.active)
      .map((u) => [u.id, u]),
  );
  const resumen = {
    videos: 0,
    publicaciones: 0,
    listo: 0,
    sin_medio: 0,
    pendiente: 0,
    no_disponible: 0,
  };
  for (const video of db().select().from(videos).all()) {
    const owner = personas.get(video.ownerId);
    if (!owner) continue;
    resumen.videos++;
    for (const id of [
      "",
      ...leerObservabilidad(video.observability)
        .publicaciones.map((p) => p.id)
        .filter(Boolean),
    ]) {
      if (id) resumen.publicaciones++;
      await sincronizarVideoMedios(
        owner,
        video.id,
        id,
        args.includes("--permitir-red") ? fetch : undefined,
      );
      resumen[leerVideoMedios(owner, video.id, id).estado]++;
    }
  }
  process.stdout.write(`${JSON.stringify(resumen, null, 2)}\n`);
}
main().catch(() => {
  process.stderr.write(
    "No se pudo preparar la copia. Verifica --base dentro de .cache; no uses una base de producción.\n",
  );
  process.exitCode = 1;
});
