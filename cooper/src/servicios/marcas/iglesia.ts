import type { Guia, PiezaDatos } from "./tipos";

/** Propuesta editorial: no acredita la identidad ni la confesión de la iglesia. */
export const perfilIglesia = {
  nombre: "Iglesia (por confirmar)",
  rubro: "iglesia-reformada" as const,
  zona: "America/Lima",
  guia: {
    colores: ["#142c3b", "#f0eee7", "#cbbb9f"],
    tipografia: "serif",
    logoId: "",
    tono: "Reverente, pastoral y claro. Doctrina reformada, Escritura como autoridad suprema y Westminster/Heidelberg como referencias subordinadas por confirmar con la iglesia. Sin sensacionalismo, manipulación, promesas de prosperidad ni polémicas para generar interacción.",
    versionBiblia: "Por confirmar",
  } satisfies Guia,
};

export const controlesDoctrinalesIglesia = [
  "fuentes_cotejadas",
  "contexto_biblico",
  "coherencia_confesional",
  "tono_pastoral",
  "datos_y_permisos",
  "revision_final",
] as const;

export const revisionDoctrinalIglesia: ReadonlyArray<{
  id: (typeof controlesDoctrinalesIglesia)[number];
  etiqueta: string;
  detalle: string;
}> = [
  {
    id: "fuentes_cotejadas",
    etiqueta: "Fuentes y citas cotejadas",
    detalle:
      "Confirmar la traducción bíblica autorizada y cada cita exacta con su referencia, versión y fuente. Para citas confesionales, comprobar documento, sección y edición; una paráfrasis se identifica como explicación propia.",
  },
  {
    id: "contexto_biblico",
    etiqueta: "Contexto bíblico conservado",
    detalle:
      "Leer el pasaje completo y distinguir texto bíblico de aplicación pastoral. El título, la selección de versículos y el recorte de una predicación deben conservar el sentido de la fuente.",
  },
  {
    id: "coherencia_confesional",
    etiqueta: "Revisión doctrinal y pastoral",
    detalle:
      "Contrastar la enseñanza con la Escritura y los estándares que la iglesia haya confirmado. Un responsable pastoral revisa diferencias confesionales, sacramentos, culto y afirmaciones controvertidas antes de la aprobación de Walter.",
  },
  {
    id: "tono_pastoral",
    etiqueta: "Tono reverente, sin sensacionalismo",
    detalle:
      "Evitar titulares alarmistas, prosperidad, revelaciones personales atribuidas a Dios, culpabilización para conseguir interacción y caricaturas de otras tradiciones. Priorizar consuelo, claridad y cuidado de la congregación.",
  },
  {
    id: "datos_y_permisos",
    etiqueta: "Datos y permisos confirmados",
    detalle:
      "Sustituir todos los ejemplos y campos por confirmar. Verificar nombre, horarios, ubicación y predicador; contar con permiso para el sermón, imagen, voz y personas que aparecen, especialmente menores.",
  },
  {
    id: "revision_final",
    etiqueta: "Pieza final revisada por una persona",
    detalle:
      "Revisar el texto, las láminas, el audio, el video y los subtítulos de esta revisión exacta. Walter registra la aprobación humana; una corrección posterior exige otra revisión y nunca autoriza al especialista a publicar.",
  },
];

type DatosPlantillaIglesia = Pick<
  PiezaDatos,
  | "formato"
  | "plantilla"
  | "titulo"
  | "texto"
  | "detalle"
  | "diapositivas"
  | "citas"
>;

export const plantillasIglesia: ReadonlyArray<{
  id: "versiculo" | "devocional" | "anuncios" | "reel_predicacion";
  nombre: string;
  descripcion: string;
  datos: DatosPlantillaIglesia;
}> = [
  {
    id: "versiculo",
    nombre: "Versículo de la semana",
    descripcion:
      "Una imagen con un pasaje cotejado y su referencia legible. Seleccionar desde el corpus aprobado; nunca reconstruir el versículo de memoria.",
    datos: {
      formato: "imagen",
      plantilla: "libre",
      titulo: "EJEMPLO · Versículo de la semana",
      texto:
        "EJEMPLO — BORRADOR. [Texto bíblico exacto pendiente de cotejo]. [Referencia y traducción autorizada por confirmar]. Añadir aquí una invitación pastoral breve que respete el contexto del pasaje.",
      detalle: "EJEMPLO · Texto y versión pendientes de revisión",
      diapositivas: [],
      citas: [],
    },
  },
  {
    id: "devocional",
    nombre: "Devocional pastoral",
    descripcion:
      "Carrusel: lectura, explicación y aplicación. Westminster y Heidelberg orientan la revisión; una referencia confesional no se presenta como texto bíblico.",
    datos: {
      formato: "carrusel",
      plantilla: "libre",
      titulo: "EJEMPLO · Esperanza y gratitud",
      texto:
        "EJEMPLO — BORRADOR. Propuesta de devocional: consuelo en Cristo y gratitud en la vida cotidiana. Preparar la lectura bíblica cotejada, una explicación pastoral propia y una pregunta para meditar. Referencia de estudio: Catecismo de Heidelberg, preguntas 1–2; no es una cita literal ni una postura aprobada por la iglesia.",
      detalle: "EJEMPLO · Aplicación pastoral por revisar",
      diapositivas: [
        "EJEMPLO · Lectura: [pasaje y traducción cotejados pendientes].",
        "EJEMPLO · Explicación propia: [desarrollar el sentido del pasaje con revisión pastoral].",
        "EJEMPLO · Aplicación: [pregunta y oración propuestas por el equipo pastoral].",
      ],
      citas: [],
    },
  },
  {
    id: "anuncios",
    nombre: "Anuncios de la congregación",
    descripcion:
      "Historia con actividad, día, hora y lugar confirmados. No presupone horarios de culto, domicilios ni nombres de responsables.",
    datos: {
      formato: "historia",
      plantilla: "domingo",
      titulo: "EJEMPLO · Nos reunimos como iglesia",
      texto:
        "EJEMPLO — BORRADOR. [Actividad por confirmar]. Día: [por confirmar]. Hora: [por confirmar]. Lugar: [por confirmar]. Responsable: [por confirmar]. Te invitamos a participar; consulta los detalles con el equipo de la iglesia.",
      detalle: "EJEMPLO · No es una convocatoria real",
      diapositivas: [],
      citas: [],
    },
  },
  {
    id: "reel_predicacion",
    nombre: "Reel de predicación",
    descripcion:
      "Fragmento autorizado, con subtítulos cotejados y referencia al sermón completo. Elegir un montaje propio aprobado, conservando el contexto del predicador.",
    datos: {
      formato: "reel",
      plantilla: "libre",
      titulo: "EJEMPLO · Para meditar en la semana",
      texto:
        "EJEMPLO — BORRADOR. [Resumen fiel del fragmento autorizado]. Predicación: [título, predicador y fecha por confirmar]. Fragmento: [inicio y fin por revisar]. Sermón completo: [enlace autorizado pendiente]. Cotejar audio, subtítulos y cualquier cita bíblica antes de solicitar aprobación.",
      detalle: "EJEMPLO · Sin video ni permisos de publicación adjuntos",
      diapositivas: [],
      citas: [],
    },
  },
];

