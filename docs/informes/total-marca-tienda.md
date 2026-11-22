# total-marca-tienda — plantilla para la futura tienda de ropa

Fecha: 21-11-2026, Lima. Rama y worktree: `total-marca-tienda`, `/home/david/Proyectos/cooper-wt/total-marca-tienda`. Base exacta de `total-integrador`: `deb1f2a566d06d7f36fd540e6756863dd136cb89`.

Estado: implementado y probado localmente; puerta completa **PASS**, cero errores y cero advertencias. Sin integración, push ni despliegue de esta misión. No se modificaron el VPS, n8n vivo ni D&S Factory; no hubo OAuth, pagos ni publicación en redes.

## Cambios

- **Marcas → Añadir marca o cuenta → Punto de partida → Tienda de ropa de Walter (ejemplo)** precarga nombre, rubro moda, tono, colores y tipografía. La creación sigue el servicio privado existente; no crea cuentas, piezas ni resultados. La plantilla se conserva al editar y recargar, y una marca sin plantilla conserva su recorrido anterior.
- La pestaña **Tienda** reúne cinco pilares con guías de contenido: lanzamientos, lookbooks, reels de producto, ofertas y UGC. Incluye una semana orientativa con formato, horario y objetivo, siempre marcada como ejemplo y no programada. Las piezas reales usan el calendario y las aprobaciones existentes.
- El especialista reutiliza el proveedor de texto existente. Exige producto, precio, stock, condiciones comerciales y permisos comprobados; no inventa descuentos, escasez, testimonios ni atributos ambientales. Recibe la configuración editorial, sin ventas ficticias ni herramientas de aprobación.
- Conversión real **Sin datos**; ejemplo didáctico separado de 1.000 sesiones, 120 con carrito, 60 con inicio de compra, 30 con compra, 32 pedidos e ingresos de 3.840 PEN. Tasas: 12 %, 6 % y 3 %; ticket medio: 120 PEN. La conversión usa sesiones con compra, no número de pedidos. Datos ausentes o denominador cero producen `null`; un cero medido conserva su valor.
- Catálogo futuro **Desconectado**, plataforma por definir y URL `null`. Contrato descriptivo para producto/SKU, variantes, precio/moneda, stock, medios, promociones, fecha de actualización y atribución por marca/pieza/campaña. No hay endpoints inventados, adaptador remoto ni sincronización activa.
- Persistencia aditiva en el JSON `guia.tienda`; sin migración SQL ni dependencia nueva. Se reutilizan los controles de dueño/administrador. El servidor valida el contrato; el navegador recibe un módulo de contenido sin Zod ni evaluación dinámica.

## Commits

| Commit | Contenido |
| --- | --- |
| `7d83541` | Plantilla, especialista, validación, cálculo y 20 pruebas unitarias nuevas. |
| `5acf1a5` | Alta y pestaña Tienda, calendario/conversión/catálogo, navegación persistente, tres E2E y guía de uso. |
| `b889851` | Separación de validadores y navegador; corrección del selector de edición y comprobación CDP de incidencias. |

El commit documental de cierre añade este informe, la evidencia resumida y la actualización de `docs/ESTADO.md`, sin cambiar el código probado. Los dos archivos de misión que ya estaban sin seguimiento se conservaron fuera de los commits.

## Pruebas y correcciones

Las 41 pruebas focales (20 nuevas y 21 existentes de Marcas), typecheck y ESLint focal pasaron. Tres subagentes trabajaron en núcleo, interfaz y E2E con archivos separados; la revisión cruzada fue local y no equivale a aceptación de Claude o Walter.

La preparación directa en el anfitrión fue rechazada por plataforma no soportada. Se reutilizó `npm run ci:limpia`, que exporta solo el commit, prepara Sentinel verificado y ejecuta la puerta dentro de Debian 12, con bases/sesiones ficticias y puertos propios. No se cambiaron el preflight, los guardianes ni los umbrales.

El primer ensayo limpio de `5acf1a5` pasó 487 unitarias y detectó dos fallos E2E: Zod importado por la vista intentaba `new Function`, generando una incidencia CSP, y el selector exacto por label de Tono incluía el contenido inicial del textarea. Se detuvo únicamente ese contenedor tras registrar los fallos; no cuenta como una puerta aprobada. Se separó el módulo de contenido y se comprobó con HTML de la traza que la selección por rol encuentra y edita el campo. Las aserciones de seguridad originales se conservaron y se añadieron a los dos escenarios visuales nuevos. [Recibo del intento fallido](evidencias/total-marca-tienda/puerta-inicial-fallida.json).

