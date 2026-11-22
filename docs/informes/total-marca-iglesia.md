# total-marca-iglesia — preparación editorial y revisión doctrinal

Fecha: 21-11-2026, Lima. Rama/worktree propios: `total-marca-iglesia`, base `deb1f2a` de `total-integrador`. Implementación local; sin integración, push ni despliegue. No se modificaron bases reales, VPS, n8n vivo ni D&S Factory; no hubo OAuth, pagos ni publicaciones externas.

## Commits

| Commit | Cambio |
| --- | --- |
| `aacbdaa` | Perfil reformado, plantillas y calendario, especialista, persistencia/guardias de revisión doctrinal y pruebas de contratos. |
| `341c24e` | Preparación desde Marcas, formulario de plantillas, calendario accionable, revisión pastoral, accesibilidad y recorrido E2E. |
| `7373489` | Selectores por rol accesible para textareas con contenido y capturas del escenario de iglesia. |
| `370506d` | Declaración de escrituras de iglesia en las exclusiones de lectura de Sentinel y prueba de su contrato. |

## Implementado

- Walter puede preparar **Iglesia (por confirmar)** desde Marcas. Acción autenticada y administrativa, idempotente; la segunda ejecución conserva las ediciones. El dueño es el administrador autenticado, sin correos personales fijados en código. No hay altas en lecturas GET, cuentas ficticias, conexiones ni piezas programadas por defecto.
- Especialista con autoridad de la Escritura, doctrina reformada y referencias subordinadas de Westminster/Heidelberg; tono reverente y pastoral, sin sensacionalismo. Distingue cita bíblica, cita confesional y explicación propia. No presume afiliación, traducción bíblica, eventos ni permisos. La versión inicial es **Por confirmar**, sin corpus precargado.
- Calendario propuesto: lunes 08:00 versículo, miércoles 19:00 devocional, viernes 18:00 anuncios, domingo 19:00 reel, en Lima. Cada plantilla rellena el editor y su siguiente fecha semanal, con al menos diez minutos de margen; se muestra convertida a la hora del dispositivo. No existe recurrencia automática.
- Plantillas sobre el compositor existente: imagen de versículo, carrusel devocional, historia de anuncios y reel con fragmento autorizado. Todas muestran **EJEMPLO** y marcadores pendientes. Seleccionar no guarda ni publica; el usuario conserva el botón Guardar borrador. Para retirar la marca de ejemplo debe sustituir los datos y confirmarlo. El servidor también rechaza los marcadores aunque se falsee el indicador.
- Flujo: borrador → vista previa → revisión doctrinal → aprobación humana de Walter → programación. La revisión guarda responsable pastoral, observaciones/fuentes, seis controles, usuario, fecha, revisión exacta y huella de la guía. Registrar revisión no equivale a aprobar. El especialista no recibe herramientas para ninguna de esas decisiones.
- Puerta común para web/API, WhatsApp y trabajador: sin revisión completa y vigente no se publica; se revalida la actividad/rol del revisor. Editar o pedir cambios retira la evidencia. Cambiar la guía requiere una nueva revisión. Cambiar rubro o enviar un booleano falso no elimina la obligación de una pieza de iglesia.
- Migración aditiva `0019_revision_doctrinal`: columna nullable propia, independiente del checkpoint de la red, y protección de las piezas de iglesia heredadas. Las catorce migraciones anteriores permanecen intactas; no se aplicó a producción.

## Pruebas y evidencia

**Puerta final PASS**, código exacto `370506d1f1f34a99fca455d4d7254d9717700091`, archivo limpio; 21-11-2026, **18:08–18:26 Lima**. **492 unitarias, 104 E2E y 235 flujos**, cero errores, advertencias, omisiones o reintentos. Todos los comandos terminaron con rc 0. [Recibo original del arnés](evidencias/total-marca-iglesia/puerta.json), con procedencia, versiones y SHA-256 de cada log.

| Paso | Resultado |
| --- | --- |
| `npm ci` | PASS, 0 advertencias |
| Preparación aislada de navegadores y Sentinel | PASS, 0 advertencias |
| `npm run lint` | PASS, 0 errores/0 advertencias |
| `npm run typecheck` | PASS, 0 advertencias |
| `npm test` | 492/492 PASS |
| `npm run test:e2e` | 104/104 PASS, Chromium/Firefox/WebKit y Sentinel |
| `npm run build` | PASS, 0 advertencias |
| `node --test tests/flujos_v2.test.cjs` desde la raíz | 235/235 PASS |

El preparador del host rechazó su plataforma; se utilizó `npm run ci:limpia` con el contenedor Debian 12 existente, sin relajar comprobaciones. Logs y reportes originales en `.cache/ci-limpia-Z1ikum/checkout/cooper/.cache/puerta/`; log exterior en `cooper/.cache/puerta-total-marca-iglesia-final.log`. Node 24.22.3 y npm 12.2.2. El commit posterior de cierre solo añade este informe, los recibos y la actualización de `docs/ESTADO.md`; no cambia el código probado.

