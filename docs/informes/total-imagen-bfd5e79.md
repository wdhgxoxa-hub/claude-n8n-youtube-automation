# Aceptación de imagen bfd5e79

Fecha: 2026-11-21 14:37 (Lima). Frente operación de cooper-total.

**Actualización posterior:** `bfd5e79` queda descartada para activación final. H19 compilado agotó 1 GiB sin swap al sincronizar 10.000 videos y consultar estado. Los resultados siguientes conservan su alcance histórico, pero no acreditan ese caso ni autorizan la activación. Se requiere [nueva imagen y aceptación](total-siguiente-imagen.md).

## Resultado y alcance

**Probado localmente; todavía no desplegado.** La imagen `localhost/cooper:bfd5e79` supera migración y reversa SQLite 11→13, los ocho bloques de Compose y el aplicador conjunto de infraestructura con fallo provocado, recuperación de archivos/datos y actualización posterior. No se repitieron compilaciones ni navegadores en este frente. Las dos rondas y la revisión visual corresponden al orquestador.

La fuente es `bfd5e79283bdd2c571937a9f30d8ff512015430f`; configuración de imagen `sha256:c49ab59a02361557751ca58b3f853cb201f57241f46b745af007253a651d0db0`. El archivo de 267.692.019 bytes tiene SHA-256 `7de4ab10c82939be0732483cbffd29eee3c12b0b2f40d342b76a57046bc53240`, comprobado también tras copiarlo al área operativa del VPS. No se cargó ni activó allí. Las aceptaciones `719409f` y `fcfab3b` quedan como cortes anteriores, no como prueba de esta imagen.

## Evidencia

- [Migración y reversa](evidencias/total-radar-contexto/bfd5e79/migracion.json): 11→13 migraciones, 27 tablas anteriores conservadas, integridad y claves foráneas correctas. Copia anterior SHA-256 `e855ef149d3a67f492a2b1a2a1863b0d780a3b3a054d4b76e5edfb7c424b7066`; reversión y arranque de la imagen anterior comprobados sin red.
- [Ocho bloques Compose](evidencias/total-radar-contexto/bfd5e79/compose.log): TLS, login ficticio, medios sintéticos Marcas, firmas, SSE y reconexiones, restic/restauración, exportación/importación y actualización/reversa. Ninguna publicación real.
- [Contrato exacto de infraestructura](evidencias/total-radar-contexto/bfd5e79/infra-ensayo.json): n8n/runner 2.47.6 y Caddy 2.11.8 fijados por digest; SHA de Compose, Caddy, runner y manifiesto. El motor de migración referenciado corresponde al corte anterior de **45 workflows y 130 filas**; no se confunde con el corte posterior de 144 filas usado para el delta Radar/Resolver en ambos motores.
- [Aplicador exacto](evidencias/total-radar-contexto/bfd5e79/infra-resultado.json), [fallo y reversión](evidencias/total-radar-contexto/bfd5e79/infra-fallo-inyectado.json), [actualización posterior](evidencias/total-radar-contexto/bfd5e79/infra-actualizacion.json): archivos públicos y datos restaurados con sus huellas antes de volver a intentar. No se copia el archivo de entorno.

El aplicador ensayado tiene SHA-256 `9273e7d6e60114948ec7413dfbe92bbf2311cbbe1ff0879fb5d4706e8c5738cd` y Operator `5331274f0b37214e9c486d2d68b291c20580ad41e02523b99967798bdc59d56b`. Compose: `b3071fc8b069fec5f522ea7d69c4232ac8436519b09810178e610bdf649eedb7`. Se conserva Caddy `17515ce1927fa921b8f3f7242c2e3cfe024b24b99b8b6e9874e9d1e1f442153c`, que incluye el bloqueo de sondas públicas ya aceptado en vivo.

## Intentos y límites

La preparación del recibo exigió normalizar el prefijo público `sha256:` del ID de Podman, resolver la ruta absoluta del fixture y habilitar explícitamente `COOPER_LAB=1`. Los tres rechazos ocurrieron antes de mutación; el ensayo posterior completo pasó sin advertencias ni cambios en los umbrales. Los archivos de laboratorio y las copias de bases quedan privados y excluidos de Git.

Este commit solo incorpora recibos públicos y documentación. La puerta web completa y las dos rondas limpias todavía no se declaran terminadas aquí. El VPS sigue en su versión anterior hasta que el orquestador cierre esas condiciones y conceda el turno de despliegue. Después serán necesarias la copia final, réplica/restauración, instalación opaca del secreto worker de Marcas, arranque de las versiones finales y aceptación pública.

## Pendientes de Walter

Ninguna decisión de Walter bloquea estos ensayos o el despliegue ya autorizado. El acceso con sesión Google legítima y las activaciones de proveedores permanecen en sus informes correspondientes; no se hicieron OAuth, pagos ni publicaciones reales.
