# Integración final de Cooper

20 de noviembre de 2026. Rama y worktree exclusivos: `cooper-integracion`, `/home/david/Proyectos/cooper-wt/cooper-integracion`. Base `d16221c` de `cooper-fase1`, incluida la pasada de diseño. Código final: `2877f1e`; el commit de este informe solo añade documentación y evidencia.

## Estado final

Integradas en el orden solicitado **`cooper-revision` (`d38acf4`) → `cooper-fase2` (`87139a7`) → `cooper-fase3` (`b1a4e9c`)**. Se conservaron el diseño de fase 1, las correcciones de seguridad de revisión, el puente firmado con gastos por dueño y los adaptadores de medios con revisión humana. Las tres puntas son ancestros del resultado.

La entrega es una **integración local comprobada**, no un despliegue ni una certificación de funcionamiento con proveedores reales. No hubo push, merge a `main`/`version-chatgpt`, despliegue, OAuth, pagos ni contacto con n8n vivo o D&S Factory. No se leyeron/copiaron valores de claves, tokens ni `.env` reales. Los únicos secretos utilizados por las pruebas fueron efímeros y ficticios. Se conservaron sin modificar ni versionar los directorios preexistentes `docs/diseno/` y `docs/misiones/`.

**Límite funcional relevante:** la fábrica todavía no renderiza la presentación seleccionada en Cooper. El contrato `datos.presentacion` se conserva, pero FX devuelve **422 antes del despacho** cuando contiene avatar o voz elegidos. Cooper explica que debe pedirse el video sin presentación personalizada. Esto evita producir silenciosamente un resultado diferente. Configurar claves no completa esa parte del montaje.

## Integración y commits

| Commit | Resultado |
| --- | --- |
| `535f498` | Merge de revisión: diseño/demo conservados, CSP con nonce, emisor E2E externo, permisos y transacciones. |
| `923fc72` | Merge de fase 2: puente, registro durable de órdenes, gastos y SSE; se conserva serialización y revalidación tras I/O. Puertos de pruebas libres para las dos aplicaciones y los dos emisores. |
| `ba3fdd1` | Merge de fase 3: biblioteca privada, identidad, adaptadores, controles y contrato de presentación. Migraciones de puente y medios en orden. |
| `fcfb44b` | Regresiones de revisión actualizadas al contrato completo, cuatro migraciones y reto obligatorio; sin quitar comprobaciones. |
| `64202b3` | Aislamiento demo de medios, transcripción, chat y gastos. |
| `8cad2e4` | Transacciones inmediatas de conciliación y callbacks del puente. |
| `3bccd96` | IDs públicos opacos, voces sin fotos y protección contra sondeos tardíos tras borrado. |
| `6de6006` | Rechazo explícito de presentaciones que el montaje no soporta; JSON regenerado. |
| `dd4b214` | Capturas finales, revisión de identidad ficticia en el emisor E2E y Lighthouse demo con puertos libres. |
| `250dc28` | Guías actualizadas, URL de ejemplo `/webhook/cooper/v1`, migraciones y límites reales. |
| `407ebb9` | Contraste estable durante la transición de página. |
| `9ee2852` | Trazado SVG constante y animación numérica de la boca; regresión de consola, habla y pausa con navegador en Lima. |
| `2877f1e` | Nombres accesibles derivados del contenido, axe A/AA 2.0–2.2 y rechazo de diagnósticos binarios fallidos en Lighthouse. |
| Commit de este informe | Evidencia final, limitaciones y procedimiento manual. |

Se resolvieron los conflictos por intención, sin elegir globalmente una rama. La autenticación de prueba no volvió a la aplicación; las descargas privadas y evidencias siguen autorizadas en servidor; el SSE conserva límite de conexiones/cola, reconexión, progreso durable y revalidación después de sincronizar fábrica y medios. La firma HMAC permanece sobre bytes exactos.

SQLite integrado: `0000_inicio`, `0001_presentadores`, `0002_puente`, `0003_medios_reales`. Se conserva el SQL de ambas ramas y se asigna una posición distinta a medios. Las pruebas cubren migración desde fase 1, repetición, competencia entre conexiones, rollback de SQL inválido y rechazo de diario manipulado. **Una base experimental de fase 3 que ya aplicó el antiguo `0002_medios_reales` requiere migración específica o base de ensayo nueva. No se debe renombrar/borrar su diario para forzar el arranque.**