Pruebas focales previas: **46/46 PASS**, lint **0 errores/0 advertencias**, TypeScript **PASS**. La revisión encontró y corrigió el intento de aprobar marcadores con `ejemplo: false`; sus dos pruebas inicialmente rojas quedaron verdes. La navegación tras preparar la iglesia usa el ID recién preparado, incluso si antes había otra marca seleccionada.

El primer ensayo limpio sobre `341c24e` pasó 492 unitarias y encontró un fallo de selector E2E: `getByLabel` exacto no localizaba el textarea después de cargar contenido, aunque el nombre accesible del textbox era correcto. Se corrigió a `getByRole`, como en el recorrido Marcas existente. Se detuvo únicamente su contenedor de ensayo tras comprobar su montaje; no constituye una puerta aprobada. Diagnóstico conservado en `.cache/ci-limpia-1ctE3r/checkout/cooper/` y `cooper/.cache/puerta-total-marca-iglesia.log`. Las nuevas acciones persistentes se excluyen del caos de solo lectura y se comprueban por el recorrido E2E autorizado; guardián y fuentes de Sentinel permanecen intactos.

Cobertura añadida: idempotencia/privacidad, validación de las cuatro plantillas y límites del compositor, calendario semanal/medianoche/año/margen y zona del dispositivo, contexto del especialista con proveedor falso y corpus de la versión correcta, lista doctrinal incompleta/duplicada, permisos, versión pendiente, revisión obsoleta, invalidación, cambio de guía/rubro, ejemplos y trabajador sin publicación autorizada, migración con datos heredados. E2E recorre preparación, ejemplos, edición, revisión pastoral, aprobación e invalidación; incluye axe y anchos 390/1440. El recorrido Marcas mantiene su matriz de dos temas y seis anchuras.

Contrato de Sentinel adicional: `tests/test_sentinel_exclusiones.py`, **3/3 PASS**, rc 0, sin advertencias, en contenedor propio con red externa deshabilitada. Prueba clicks/horda de lectura sin mutaciones y rechazo visible de escrituras que eludan la interfaz; conserva las huellas del guardián original. Log: `cooper/.cache/iglesia-contrato-sentinel.log`. [Recibo adicional y huellas de capturas](evidencias/total-marca-iglesia/verificacion-adicional.json).

Revisión visual de las capturas de Iglesia a 390/1440 px: calendario, identidad provisional, responsable pastoral, observaciones, seis comprobaciones y acciones completos, sin solapamientos detectados. Las capturas quedan en `.cache/capturas-iglesia/` del checkout de la puerta; la matriz general de Marcas se conserva en `.cache/capturas-marcas/`. No equivale a aceptación en teléfono físico o certificación universal de accesibilidad.

## Fuentes consultadas

- [Confesión de Westminster, OPC](https://opc.org/wcf.html): capítulos 1, 8 y 11 como referencias institucionales; no se precargaron citas ni se atribuyó esa afiliación a la iglesia.
- [Catecismo de Heidelberg, RCA](https://www.rca.org/about/theology/creeds-and-confessions/the-heidelberg-catechism/): preguntas 1–2, 21 y 60; la edición española y adopción local requieren confirmación.
- [React, formularios controlados](https://react.dev/reference/react-dom/components/input), [Next.js, componentes de servidor/cliente](https://nextjs.org/docs/app/getting-started/server-and-client-components) y guía oficial instalada de Next.js 16.4.6; [Playwright, localizadores](https://playwright.dev/docs/locators). Se reutilizan rutas, adaptadores y permisos existentes; no se incorporan APIs externas ni dependencias.

## Limitaciones reales

- Es una entrega de código preparada para integrar. La marca se crea cuando Walter usa la acción en una instalación que incluya estos commits; esta misión no escribió en su base real.
- Walter registra la atestación del responsable pastoral. No se añadió un rol pastoral independiente ni una firma/autenticación del pastor, y los controles no certifican automáticamente la doctrina o la veracidad del texto.
- La detección de ejemplos reconoce el indicador y los marcadores editoriales de las plantillas; no sustituye la revisión humana de contenido o medios. Los nombres/horarios y materiales reales no se inventan.
- Sin corpus bíblico, cuentas, activos, sermones ni permisos reales; sin ensayo de modelo real o publicación en redes. Pruebas con datos y proveedores ficticios, no aceptación pastoral ni de producción.
- Piezas heredadas ya programadas que carezcan de revisión vigente quedan frenadas al ser atendidas por el trabajador y requieren revisión operativa; no se autoriza retroactivamente su publicación.

## Pendientes de Walter

1. Confirmar nombre oficial, responsable y autorización para representar a la iglesia.
2. Confirmar confesiones adoptadas, ediciones españolas, traducción bíblica y corpus cotejado.
3. Designar responsable pastoral y acordar cómo entrega a Walter la revisión de cada pieza.
4. Aprobar o ajustar los cuatro días/horarios propuestos y aportar actividades/contactos reales.
5. Aportar logo, cuentas, sermones y permisos de imagen/voz, incluidos los de personas que aparezcan.
6. Revisar los commits con el integrador; la integración/despliegue y cualquier conexión o primer ensayo real quedan fuera de esta misión.
