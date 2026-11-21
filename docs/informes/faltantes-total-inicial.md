# Cooper total — auditoría de faltantes

21-11-2026, 10:15 Lima. Base `de397f3`, rama `cooper-total`. Auditoría inicial realizada dentro de los primeros 40 minutos; las comprobaciones de cierre se añadirán en `cooper-total.md`. Se revisaron las especificaciones, guías, todos los informes mediante reparto del equipo, código/contratos/generador y VPS por SSH de solo lectura. No se inspeccionaron valores de credenciales ni archivos de entorno privados.

**A**: cierre técnico autorizado a Codex. **B**: decisión, cuenta, autorización, insumo o aceptación que necesita Walter. Una prueba simulada anterior no acredita producción. Los números de línea corresponden a la base auditada; los cambios posteriores pueden desplazarlos.

## Estado real observado

VPS: cuatro contenedores saludables, Docker y timer de copia activos/habilitados. Cooper ejecuta imagen `localhost/cooper:05d833787525fa98b183b3934ef13bd5dff1ca76`, con ocho migraciones; la base integrada ya tiene once. n8n conserva 34 workflows (cuatro heredados), 22 publicados, nueve Data Tables, dos ejecuciones históricas `waiting`, ninguna `running`. Hay una conexión YouTube marcada `conectado`, dos videos marcados `publicado` y cuatro recibos de publicación; aún no se ha comprobado vigencia del permiso ni recogida de métricas. No hay trabajos `aprender`. Los contadores se consultaron sin leer tokens, contenidos de videos ni datos de credenciales.

El Ajuste vivo tiene `allowAnalytics`, `allowRadar` y `allowVidiq` verdaderos, igual que varios servicios con gasto; sus entradas están pausadas. Conserva el dominio ngrok, sin el dominio del VPS. **No basta con importar los JSON apagados ni reabrir los diez disparadores.** El archivo de configuración efectivo y las referencias deben preservarse y los cambios de origen/seguridad deben quedar identificados.

## Faltantes y destino

