// Metadatos compartidos por la interfaz y los validadores del servidor.
import catalogo from "./ajustes-fabrica.json";
import campos from "./biblia-campos.json";
export { catalogo, campos };
export const camposBiblia = Object.fromEntries(
  Object.entries(campos).map(([k, v]) => [k, v.etiqueta]),
) as Record<keyof typeof campos, string>;