## Auditoría cruzada final

Criterios: `docs/misiones/cooper-revision.md`: seguridad por recurso, privacidad de costos, robustez, concurrencia/migraciones, UX, axe y Lighthouse. No se confirmó ningún hallazgo crítico.

| Gravedad | ID | Hallazgo reproducido | Estado y evidencia |
| --- | --- | --- | --- |
| Alta | I01 | Demo podía usar los selectores reales de fase 3, o consultar n8n desde chat/administración, aunque la fábrica principal fuera simulada. Riesgo de envío de datos/uso externo durante una demostración. | **Corregido.** Selectores y consultas fuerzan simulación. `integracion-demo.test.ts` comprueba entorno real y ausencia de llamadas externas. |
| Media | I03 | Conciliación/callbacks de fase 2 usaban transacción diferida, reintroduciendo el fallo al pasar de lectura a escritura bajo bloqueo SQLite. | **Corregido.** `IMMEDIATE`; reproducción con otro escritor real en `integracion-puente.test.ts`. Los recibos y cambios de estado permanecen atómicos. |
| Media | I05 | FX aceptaba un video con avatar/voz elegidos pero descartaba `presentacion`; el montaje conserva «Avatar pendiente». | **Aceptación silenciosa corregida**, con rechazo 422 y prueba de nodos exportados en `tests/flujos_v2.test.cjs`. **Render de esa selección pendiente**, no declarado operativo. |
| Media | I06 | Los IDs públicos de catálogo incluían nombre de proveedor e identificador remoto, pese a la separación prometida por fase 3. | **Corregido.** IDs de presentador derivados opacos y nombres locales `voz-*`; resolución remota solo en servidor. `integracion-medios.test.ts`. |
| Media | I07 | La transición de ruta desde opacidad 0,6 bajaba temporalmente el contraste del texto claro a **4,32:1**; axe lo reprodujo en «Pedir video», 390 px. | **Corregido.** Desplazamiento de 2 px/200 ms sin atenuar texto, respetando pausa/movimiento reducido. Misma matriz de navegador repetida; [reproducción](evidencias/cooper-integracion/reproduccion-contraste.md). |
| Media | I09 | Las tarjetas de fábrica sobrescribían su texto visible con una etiqueta accesible incompleta. Las matrices previas omitían `wcag21a`/`wcag22a`. | **Corregido.** Nombre nativo a partir del contenido del botón y tags A/AA completos; axe reproduce antes y pasa después. Lighthouse comprueba también diagnósticos binarios que no afectan la puntuación. |
| Baja | I08 | La interpolación de la boca escribía `d="undefined"` en SVG durante cambios de estado, generando errores de consola; Lighthouse bajaba buenas prácticas a 96. | **Corregido.** Trazado fijo con escala numérica. E2E captura errores de consola/página y recorre reposo, habla y pausa en ambos temas. No se reprodujo error de hidratación al probar identidad con zona horaria `America/Lima`. |
| Baja | I02 | El alta de voz de fase 3 permitía fotos propias, contrario al contrato revisado de voces. Las fotos ajenas seguían rechazadas. | **Corregido.** Rechazo de `photoIds` no vacío para voz y esquema estricto; `integracion-medios.test.ts` y R01 con reto válido. |
| Baja | I04 | Un sondeo pendiente podía volver a mostrar «listo» después de fallar el borrado remoto, aunque el activo ya estaba deshabilitado. | **Corregido.** El borrado deja estado de error y el resultado tardío exige verificación vigente. La prueba reproduce la respuesta tardía; no se observó recuperación de permisos compartidos. |

Reproducciones previas: [demo/medios/SQLite](evidencias/cooper-integracion/reproduccion.log), [catálogo](evidencias/cooper-integracion/reproduccion-catalogo.log), [presentación descartada](evidencias/cooper-integracion/reproduccion-presentacion.log), [SVG en navegador](evidencias/cooper-integracion/reproduccion-hidratacion.log), [etiquetas axe](evidencias/cooper-integracion/reproduccion-etiquetas.log) y [diagnósticos Lighthouse](evidencias/cooper-integracion/reproduccion-lighthouse.json). Los archivos de prueba se separaron por área después de reproducir los fallos; los IDs I01–I06 se conservan.