| Clase | Faltante comprobado y evidencia | Frente / prueba de cierre |
| --- | --- | --- |
| A | VPS anterior a integración 3, sin memoria/cobertura/marcas: `docs/ESTADO.md:19`, `docs/informes/cooper-integracion3.md:111`; imagen y ocho migraciones verificadas por SSH. | despliegue: imagen del commit final, migraciones conservando datos, salud HTTPS, reversa ensayada. |
| A/B | Login solo validado por redirección; pantallas privadas, SSE y adjuntos no aceptados con Google real: `docs/informes/cooper-vps-real.md:216`. | A: pruebas privadas aisladas y entrada viva; B: sesión Google de Walter, sin iniciar OAuth ni fabricar una sesión administrativa. |
| A | Lote de 32 workflows y columnas aditivas sin aplicar: `docs/ESTADO.md:27`, `docs/cooper-cobertura-despliegue.md:18`. | n8n-lote: export real privado, mapa de IDs/credenciales/tablas, diff, importación y rollback comprobado. |
| A | Base/retorno vivos todavía ngrok; valores de referencia en `tools/generar_flujos_v2.py:128`, `:322`, `:378`. | n8n-lote: sustituir únicamente orígenes aprobados, preservar ajustes restantes y verificar callbacks. |
| A/B | Diez entradas pausadas y dos esperas históricas, con servicios pagos habilitados: `docs/informes/cooper-vps-real.md:101`, `:229`; estado confirmado por SQL de solo lectura. | A: evaluar y reabrir solo lecturas/alertas sin gasto; B: decisiones históricas, OAuth y producción audiovisual/publicación. |
| A | Aprender solo avisa; guion no exige lectura de lecciones: `tools/generar_flujos_v2.py:597`, `:843`. | aprendizaje: persistencia por canal y lectura obligatoria antes del próximo guion, con pruebas de contrato. |
| A | Análisis días 2/7, sin hitos 24h/72h/7d recuperables ni seguidores ganados: `tools/cooper/observabilidad_flujos.py:64`, `:81`. | aprendizaje: hitos idempotentes y métricas ausentes explícitas. |
| A | Payload de análisis omite guion/planos/título/miniatura; estado `listo` no entra en proyección que exige `ok`: `tools/generar_flujos_v2.py:1804`, `:452`, `tools/cooper/observabilidad.js:18`. | aprendizaje: causa como hipótesis sustentada, origen/métrica/corrección visibles, compatibilidad histórica. |
| A/B | Analytics implementado, pero workflow pausado y permiso solo marcado conectado: `docs/informes/auditoria-aprendizaje.md:6`, `docs/informes/cooper-pulido.md:91`. | A: lectura real sin publicar ni pagar; B: permiso vencido/scopes ausentes, datos todavía inexistentes y renovación Google. |
| A | Radar depende de vidIQ y no exige 3–5 competidores antes de cada idea: `tools/generar_flujos_v2.py:604`, `:654`, `:2750`, `skill/FABRICA.md:59`. | competencia: alternativa gratuita con evidencia de búsqueda, renovación y consumo obligatorio. |
| A | Sin verificación específica de homónimos ni regla Perú; web solo ideas/sonidos: `cooper/src/componentes/operacion.tsx:415`, `docs/informes/auditoria-aprendizaje.md:11`. | competencia: perfiles, outliers verificables, homónimos y diferenciación por marca/canal. |
| A/B | Credencial vidIQ referenciada existe, acceso/cuota no comprobados. | A: fuente gratuita; B: acceso externo o saldo si la alternativa no aporta evidencia suficiente. No inventar cifras. |
| A | Chat VPS básico sin acceso a la PC; URLs limitadas a loopback: `docs/informes/cooper-vps-real.md:221`, `cooper/src/servicios/chat/locales.ts:251`, `deploy/compose.yaml:56`. | chat-vps: túnel SSH con sockets privados, autenticación en cada extremo, prueba real y recuperación ante PC caída. |
| A | Brevedad ya pedida pero no tan estricta como esta misión: `cooper/src/servicios/chat.ts:286`. | chat-vps: una frase corta por defecto; evaluación real acotada con datos ficticios. |
| A/B | Memoria probada con proveedores ficticios; chat CLI no analiza imágenes/PDF, transcripción real es API: `docs/informes/cooper-chat-planes.md:108`, `cooper/README.md:162`. | A: comprobar conversación/memoria textual con plan; B: multimodal, ensayo pago, consentimiento y retención. |
| A | Copia automática solo dentro del VPS: `docs/informes/cooper-vps-real.md:232`, `deploy/operar.py:203`. | operacion: réplica cifrada a PC sin coste, restauración fuera VPS y promoción solo tras verificar. |
| A | Sin monitor Telegram remoto ni recuperación explícita del stack tras parada fallida: `docs/informes/cooper-fase5.md:78`, `deploy/operar.py:234`. | operacion: monitor HMAC con credencial Telegram existente, dedupe/reintento, systemd y marcador de mantenimiento. |
| B | PC apagada no puede recibir copias ni prestar su sesión; host/Internet caídos no pueden avisar por sí mismos. | Documentar límites y custodia offline; proveedor siempre disponible requeriría cuenta/decisión. |
| B | WhatsApp: App Secret, pago/negocio, plantillas y pruebas de recepción pendientes: `docs/informes/cooper-whatsapp-alta.md:34`, `:49`, `:60`, `docs/informes/cooper-vps-real.md:225`. | Mantener mensajería pausada; preparar plantilla con dominio real; Walter resuelve alta y aprobaciones. |
| B | Medios/avatares/voces reales sin ensayo pago; referencias HeyGen/ElevenLabs no asociadas: `docs/informes/cooper-fase3.md:58`, `cooper/README.md:100`. | Walter aprueba recursos, identidad y ensayo con presupuesto; conservar simulación explícita. |
| A/B | Marcas disponible en simulación; trabajadores no activados y cuentas/permisos/plantillas/corpus pastoral pendientes: `docs/ESTADO.md:18`, `docs/cooper-cobertura-despliegue.md:24`. | A: instalar trabajadores inactivos y validar contratos; B: activos/cuentas/criterio editorial y primera publicación humana. |
| A/B | Clave API anterior de n8n pendiente de revocar: `docs/informes/cooper-consolidar.md:122`. | A si metadata identifica inequívocamente una clave retirada y sin consumidores; B si no puede distinguirse sin romper integraciones. No leer su valor. |
| B | Retención/purga de adjuntos, consentimiento, antivirus y recursos de moderación no definidos: `docs/informes/cooper-revision.md:116`, `cooper/README.md:110`. | Decisión de tratamiento y retención; no borrar datos ni declarar análisis antivirus inexistente. |
| B | Aceptación en teléfono físico, Safari/lectores de pantalla; calidad editorial y celebración solo simuladas: `docs/informes/cooper-animacion-fuerte.md:89`, `:93`. | Pruebas automatizadas de esta misión no sustituyen aceptación humana ni autorizan publicación real. |
| A | Nueva integración exige puerta y dos rondas conjuntas actuales; evidencia antigua no basta: `cooper/README.md:5`. | integración: 0 errores/advertencias, Sentinel con guardián, Playwright y videos verificados. |

## Frentes y restricciones

Worktrees propios `total-despliegue`, `total-n8n-lote`, `total-aprendizaje`, `total-competencia`, `total-chat-vps`, `total-operacion`; integración en `cooper-total`. Tres agentes de frente y orquestador en paralelo, dentro del máximo autorizado. Los frentes comparten únicamente contratos explícitos; el orquestador aplica VPS y hace push al remoto propio `mio`, nunca al upstream `origin`.

## Pendientes de Walter

Las filas B no detienen las A. Aceptación Google, Meta, permisos vencidos, gasto/medios/publicaciones, decisiones históricas, política editorial/retención y dispositivos físicos requieren su intervención. No se consideran cerrados por documentación ni por tests simulados.
