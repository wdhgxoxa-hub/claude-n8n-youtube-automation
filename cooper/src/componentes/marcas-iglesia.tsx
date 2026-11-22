import {
  calendarioIglesia,
  fuentesDoctrinalesIglesia,
  pendientesIglesia,
  plantillasIglesia,
} from "@/servicios/marcas/iglesia";

export function IglesiaEditorial() {
  return (
    <section
      className="marca-iglesia"
      aria-labelledby="iglesia-editorial-titulo"
    >
      <p className="marca-ceja">La semana de tu comunidad</p>
      <h3 id="iglesia-editorial-titulo">
        Contenido reformado para la congregación
      </h3>
      <p>
        Una palabra que acompaña, una invitación a encontrarse. Cada pieza
        conserva un tono reverente y pastoral, con la Escritura como autoridad
        suprema.
      </p>
      <h4>Calendario semanal propuesto</h4>
      <p>
        Horarios de ejemplo en Lima. Cada pieza requiere revisión; este plan no
        programa publicaciones automáticamente.
      </p>
      <ol className="iglesia-semana">
        {calendarioIglesia.map((dia) => (
          <li key={dia.id}>
            <strong>
              {dia.dia} · {dia.hora}
            </strong>
            <h5>{dia.titulo}</h5>
            <p>{dia.objetivo}</p>
          </li>
        ))}
      </ol>
      <details>
        <summary>Plantillas, revisión y pendientes de Walter</summary>
        <p>
          Westminster y Heidelberg son referencias subordinadas. La adopción
          confesional de la iglesia requiere confirmación pastoral.
        </p>
        <ul>
          {plantillasIglesia.map((p) => (
            <li key={p.id}>
              <strong>{p.nombre}:</strong> {p.descripcion}
            </li>
          ))}
        </ul>
        <p>
          Borrador → vista previa → revisión doctrinal con responsable pastoral
          y fuentes → aprobación de Walter → programación. Corregir una pieza
          exige repetir la revisión y la aprobación. El especialista nunca las
          concede. Los datos de ejemplo no se pueden aprobar.
        </p>
        <h4>Pendientes de Walter</h4>
        <ul>
          {pendientesIglesia.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <h4>Referencias para la revisión pastoral</h4>
        <ul>
          {fuentesDoctrinalesIglesia.map((f) => (
            <li key={f.url}>
              <a href={f.url} target="_blank" rel="noreferrer">
                {f.nombre}
              </a>
              . {f.alcance}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