Además se verificaron:

- Autorización de órdenes, aprobaciones, eliminación y consultas por dueño; costos solo para admin en API, HTML y SSE; chat administrativo limitado al espacio propio.
- HMAC inválido/vencido/futuro, cuerpo alterado/excesivo, orden desconocida, conflicto de dueño/canal, duplicados, reservas concurrentes, estado atrasado y recuperación por conciliación.
- Adjuntos con firmas de contenedor, privacidad de originales y muestras; reto de identidad con dueño, caducidad, uso único, consentimiento y aprobación humana antes del entrenamiento real. Rechazar no entrena; compartir/retirar reautoriza las descargas.
- Transportes HeyGen, Gemini y ElevenLabs con respuestas simuladas, timeout/errores sanitizados, estados pendientes y verificación adicional; ningún ensayo de calidad con personas o APIs pagas.
- Sesiones Auth.js cifradas; antigua ruta de ensayo sin acceso; CSP con nonce; límites de lectura/escritura y SSE; suspensión durante sincronización, reconexión tras 503, foco del menú y liberación de micrófono.

## Puerta obligatoria y evidencia final

Se ejecutó de principio a fin sobre `2877f1e`, sin omisiones, con `pipefail`:

```bash
cd cooper
npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz, con temporales aislados y sin bytecode Python:
cd ..
TMPDIR="$PWD/cooper/.cache" PYTHONDONTWRITEBYTECODE=1 node --test tests/flujos_v2.test.cjs
```

| Comprobación | Resultado | Código |
| --- | --- | --- |
| `npm ci` | 357 paquetes instalados, 364 auditados, 0 vulnerabilidades. | 0 |
| Lint | 0 errores y 0 advertencias (`--max-warnings 0`). | 0 |
| Typecheck | TypeScript estricto, sin errores. | 0 |
| Vitest | **111/111**, 14 archivos, sin omisiones. | 0 |
| Playwright | **21/21**, producción local, demo y habitual, sin omisiones; 72 capturas finales. | 0 |
| Build | Next.js 16.4.6, incluido receptor HMAC, sin ruta de autenticación de ensayo. | 0 |
| Flujos v2 | **106/106**, sin omisiones. | 0 |

**Toda la puerta terminó con 0 errores y 0 advertencias.** [Log de Cooper](evidencias/cooper-integracion/puerta-final.log) y [log de flujos](evidencias/cooper-integracion/flujos-final.log). Entorno: Node 24.22.3, npm 12.2.2, Next 16.4.6, Playwright 1.65.1/Chromium 159.0.8154.6, Vitest 4.1.12, axe 4.14.0, TypeScript 5.9.3 y Lighthouse 13.6.0. Chromium se copió de la caché local ya instalada, sin repetir su instalador ni ocultar avisos.

Se conservaron los intentos previos fallidos; ninguno se contabiliza como puerta aprobada. El primer intento encontró cuatro pruebas que usaban el contrato antiguo; después, la matriz de navegador reprodujo I07. Lighthouse encontró después I08/I09, reproducidos en navegador antes de corregirlos. Tras las correcciones se repitió **toda** la cadena, no solo las pruebas afectadas. Los registros finales corresponden a esa última ejecución. `git diff --check` pasa y una regeneración adicional de los **26 workflows** conserva sus hashes.

Las copias versionadas de logs solo normalizan códigos ANSI y espacios finales; los originales se conservan.

[Manifiesto SHA-256](evidencias/cooper-integracion/SHA256SUMS.txt) y [manifiesto versionado de capturas](evidencias/cooper-integracion/capturas-manifiesto.json). Logs originales e intentos previos quedan en `cooper/.cache/integracion/`; informe Playwright en `cooper/playwright-report/index.html`.

## Capturas finales y revisión visual

[Directorio solicitado](../../cooper/.cache/capturas-final/) y [manifiesto](../../cooper/.cache/capturas-final/manifest.json): **72 PNG de página completa**, con `COOPER_DEMO=1`, **1440 y 390 px**, temas oscuro y claro. Cada captura pasa overflow y axe WCAG 2/2.1/2.2 A/AA, con todos los tags A y AA incluidos. El navegador demo usa zona horaria `America/Lima`. La matriz general también recorre 360, 390, 768 y 1440 px; hay comprobaciones adicionales a 1024/1920, teclado y movimiento reducido.

