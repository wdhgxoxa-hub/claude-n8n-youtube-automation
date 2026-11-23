"use client";
import { useId, useState } from "react";
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
  document
    .startViewTransition(aplicar)
    .finished.finally(() => delete raiz.dataset.cambioTema);
}

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

  async function elegir(nuevo: Tema) {
    if (nuevo === tema) return;
    setPendiente(nuevo);
    setEstado("");
    pintar(nuevo);
    try {
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
      await refresh();
      setEstado("guardado");
    } catch {
      pintar(guardado);
      setEstado("error");
    } finally {
      setPendiente(null);
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
