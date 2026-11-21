"use client";
// Control existente del frente Aprendizaje (c726b30), separado para conservarlo al agregar resultados.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "./espacio";
import type { Ajustes } from "@/contratos/operacion";
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
    <section className="learning-section" aria-label="Control del aprendizaje">
      <label className="checkbox">
        <input
          type="checkbox"
          role="switch"
          checked={ajustes?.valores.allowAnalytics === true}
          disabled={!ajustes || ocupado}
          onChange={() => void cambiar()}
        />
        Medición y aprendizaje automático
      </label>
      <p className="muted">
        Recoge resultados a las 24 h, 72 h y 7 días para preparar las lecciones
        del siguiente guion. Al pausarlo se conservan las lecciones registradas.
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
