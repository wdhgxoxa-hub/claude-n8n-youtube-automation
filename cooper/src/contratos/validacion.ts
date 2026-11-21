import { z } from "zod";
// El navegador conserva una CSP sin eval. Evita también la sonda de JIT,
// que Chrome registra como infracción aunque Zod capture la excepción.
if (typeof window !== "undefined") z.config({ jitless: true });
export { z };
