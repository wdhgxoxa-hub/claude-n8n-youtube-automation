"use client";
import { useId, useRef, useState } from "react";
import { Check } from "lucide-react";
import { api, useEspacio } from "./espacio";
import { TEMAS, TEMAS_INFO, temaValido, type Tema } from "@/lib/temas";
import "./apariencia.css";

/** Pinta el tema en el documento. Con transición de vista si el equipo la ofrece. */
function pintar(tema: Tema) {
  const raiz = document.documentElement;
  const aplicar = () => {
    raiz.dataset.tema = tema;
    raiz.dataset.theme = TEMAS_INFO[tema].esquema;
  };
  const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (quieto || !document.startViewTransition) return aplicar();
  // Fundido corto y propio, no el desplazamiento de cambio de ruta.
  raiz.dataset.cambioTema = "";
  const transicion = document.startViewTransition(aplicar);
  transicionTema = transicion;
  // Un toque nuevo (u otra transición) salta la animación en curso y su
  // `ready` se rechaza con «Transition was skipped»: es lo esperado, el tema
  // igual queda aplicado. Solo la última transición quita la marca.
  transicion.ready.catch(() => {});
  transicion.finished
    .catch(() => {})
    .then(() => {
      if (transicionTema !== transicion) return;
      transicionTema = null;
      delete raiz.dataset.cambioTema;
    });
}
let transicionTema: ViewTransition | null = null;

/** Selector de apariencia: se aplica y se guarda al tocar, sin botón aparte. */
export function Apariencia() {
  const id = useId();
  const { data, refresh } = useEspacio();
  // La verdad es el perfil guardado; `pendiente` solo cubre el instante entre
  // el toque y la respuesta, para que el selector nunca contradiga a la página.
  const guardado = temaValido(data.user.theme);
  const [pendiente, setPendiente] = useState<Tema | null>(null);
  const [estado, setEstado] = useState<"" | "guardado" | "error">("");
  const tema = pendiente ?? guardado;
  // Toques seguidos: cada guardado espera al anterior, para que el último toque
  // sea también el último que llega al servidor, y solo el último toque decide
  // lo que muestra el selector. `confirmado` es lo último que el servidor aceptó.
  const fila = useRef({
    turno: 0,
    confirmado: guardado,
    cola: Promise.resolve() as Promise<unknown>,
  });

  async function elegir(nuevo: Tema) {
    if (nuevo === tema) return;
    const f = fila.current;
    if (pendiente === null) f.confirmado = guardado;
    const mio = ++f.turno;
    const vigente = () => mio === f.turno;
    setPendiente(nuevo);
    setEstado("");
    pintar(nuevo);
    const guardar = f.cola.then(async () => {
      await api(
        "perfil",
        {
          name: data.user.name,
          image: data.user.image,
          theme: nuevo,
          home: data.user.home,
          whatsapp: data.user.whatsapp,
        },
        "PATCH",
      );
      f.confirmado = nuevo;
    });
    f.cola = guardar.catch(() => {});
    try {
      await guardar;
      if (!vigente()) return;
      await refresh();
      if (!vigente()) return;
      setEstado("guardado");
      setPendiente(null);
    } catch {
      if (!vigente()) return;
      pintar(f.confirmado);
      setEstado("error");
      // Sin el estado al día, el selector se queda en lo que el servidor aceptó.
      try {
        await refresh();
        if (vigente()) setPendiente(null);
      } catch {
        if (vigente()) setPendiente(f.confirmado);
      }
    }
  }

  return (
    <fieldset className="apariencia">
      <legend>Apariencia</legend>
      <p className="helper" id={`${id}-ayuda`}>
        Elige cómo se ve tu estudio. Se guarda solo y te acompaña en todos tus
        dispositivos.
      </p>
      <div className="apariencia-opciones">
        {TEMAS.map((opcion) => (
          <label
            key={opcion}
            className="apariencia-opcion"
            data-activa={opcion === tema}
          >
            <input
              type="radio"
              name="theme"
              value={opcion}
              checked={opcion === tema}
              aria-describedby={`${id}-ayuda`}
              onChange={() => elegir(opcion)}
            />
            <span
              className="apariencia-muestra"
              data-tema={opcion}
              aria-hidden="true"
            >
              <span className="apariencia-riel">
                <i data-punto="inicio" />
                <i data-punto="fabrica" />
                <i data-punto="publicados" />
                <i data-punto="aprendizaje" />
              </span>
              <span className="apariencia-lienzo">
                <b />
                <span className="apariencia-tarjeta">
                  <em />
                  <u />
                </span>
              </span>
            </span>
            <span className="apariencia-nombre">
              {TEMAS_INFO[opcion].nombre}
              {opcion === tema && <Check size={16} aria-hidden="true" />}
            </span>
            <span className="apariencia-lema">{TEMAS_INFO[opcion].lema}</span>
          </label>
        ))}
      </div>
      <p className="apariencia-estado" role="status">
        {estado === "guardado" &&
          `Listo: ahora usas «${TEMAS_INFO[tema].nombre}».`}
        {estado === "error" &&
          "No pudimos guardar el cambio. Dejamos el tema anterior; inténtalo otra vez."}
      </p>
    </fieldset>
  );
}
