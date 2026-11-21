# Revisión histórica de cierre-5

Fecha: 21 de noviembre de 2026, 15:52, Lima.

La ronda de la fuente `3ca4abdc3fe72a3c289f48f32d89ae87e0587159` terminó con **92 pruebas aprobadas**, cero inesperadas, omitidas o inestables y ningún error global de Playwright. Las 24 muestras visuales revisadas coinciden byte por byte con la copia completa del orquestador. Se conserva como evidencia histórica: el hallazgo H19 de memoria exigió un cambio posterior de producto y dos rondas nuevas. **Esta revisión no aprueba la versión final.**

## Evidencia conservada

- [Resultado y recibo de recuperación](evidencias/total-revision-historica-cierre-5/resultado.json): inicio `2026-11-21T20:19:25.570Z`, duración 1 964 505 ms, salida del contenedor 0 y `podman wait` 0. El supervisor externo terminó con 143; su causa no está demostrada y el contenedor continuó ejecutándose.
- [Registro visual](evidencias/total-revision-historica-cierre-5/revision-visual.json): 24 PNG originales inspeccionados, cada uno con observación, SHA-256 y contraste contra la copia final. Incluye Inicio, Marcas, Cuentas, Publicados, Aprendizaje y Ajustes de fábrica en 1440/390 px, temas oscuro/claro.
- [Cuatro matrices](evidencias/total-revision-historica-cierre-5/matrices.json): 22 entradas por matriz y casos aprobados. FPS mínimo de las matrices 59,999; máximo entre fotogramas 16,8 ms; CLS y tareas largas registrados en cero. Son medidas de la matriz, no mínimos del caos.
- [Tabla móvil oscura](evidencias/total-revision-historica-cierre-5/publicados-390-oscuro-tabla.png) y [clara](evidencias/total-revision-historica-cierre-5/publicados-390-claro-tabla.png): recortes derivados de originales, vistos a tamaño nativo; los originales permanecen intactos.

Los artefactos completos permanecen en `cooper/.cache/videos-integracion3/cierre-5` del worktree del orquestador. El registro visual conserva también las rutas originales del checkout limpio y las rutas finales contrastadas. El log recuperado es `.cache/cooper-total/rondas/cierre-5-contenedor.log`; conserva el aviso informativo `Slow test file` de Sentinel, 12 minutos acumulados, y el resultado `92 passed (32.7m)`.

## Observaciones visuales y Sentinel

En ambas muestras móviles de Publicados, `1630`, `2860`, `4090` y `5320` conservan una sola línea, con fechas y encabezados completos. La tabla mantiene su área de desplazamiento horizontal; la columna de retención queda fuera de la vista inicial, como corresponde a ese diseño. El registro por muestra detalla las comprobaciones de etiquetas, formularios, tarjetas, compositor, métricas, orígenes y correcciones. No se observaron recortes o superposiciones que impidieran leer estos 24 originales.

Sentinel ejecutó recorridos, caos y estabilidad en ambos anchos: 36 pantallas y 5658 acciones de caos en escritorio; 35 pantallas y 8867 acciones en móvil. Los hallazgos finales son exclusivamente informativos de cobertura de vistas sin URL propia; caos y estabilidad registran cero hallazgos. Los dos observadores conservaron 3685 y 2970 peticiones `net::ERR_ABORTED`, respectivamente; ninguna `ERR_BLOCKED_BY_CLIENT`. No se eliminaron esas observaciones ni se atribuye a todas una causa no probada.

Las matrices se registran solo después de completar sus 22 entradas y aprobar su caso: el JSON se escribe progresivamente. Tres capturas de escritorio oscuro vistas antes de ese cierre se reabrieron después; el registro definitivo corresponde a esa segunda revisión.

## Puerta, commits y límites

La puerta completa de esta fuente está acreditada por [el recibo de puerta6](evidencias/cooper-total/puerta-cierre-6/resultado.json) en la rama integrada: 459 pruebas unitarias, 77 E2E y 173 pruebas de flujos, con instalación, lint, tipos, compilación y preparación aprobados y cero advertencias. Esta tarea documental no vuelve a iniciar aplicaciones, navegadores ni la puerta.

La fuente incluye `3ca4abd`, exclusión precisa de la sincronización mutante en Sentinel y observador saneado. El antecedente de la exclusión y sus límites causales se conserva en [total-sentinel-montajes](total-sentinel-montajes.md). Este informe y sus cinco recibos/recortes se entregan en un commit documental atómico titulado «Conserva la revisión histórica completa de cierre cinco».

No se ejecutó la decodificación completa de todos los vídeos ni la revisión por fotogramas de los dos recorridos de esta ronda histórica. Los casos de grabación continua sí fueron aprobados por Playwright, pero eso no sustituye esas revisiones. Tampoco se deducen mediciones WCAG o validaciones de dispositivos físicos de la inspección visual. Los datos son de aceptación simulada y no acreditan publicaciones reales.

`cierre-6` no se inició. La aceptación final requiere muestras nuevas, recorridos y decodificación completa de `cierre-7` y `cierre-8`, sobre `22ece8e1f078b149944118feeabbb6c803992ff4`, una vez que ambas terminen correctamente. `docs/ESTADO.md` queda bajo integración del orquestador para conservar las actualizaciones simultáneas de los demás frentes.

## Pendientes de Walter

Ninguno para esta revisión documental. La revisión de las rondas nuevas continúa a cargo de Codex.
