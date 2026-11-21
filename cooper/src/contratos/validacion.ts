import { z } from "zod";
import es from "zod/v4/locales/es.js";
// El locale es el último recurso: conserva los mensajes propios del esquema.
z.config(es());
// El navegador conserva una CSP sin eval. Evita también la sonda de JIT,
// que Chrome registra como infracción aunque Zod capture la excepción.
if (typeof window !== "undefined") z.config({ jitless: true });
export { z };
