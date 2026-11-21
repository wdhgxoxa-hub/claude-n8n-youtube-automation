// Datos compartidos con el navegador. Los transportes viven solo en proveedores/.
export const CONSENTIMIENTO_VERSION = "2026-11-20";
export const CONSENTIMIENTO =
  "Declaro que soy la persona de las fotos y la grabación. Autorizo a Cooper a crear y usar mi avatar o voz, a enviar el material necesario para generarlos y a Walter a revisar mi identidad. Mi creación será privada hasta que yo la comparta.";
export const CATALOGO = [
  {
    id: "alma",
    kind: "avatar",
    name: "Alma",
    description: "Presentadora natural",
    style: "realista",
  },
  {
    id: "mateo",
    kind: "avatar",
    name: "Mateo",
    description: "Narrador cercano",
    style: "realista",
  },
  {
    id: "luz",
    kind: "avatar",
    name: "Luz",
    description: "Ilustración editorial",
    style: "ilustrado",
  },
  {
    id: "cooper",
    kind: "avatar",
    name: "Cooper",
    description: "Tu compañero, en cámara",
    style: "ilustrado",
  },
  {
    id: "clara",
    kind: "voz",
    name: "Clara",
    description: "Español latino · cálida",
    style: "voz",
  },
  {
    id: "tomas",
    kind: "voz",
    name: "Tomás",
    description: "Español latino · serena",
    style: "voz",
  },
] as const;

export type EstadoMedio =
  | "revision"
  | "rechazado"
  | "iniciando"
  | "entrenando"
  | "listo"
  | "error"
  | "verificacion_proveedor";
export const ESTADOS_MEDIO: Record<EstadoMedio, string> = {
  revision: "En revisión de identidad",
  rechazado: "Identidad rechazada",
  iniciando: "Enviando material",
  entrenando: "Entrenamiento en curso",
  listo: "Listo para usar",
  error: "No se pudo completar",
  verificacion_proveedor: "Verificación adicional pendiente",
};
export type ItemCatalogo = {
  id: string;
  kind: "avatar" | "voz";
  name: string;
  description: string;
  style: string;
  simulada: boolean;
  preview: boolean;
};
export const VOCES_GEMINI = [
  "Zephyr",
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Leda",
  "Orus",
  "Aoede",
  "Callirrhoe",
  "Autonoe",
  "Enceladus",
  "Iapetus",
  "Umbriel",
  "Algieba",
  "Despina",
  "Erinome",
  "Algenib",
  "Rasalgethi",
  "Laomedeia",
  "Achernar",
  "Alnilam",
  "Schedar",
  "Gacrux",
  "Pulcherrima",
  "Achird",
  "Zubenelgenubi",
  "Vindemiatrix",
  "Sadachbia",
  "Sadaltager",
  "Sulafat",
] as const;