Las 18 vistas por combinación son: inicio/chat, fábrica, canales, videos, detalle en montaje, aprobación de guion, aprobación final, publicado, pedir video, avatares, voces, crear avatar, crear voz, perfil, administración, entrada, entrada con error y no encontrado. Administración incluye una revisión de voz **ficticia**, creada únicamente por el emisor local de pruebas; no hay identidad personal en las capturas. Las variantes claras de entrada/no encontrado aplican tokens para inspección y no implican un selector público de tema.

Se revisaron las cuatro hojas de contacto y muestras a tamaño legible de móvil/escritorio, incluidas identidad y administración. Evidencia seleccionada versionada: [inicio escritorio](evidencias/cooper-integracion/inicio-oscuro-1440.png), [fábrica móvil](evidencias/cooper-integracion/fabrica-oscuro-390.png), [administración móvil](evidencias/cooper-integracion/admin-claro-390.png) y [crear avatar](evidencias/cooper-integracion/crear-avatar-oscuro-1440.png). No se detectaron recortes, solapamientos ni desbordamiento horizontal en las imágenes revisadas. Las capturas no prueban por sí mismas comportamiento ni conformidad universal WCAG. Las pruebas usan Chromium local y micrófono simulado; faltan Safari/iOS, Firefox, dispositivos y tecnologías de asistencia reales.

Lighthouse final (`node scripts/auditoria.mjs`), código **0**: **32 mediciones** — ocho rutas, dos tamaños y dos temas — sobre el mismo build de producción y con `COOPER_DEMO=1`. Rendimiento **97–100**, accesibilidad **100**, buenas prácticas **100**; **0 advertencias y 0 diagnósticos binarios fallidos**. LCP máximo **2,654 s** (inicio oscuro móvil), TBT máximo **72,5 ms**, CLS máximo **0,0099**. El LCP de ese caso aún supera el objetivo orientativo de 2,5 s: queda como mejora de rendimiento, no como error de la puerta. Son mediciones locales de laboratorio, sin datos de campo. Entrada conserva su tema público oscuro en Lighthouse.

[Resumen de las 32 mediciones](evidencias/cooper-integracion/lighthouse-final.json), [log final](evidencias/cooper-integracion/lighthouse-final.log) e [informes HTML locales](../../cooper/.cache/auditoria/).

## Qué queda simulado o sin validar

- Chat determinista, no conversación con un LLM. En demo todo medio, transcripción, producción, tendencias y gasto es simulado. En modo n8n el chat consulta el estado/radar guardados y envía órdenes al puente.
- Vista previa del video en Cooper: maqueta ilustrada, no reproducción del render final. Luz/Cooper son ilustraciones locales; sin IDs de producción aprobados.
- Adaptadores reales de avatar, clonación, catálogo y transcripción implementados, pero probados con transporte ficticio. No se validaron credenciales, calidad facial/vocal, latencia ni cargo de proveedores. La identidad es revisión humana, sin biometría ni prueba automática de vida.
- Montaje con avatar/voz seleccionados: pendiente técnico; el rechazo 422 impide que se pierda la selección. Sin selección, la fábrica mantiene sus rutas previas; tampoco se ejecutaron en n8n durante esta misión.
- OAuth Google y grafo dentro de n8n no ensayados en vivo. Los gastos remotos son estimaciones por paso, no facturas conciliadas. Las creaciones/muestras de fase 3 no añaden contabilidad a `fab_costos`; Walter necesita conciliar también esos cargos externos.
- WhatsApp solo conserva el número y avisos dentro de Cooper; no envía plantillas ni mensajes externos. VPS, HTTPS/proxy, copias, retención, antivirus y purga de originales siguen pendientes. No hay trabajador de medios si nadie abre la aplicación.
- Rate limit y mutex por proceso; SQLite persistente de una instancia. No se garantiza coordinación de réplicas con discos independientes. Reserva remota sin confirmar exige conciliación manual; no borrar idempotencia ni repetir a ciegas. Borrado lógico en n8n no elimina publicaciones externas.

## Pendientes de Walter

