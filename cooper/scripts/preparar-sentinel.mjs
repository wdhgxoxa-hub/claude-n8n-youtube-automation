import { prepararSentinel } from "./sentinel-cache.mjs";

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--repo" || !args[1]))
  throw new Error(
    "Uso: npm run preparar:sentinel -- [--repo /checkout/autorizado]",
  );
console.log(
  `Sentinel privado preparado y verificado: ${prepararSentinel(args[1])}`,
);
