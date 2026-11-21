# Informe — Cooper fase 3: avatares y voces reales

20 de noviembre de 2026. Worktree: `/home/david/Proyectos/cooper-wt/cooper-fase3`. Rama exclusiva: `cooper-fase3`. Base: `e60ebf2`. Código verificado: `708d897`; el commit posterior de informe solo documenta la entrega. Sin push, merge, despliegue, OAuth, pagos, secretos leídos ni llamadas a n8n/D&S Factory.

## Commits

| Commit | Contenido |
| --- | --- |
| `20c0fe0` | Adaptadores reales/simulados, identidad y consentimiento, privacidad, UI, migración, contrato n8n, pruebas y guía de medios. |
| `708d897` | Controles de carga en español, foco accesible y capturas de identidad corregidas. |
| Commit de este informe | Evidencia y pendientes; sin cambios de ejecución. |

Los directorios `docs/diseno/` y `docs/misiones/` ya estaban sin seguimiento al comenzar. Se leyeron como instrucciones y se conservaron sin incorporarlos a los commits.

## Qué se implementó

- `ProveedorAvatar`: HeyGen v3 crea avatar desde foto, consulta entrenamiento, elimina y lista looks públicos con video de muestra; conserva el simulador. `ProveedorVoz`: HeyGen clonación instantánea, Gemini TTS con sus 30 voces predefinidas y ElevenLabs IVC como alternativa explícita, además del simulador. Selección por entorno, sin fallback silencioso, secretos solo en backend y transporte inyectable.
- `ProveedorTranscripcion`: Gemini Interactions procesa el audio real del chat; respuesta editable y etiquetada. El modo simulado conserva la frase fija únicamente cuando se selecciona expresamente ese modo. Se implementó el esquema **REST** `steps[].content[]`, distinto de los accesores del SDK.
- Frase aleatoria ligada al dueño/tipo, caducidad de 15 minutos y consumo atómico único; hasta tres fotos, grabación de audio o video para avatar, audio para clonación; consentimiento explícito con texto, versión y fecha. La primera foto crea el avatar; las otras ayudan a revisar identidad.
- En real, Walter revisa identidad, frase y material en Administración antes de cualquier entrenamiento. Se guardan revisor y fecha; rechazo impide entrenamiento. La comprobación es humana, no biométrica. Evidencia accesible solo en la revisión pendiente y nunca a miembros del equipo por compartir el activo.
- Estado persistente y actualización SSE con sondeo de 10 segundos mínimo; progreso por etapas, sin porcentajes ficticios. Recuperación de envío HeyGen con la misma clave idempotente dentro de su ventana; errores no revelan cuerpos del proveedor.
- Biblioteca privada del dueño, incluso respecto del administrador fuera de revisión; compartir/retirar, autorización de muestras y foto principal en cada descarga, proxy CDN sin URLs remotas al navegador. Borrado remoto antes de quitar referencias locales; un fallo retira acceso compartido y permite reintentar.
- Selección de avatar, voz y presencia por video: conserva campos anteriores y añade `datos.presentacion`, resuelto/autorizado por servidor. Documentado en [especificación](../cooper-especificacion.md). No modifica el generador ni la rama de fase 2.
- Diseño: conserva Manrope, grafito, marfil y celeste del estudio; frase legible a la izquierda, controles a la derecha y una columna en móvil. Vistas previas activadas por la persona; movimiento reducido y foco visibles. Sin dependencias nuevas.

Implementación y fuentes oficiales actuales: [MEDIOS.md](../../cooper/MEDIOS.md). Inventario utilizado: CLI/filesystem, documentación web oficial y Chromium local de Playwright. No se usaron conectores de cuentas, diseño ni generación pagada; no se verificó su autenticación.

## Puerta obligatoria

Ejecutada sobre `708d897`, con `pipefail` y sin omisiones:

```bash
cd cooper
npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
TMPDIR="$PWD/cooper/.cache" PYTHONDONTWRITEBYTECODE=1 node --test tests/flujos_v2.test.cjs
```

| Comando | Resultado | rc |
| --- | --- | --- |
| `npm ci` | 357 paquetes; 0 vulnerabilidades. | 0 |
| `npm run lint` | 0 errores, 0 advertencias. | 0 |
| `npm run typecheck` | TypeScript estricto. | 0 |
| `npm test` | 57/57; red bloqueada por defecto y transportes falsos explícitos. | 0 |
| `npm run test:e2e` | 10/10 Chromium sobre producción; incluye frase renovable, grabación, entrenamiento SSE, privacidad y selección por video. | 0 |
| `npm run build` | Next.js 16.4.6/Turbopack. | 0 |
| `node --test tests/flujos_v2.test.cjs` | 90/90; sin cambios en flujos. | 0 |