/** Horarios de ejemplo para conversar; no crea publicaciones ni recurrencias. */
export const calendarioIglesia = [
  {
    id: "lunes_versiculo",
    dia: "Lunes",
    diaSemana: 1,
    hora: "08:00",
    titulo: "Versículo",
    objetivo:
      "Comenzar la semana con una lectura bíblica cotejada y contextualizada.",
    plantillaId: "versiculo",
  },
  {
    id: "miercoles_devocional",
    dia: "Miércoles",
    diaSemana: 3,
    hora: "19:00",
    titulo: "Devocional",
    objetivo:
      "Acompañar a la congregación con enseñanza y aplicación pastoral.",
    plantillaId: "devocional",
  },
  {
    id: "viernes_anuncios",
    dia: "Viernes",
    diaSemana: 5,
    hora: "18:00",
    titulo: "Anuncios",
    objetivo:
      "Compartir solo las actividades y los horarios confirmados por el equipo.",
    plantillaId: "anuncios",
  },
  {
    id: "domingo_reel",
    dia: "Domingo",
    diaSemana: 0,
    hora: "19:00",
    titulo: "Reel de predicación",
    objetivo:
      "Recordar un fragmento autorizado; posponer si falta revisión o permiso.",
    plantillaId: "reel_predicacion",
  },
] as const;

/** Propone un instante; guardarlo no sustituye la revisión ni la aprobación. */
export function proximaFechaIglesia(
  plantillaId: (typeof plantillasIglesia)[number]["id"],
  now = Date.now(),
): string {
  const slot = calendarioIglesia.find((v) => v.plantillaId === plantillaId);
  if (!slot) throw new Error("Plantilla de iglesia no disponible.");
  // America/Lima usa UTC-5: calcular en UTC evita depender del equipo del usuario.
  const desfaseLima = 5 * 60 * 60 * 1000;
  const fechaLima = new Date(now - desfaseLima);
  const [hora, minuto] = slot.hora.split(":").map(Number);
  const dias = (slot.diaSemana - fechaLima.getUTCDay() + 7) % 7;
  let candidata =
    Date.UTC(
      fechaLima.getUTCFullYear(),
      fechaLima.getUTCMonth(),
      fechaLima.getUTCDate() + dias,
      hora,
      minuto,
    ) + desfaseLima;
  if (candidata - now < 10 * 60 * 1000) candidata += 7 * 24 * 60 * 60 * 1000;
  return new Date(candidata).toISOString();
}

export const fuentesDoctrinalesIglesia = [
  {
    nombre: "Confesión de Westminster · OPC",
    url: "https://opc.org/wcf.html",
    alcance:
      "Referencia institucional en inglés: capítulo 1, autoridad e interpretación de la Escritura; capítulos 8 y 11, Cristo y justificación. Confirmar la edición española y los estándares adoptados localmente.",
  },
  {
    nombre: "Catecismo de Heidelberg · RCA",
    url: "https://www.rca.org/about/theology/creeds-and-confessions/the-heidelberg-catechism/",
    alcance:
      "Referencia institucional: preguntas 1–2, consuelo y gratitud; 21, fe; 60, justificación. Consultar la edición acordada antes de reproducir citas. No acredita afiliación de la iglesia a esta denominación.",
  },
] as const;

export const pendientesIglesia = [
  "Confirmar el nombre de la iglesia, su responsable y los permisos de representación.",
  "Confirmar estándares confesionales, edición en español, traducción bíblica y corpus autorizado.",
  "Designar al responsable pastoral de revisión doctrinal y acordar su coordinación con Walter.",
  "Acordar días, horas, actividades y datos de contacto; el calendario es solo una propuesta.",
  "Aportar logo, cuentas propias, sermones y permisos de imagen, voz y publicación.",
] as const;