Puerta de cierre sobre `b88985145fa79f3bd90ce28f70bfc11de4a40488`: **PASS**, ejecutada del 21-11-2026 18:06:31 al 18:26:14 (Lima). `npm run ci:limpia` terminó con rc 0 sobre un archivo limpio del commit. Entorno: Debian 12, Node 24.22.3, npm 12.2.2, Python 3.14.7, uv 0.12.24 y Sentinel `6764bbdcab91719947e93ba1cc476cbefafb58e8`.

| Paso | Resultado | rc | Advertencias |
| --- | --- | --- | --- |
| `npm ci` | PASS | 0 | 0 |
| Preparación aislada de pruebas | PASS | 0 | 0 |
| `npm run lint` | PASS | 0 | 0 |
| `npm run typecheck` | PASS | 0 | 0 |
| `npm test` | 487/487 | 0 | 0 |
| `npm run test:e2e` | 106/106 | 0 | 0 |
| `npm run build` | PASS | 0 | 0 |
| `node --test tests/flujos_v2.test.cjs` | 235/235 | 0 | 0 |

Cero omisiones y cero E2E inestables o recuperados mediante reintentos. Se verificaron los ocho hashes de logs contra el [recibo final](evidencias/total-marca-tienda/puerta-final.json). Los logs y reportes originales permanecen en `.cache/ci-limpia-Qq2b7X/checkout/cooper/.cache/puerta/`; la salida del arnés está en `cooper/.cache/total-marca-tienda-puerta-2.log`. Son rutas locales dentro del worktree, no archivos públicos versionados.

Secuencia obligatoria ejecutada por el arnés, con preparación aislada después de la instalación:

```bash
cd cooper
npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
cd ..
node --test tests/flujos_v2.test.cjs
```

Las E2E nuevas comprueban alta optativa, conservación al editar/recargar, URL de sección, aislamiento Ana/Luis, cambio a una marca de moda sin plantilla, cinco propuestas sin programación, métricas separadas y catálogo desconectado. La matriz de 390/1440 px en ambos temas comprueba axe, ausencia de desbordamiento, errores de página e incidencias CDP, y produce cuatro capturas. Las cuatro se inspeccionaron visualmente: textos y cifras legibles, ejemplos identificados y sin solapamientos. [Manifiesto con dimensiones, rutas y hashes](evidencias/total-marca-tienda/revision-visual.json). No representa una prueba en teléfono físico ni una certificación universal de accesibilidad.

## Limitaciones reales

- Es una plantilla para preparar una tienda futura: no crea una tienda web, importa productos ni procesa pedidos o pagos.
- El calendario orientativo no se convierte automáticamente en piezas. No hay datos de audiencia para afirmar que sus horarios sean óptimos.
- Las conversiones reales no se capturan ni almacenan todavía. El ejemplo no entra en Publicados, Aprendizaje ni en el contexto de ventas del especialista. Moneda, devoluciones, fuente, periodo y atribución deberán acordarse al implementar la conexión.
- Las pruebas usan proveedores ficticios. Comprueban contratos, permisos y recorrido; no miden la calidad de un modelo real ni confirman accesos sociales o datos comerciales.
- El catálogo permanece deliberadamente sin plataforma, dirección ni credenciales. Su implementación requiere revisar la documentación oficial del proveedor que se elija.

## Pendientes de Walter

1. Definir nombre definitivo, público, estilo, logo y fotografías autorizadas.
2. Confirmar productos, tallas, materiales, cuidados, precios, moneda, stock, envíos y cambios.
3. Elegir plataforma web y dominio; aprobar por separado la futura conexión de lectura.
4. Acordar la fuente y atribución de conversiones, periodos, tratamiento de devoluciones y consentimiento de medición.
5. Revisar calendario y promociones; aportar permisos y testimonios originales para UGC y definir las cuentas de publicación.
6. Revisar la plantilla con Claude antes de integrar; la activación y el primer ensayo real requieren una misión autorizada aparte.

## Referencias técnicas consultadas

Se consultaron las guías instaladas de Next.js y las referencias oficiales actuales de [Client Components](https://nextjs.org/docs/app/api-reference/directives/use-client), [CSS](https://nextjs.org/docs/app/getting-started/css), [esquemas Zod](https://zod.dev/api), [aserciones Playwright](https://playwright.dev/docs/test-assertions), [pruebas API](https://playwright.dev/docs/api-testing) y [accesibilidad](https://playwright.dev/docs/accessibility-testing). Se reutilizan las rutas internas de Marcas; esta misión no incorpora una API externa nueva.