Estado de la última cadena: **PASS, rc 0; 0 errores y 0 advertencias**. Evidencia íntegra local reproducible: [puerta](../../cooper/.cache/fase3-puerta.log), [flujos](../../cooper/.cache/fase3-flujos.log). Node.js 24.22.3, npm 12.2.2, Playwright 1.65.1, Chromium 159.0.8154.6. Migración ensayada desde cero junto a las dos migraciones previas. Se corrigieron errores iniciales del separador SQL y se repitieron las comprobaciones; no se omiten pruebas.

Huellas SHA-256 de los logs finales: `fase3-puerta.log`: `6997c1a7a7674d8cdcd1a7b98e3d0e665c32c36d60a697b1ec4621823bea82fd`; `fase3-flujos.log`: `0d5cc43f5d9d407dda3c498932d64dbfd84ce6821628b334dda68747fd545779`.


Axe sin infracciones en los escenarios auditados, temas oscuro/claro y formulario de identidad. Sin desbordamiento a 360, 390, 768, 1024, 1440 y 1920 px. [Capturas de identidad](../../cooper/test-results/visual/identidad-390.png) y [escritorio](../../cooper/test-results/visual/identidad-1440.png); [reporte Playwright](../../cooper/playwright-report/index.html). Revisión visual de móvil/escritorio realizada; no equivale a certificación de accesibilidad.

Última medición Lighthouse móvil del inicio autenticado: 97 rendimiento / 100 accesibilidad / 100 buenas prácticas; LCP 2,6 s, TBT 10 ms, CLS 0, sin advertencias. La medición anterior dio 100/100/100 y LCP 0,8 s; se informa la última, sin escoger el resultado más favorable. [Resumen](../../cooper/.cache/auditoria/resumen.json), [HTML](../../cooper/.cache/auditoria/lighthouse.html). Medición local, no datos de campo. La instalación inicial de Chromium avisó de SO no soportado oficialmente y descargó el binario de Ubuntu 24.04; las ejecuciones posteriores usaron ese binario instalado. No se suprimieron advertencias del ejecutor.

## Limitaciones reales

1. No se ejecutaron APIs de pago ni se midió fidelidad facial/vocal, latencia real o aceptación de credenciales. Los contratos están probados con transporte simulado; queda el ensayo humano con proveedores. No se afirma que HeyGen clone mejor o peor que ElevenLabs.
2. Identidad revisada por Walter; no hay biometría ni prueba automática de vida. Una voz desconocida requiere comprobación adicional de la persona. No se usa Gemini para identificar rostros o asegurar identidad por transcripción.
3. La base todavía tiene «Avatar pendiente» en la fábrica. El contrato sale de Cooper, pero su consumo y render final exigen la integración de fase 2. Luz y Cooper siguen siendo ilustraciones animadas locales, no IDs de producción del proveedor; el catálogo realista sí usa looks públicos reales una vez configurado/cargado.
4. Los porcentajes de entrenamiento no existen en los contratos consultados. El sondeo se reanuda al abrir la aplicación; no hay trabajador de fondo. Un avatar nuevo puede no tener video de muestra hasta que el proveedor lo publique; no se presenta una foto como video generado.
5. ElevenLabs puede exigir verificación adicional. Su creación no tiene el mecanismo idempotente usado por HeyGen; respuesta perdida, proceso interrumpido o envío fuera de ventana requieren conciliación manual antes de repetir o borrar.
6. Originales y consentimiento se conservan en SQLite tras borrar un activo. Falta política de retención/purga, cifrado de almacenamiento y copias de producción. El administrador de la cuenta del proveedor puede tener acceso a lo enviado. Retirar compartir bloquea nuevos accesos/selecciones en Cooper, no revoca copias ya descargadas ni cancela encargos ya aceptados.
7. Catálogo público limitado a 200 looks por carga; caché de 15 minutos por proceso. CDN nuevos requieren validar y ampliar la lista explícita. Primeras muestras de voz consumen síntesis; los ensayos no lo hicieron.

## Pendientes de Walter

- Ejecutar la [prueba manual de ocho pasos](../../cooper/MEDIOS.md#prueba-manual-para-walter-no-ejecutada) en instancia aislada con consentimiento, credenciales y gasto decidido por él. Registrar calidad de HeyGen; optar por ElevenLabs solo tras comparar.
- Revisar identidades antes de entrenar; completar verificaciones adicionales del proveedor cuando correspondan. Conciliar solicitudes inciertas sin repetir creaciones ciegamente.
- Coordinar con la revisión de fase 2 el consumo de `presentacion`, los IDs de look y las rutas de voz clonada; elegir/aprobar recursos de producción para Luz y Cooper. No aceptar `proveedor: simulada` para un render real.
- Decidir retención/borrado de originales y consentimiento, acceso en cuentas de proveedores, y tratamiento de videos ya en cola cuando se retira compartir.
- Revisión independiente de estos commits; no se declara integración, despliegue ni validación en vivo.