Pasos manuales exactos, **no ejecutados por Codex**. Primero una instancia de ensayo aislada; no usar D&S Factory. Las claves se introducen fuera de Git y nunca se incluyen en informes, capturas o registros.

1. **Elegir destino y datos.** Fijar el dominio/origen HTTPS de Cooper y n8n, el correo único de Walter y el mapa histórico `canal_id → dueno_email`. Revisar retención de grabaciones/fotos/consentimiento y respaldos. Usar una base nueva para ensayos descartables; respaldar cualquier base existente y comprobar su diario antes de migrar.
2. **Configurar Google para entrada.** En un proyecto de Google Cloud del equipo, preparar la pantalla de consentimiento y un cliente OAuth de tipo aplicación web. Registrar el origen elegido y exactamente `https://DOMINIO_COOPER/api/auth/callback/google`; para ensayo local, `http://localhost:3000/api/auth/callback/google`. Añadir las cuentas de ensayo si la aplicación está en modo Testing. No confundir este cliente de entrada con el OAuth de canales de YouTube.
3. **Configurar Cooper fuera de Git.** Desde `.env.example`, introducir `AUTH_SECRET` aleatorio, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`, `COOPER_ADMIN_EMAIL`, `COOPER_DATABASE_PATH`. Activar `AUTH_TRUST_HOST=true` únicamente tras un proxy controlado. Mantener `COOPER_DEMO=0`, `COOPER_FABRICA=simulada` y los cuatro selectores de medios en `simulada` para la primera validación de acceso. No configurar las antiguas variables `COOPER_TEST_*` ni iniciar el emisor E2E en despliegue.
4. **Preparar y abrir la web de ensayo.** Con el volumen persistente correcto: `cd cooper && npm ci && npm run db:migrate && npm run build && npm start`. Walter entra por Google y añade los correos permitidos desde Administración, hasta diez cuentas. Confirmar acceso permitido/rechazado, suspensión, aislamiento de dos cuentas y ausencia de gastos en la cuenta normal. La aplicación debe quedar detrás de HTTPS y el proxy debe permitir SSE sin buffering; el empaquetado VPS pertenece a fase 5.
5. **Respaldar y preparar n8n de ensayo.** Con Claude, detener nuevas órdenes/cron y revisar ejecuciones/formularios abiertos. Exportar workflows/tablas y respaldar Cooper. Comparar nombres/IDs de Data Tables con `T` del generador. Aplicar exactamente columnas/tipos de [cooper-migracion-tablas.json](../../contratos/cooper-migracion-tablas.json), mediante Data Tables, sin SQL sobre la base interna de n8n.
6. **Completar dueños y datos históricos.** Seguir los pasos 4–6 de [la guía del puente](../cooper-puente-n8n.md): `fab_canales.dueno_email`, dueño de videos/trabajos/costos, marcas de eliminación, guion/fecha/evento de Cooper e ID único de cada costo. Resolver huérfanos y contradicciones; no asignar recursos de otras personas al administrador para eludir validaciones. Revisar guion/final pendientes con su contexto guardado.
7. **Configurar el puente.** Generar dos secretos distintos de al menos 32 caracteres: `COOPER_N8N_TOKEN` y `COOPER_WEBHOOK_SECRET`, iguales en ambos servicios. Configurar el mismo `COOPER_ADMIN_EMAIL`; en Cooper, `COOPER_N8N_URL=https://DOMINIO_N8N/webhook/cooper/v1`; en n8n, `COOPER_WEBHOOK_URL=https://DOMINIO_COOPER/api/n8n/webhook`. Mantener relojes sincronizados. No registrar Authorization ni cuerpos con claves.
8. **Preparar runner e importar.** Permitir `crypto` (`NODE_FUNCTION_ALLOW_BUILTIN=crypto`) y acceso controlado a las variables (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false` y allowlist/entorno del runner instalado). Solo operadores de confianza editan workflows. Regenerar con `python3 tools/generar_flujos_v2.py`, importar primero `FabCooperAPI0001`, `FabCooperProgr01`, `FabCooperCosto01` y luego los otros 23 workflows del lote, conservando sus IDs. Revisar asociaciones de credenciales existentes; conservar las opciones de gasto apagadas. Los 26 JSON se entregan inactivos.
9. **Resolver aprobaciones antiguas y publicar en ensayo.** Drenar/anular controladamente formularios antiguos de guion/final, recrear las decisiones pendientes con el nuevo flujo y conservar aprobación del operador para canal/storyboard/gasto. Publicar FX y dependientes en la copia de ensayo; entonces seleccionar `COOPER_FABRICA=n8n` y reiniciar Cooper.
10. **Validar el puente con dos cuentas.** Probar creación sin presentador, consulta, callback HMAC, firma inválida, duplicado, dueño ajeno, ambas aprobaciones, programación, eliminación en reposo y gastos solo admin. Verificar error recuperable 422 al seleccionar avatar/voz; no presentarlo como render completado. Ensayar reserva sin confirmación y recuperación sin duplicar; registrar evidencia sin secretos.
11. **Habilitar medios de ensayo cuando Walter autorice su consumo.** Introducir `HEYGEN_API_KEY`, `GEMINI_API_KEY` y, solo si se compara la alternativa, `ELEVENLABS_API_KEY`. Seleccionar `COOPER_AVATAR=heygen`, `COOPER_VOZ_CLONADA=heygen` (o `elevenlabs` explícito), `COOPER_VOZ_CATALOGO=gemini`, `COOPER_TRANSCRIPCION=gemini`. Confirmar acceso a `COOPER_GEMINI_TTS_MODEL=gemini-3.8-flash-tts` y `COOPER_GEMINI_TRANSCRIPCION_MODEL=gemini-4-hydrogen`; alinear el modelo de voz con Ajustes. Reiniciar y seguir los [ocho pasos de MEDIOS.md](../../cooper/MEDIOS.md#prueba-manual-para-walter-no-ejecutada) con titular adulto voluntario, revisión humana y presupuesto decidido por Walter. Completar verificaciones adicionales del proveedor, comprobar borrado y registrar calidad/cargos sin subir material personal al repo. El paso de video final queda bloqueado por el siguiente pendiente técnico.
12. **Encargar el consumo de presentación.** Persistir/propagar `presentacion` a storyboard, planos y sonido; implementar render HeyGen por look y síntesis de voces elegidas, revisar revocación en cola y contabilidad de medios. Elegir recursos aprobados para Luz/Cooper. Solo después de implementar, probar y revisar esto puede retirarse el rechazo 422; no se arregla modificando una variable.
13. **Paso a vivo, únicamente después de revisión de Claude y decisión de Walter.** Repetir respaldo, aplicar el mismo lote ya ensayado y publicar únicamente workflows aprobados. Validar primero estado por dueño y administración, luego habilitar cada proveedor/cron según el presupuesto decidido. Planificar WhatsApp y VPS en sus fases. Si falla: cerrar nuevas órdenes, desactivar FX/cron nuevos, preservar recibos y reservas, restaurar workflows respaldados; cambiar a simulación no cancela trabajo remoto ya aceptado.

## Fuentes oficiales y herramientas

Consultadas durante esta integración: [Next.js CSP](https://nextjs.org/docs/app/guides/content-security-policy) y guía local de Next 16.4.6; [Playwright Auth](https://playwright.dev/docs/auth); [Motion: animación y keyframes](https://motion.dev/docs/react-animation); [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect); [n8n Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) y [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/); [SQLite Transactions](https://www.sqlite.org/lang_transaction.html); [Node Crypto](https://nodejs.org/api/crypto.html); [HeyGen Photo Avatar](https://developers.heygen.com/docs/avatar-from-photo), [clonación](https://developers.heygen.com/reference/create-or-retrain-an-audio-voice), [estado de voz](https://developers.heygen.com/reference/get-an-audio-voice) y [síntesis](https://developers.heygen.com/reference/generate-model-speech); [Gemini Interactions REST](https://aistudio.google.com/api-reference/interactions-api) y [TTS](https://aistudio.google.com/docs/speech-generation); [ElevenLabs IVC](https://elevenlabs.io/docs/api-reference/voices/ivc/create). No se inventaron endpoints ni se llamaron proveedores de pago.

Herramientas utilizadas: Git/CLI/filesystem, Vitest, Chromium/Playwright/axe, Lighthouse, documentación web oficial y visualización local de PNG. Se inventariaron conectores disponibles; no se enviaron datos del proyecto a servicios conectados ni se comprobó su autenticación. No se delegó a otros agentes.
