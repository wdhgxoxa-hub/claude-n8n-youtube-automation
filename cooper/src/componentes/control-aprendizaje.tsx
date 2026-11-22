"use client";
// Control existente del frente Aprendizaje (c726b30), separado para conservarlo al agregar resultados.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "./espacio";
import type { Ajustes } from "@/contratos/operacion";
import styles from "./aprendizaje-vista.module.css";
export function InterruptorAprendizaje() {
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  useEffect(() => {
    let activo = true;
    void api<Ajustes>("admin/fabrica", undefined, "GET").then(
      (r) => {
        if (activo) setAjustes(r);
      },
      (e: Error) => {
        if (activo) setError(e.message);
      },
    );
    return () => {
      activo = false;
    };
  }, []);
  async function cambiar() {
    if (!ajustes || bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    try {
      await api("operacion", {
        accion: "ajustes",
        revision: ajustes.revision,
        valores: { allowAnalytics: ajustes.valores.allowAnalytics !== true },
        confirmado: true,
      });
      setAjustes(await api<Ajustes>("admin/fabrica", undefined, "GET"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  return (
    <section className={styles.control} aria-label="Control del aprendizaje">
      <div className={styles.controlCabecera}>
        <div className={styles.controlTitulo}>
          <strong>Medición automática</strong>
          <span className={styles.controlEstado}>
            {ocupado
              ? "Guardando el cambio…"
              : !ajustes
                ? error
                  ? "No pudimos consultar el estado"
                  : "Consultando el estado…"
                : ajustes.valores.allowAnalytics === true
                  ? "Activa"
                  : "En pausa"}
          </span>
        </div>
        <label className={styles.interruptor}>
          <input
            type="checkbox"
            role="switch"
            aria-label="Medición y aprendizaje automático"
            checked={ajustes?.valores.allowAnalytics === true}
            disabled={!ajustes || ocupado}
            onChange={() => void cambiar()}
          />
          <span aria-hidden="true" />
        </label>
      </div>
      <p>
        Recoge resultados a las 24 h, 72 h y 7 días para preparar las lecciones
        del siguiente guion. Al pausarlo, lo aprendido se queda contigo.
      </p>
      {error && (
        <p role="alert">
          {error}{" "}
          <Link href="/admin/fabrica">Revisar ajustes de la fábrica</Link>
        </p>
      )}
    </section>
  );
}
