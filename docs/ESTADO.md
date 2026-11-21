# ESTADO — Fábrica de videos + Cooper

Última actualización: 2026-11-21 11:46 (Lima).

## Qué es

- Fábrica de videos en n8n (canal de pruebas: Margen Real) + Cooper (web y chat en `cooper/`) para Walter y su equipo de 3–4 personas. Marcas y cuentas propias, sin clientes externos.
- Claude dirige y revisa; Codex realiza misiones en ramas/worktrees propios, con informes en `docs/informes/`.

## Hecho

- **cooper-total, corte 11:46 Lima:** imagen `970d102` probada con ocho bloques Compose y migración real 8→11/reversa. Bloqueo público del puente Caddy aplicado con reversa real 401→404→401→404, sin reiniciar n8n. Parches n8n/runner 2.47.6 y Caddy 2.11.8 ensayados, todavía sin desplegar. [Informe provisional y evidencias](informes/cooper-total.md).

- **cooper-total, 21-11 11:30 Lima:** lote FINAL3 aplicado al VPS: 32 flujos, cinco columnas y 25 dependencias publicadas; nueve tablas/118 filas y flujos ajenos preservados, siete servicios saludables. Reversa real del intento previo comprobada. Horarios y callbacks pendientes de aceptación siguen pausados. [Recibos](informes/total-n8n-lote.md).
- **Puerta integrada de cooper-total:** 322 unitarias, 49 E2E, 167 flujos y 70 pruebas de despliegue; cero errores/advertencias. Runtime Marcas, seguridad, seguimiento durable de biblioteca y navegación de resultados integrados; imagen final y dos rondas aún en curso. [Evidencia](informes/evidencias/cooper-total/puerta/resumen.json).

- **cooper-total / Operación:** réplica restic cifrada y gratuita en PC habilitada; última restauración real `3cb43d07`, 25 archivos y dos bases, 21-11 a las 11:07 Lima. Monitor/Telegram y timers instalados; corrección `c18106f` desplegada con aviso TLS ≤14 días y reintento persistente. Reinicio real probado fuera del lote: siete contenedores saludables, stack y timers automáticos, 36 workflows sin cambios. Puerta repetida: 284 unitarias, 43 E2E, 147 flujos y 39 pruebas operativas, cero errores/advertencias. Código y corrección recogidos por el orquestador en `cooper-total` (`cf0fe8c`); este frente no hizo push/merge. [Informe y evidencia](informes/total-operacion.md).

- **Cooper total, frente aprendizaje:** implementado y probado localmente el ciclo de métricas 24h/72h/7d, evidencia creativa y lecciones por canal con lectura obligatoria del siguiente guion, trazabilidad en Aprendizaje y ensayo seguro sin producción ni llamadas de IA. Puerta completa: 285 unitarias, 44 E2E, 154 regresiones de flujos; cero errores/advertencias. **Pendiente de integración y validación/despliegue remoto por el orquestador.** [Informe](informes/total-aprendizaje.md).
- **Cooper total / Chat VPS:** túnel privado instalado y probado con el plan real de la PC, caída y recuperación; puerta 284 unitarias/43 E2E/147 flujos sin errores ni advertencias. Overlay del destino privado pendiente del despliegue integrado; sesión Google real pendiente, sin iniciar OAuth. [Informe](informes/total-chat-vps.md).
- **Imagen final de cooper-total probada (21-11, 11:02 Lima):** fuente exacta `169d0cd`, migración real 8→11/reversa a imagen previa y siete bloques Compose pasan; TLS, login ficticio, runner/firma/SSE, restic y recuperación comprobados. Vigilante seguro: 148 pruebas de flujos pasan. No equivale a despliegue ni OAuth real. [Evidencia](informes/total-despliegue.md).

- **Operación real de cooper-total (21-11, 10:48 Lima):** réplica restic cifrada a PC habilitada, servicio con restauración real y recibo VPS en éxito; monitor activo con aviso Telegram aceptado y reversa de publicación probada 404→401→sonda firmada. Se conservaron los 34 workflows anteriores. Stack habilitado, pendiente prueba coordinada de arranque; aplicación final todavía no desplegada por este frente. [Informe y evidencia](informes/total-despliegue.md).
- Fases 1–6: web, chat por los planes de Claude/Codex, puente firmado con n8n, avatares/voces, WhatsApp, preparación VPS y modo noticia. Proveedores con gasto y modo noticia requieren su activación correspondiente.
- **Integración 3:** Pulido, Memoria, Cobertura, Marcas y Animación fusionados en orden; `version-chatgpt` y `main` publicados en el remoto propio `mio`, por excepción expresa de Walter. [Informe y evidencia](informes/cooper-integracion3.md).
- **Cooper actualizado en la PC:** <http://localhost:3000>, unidad `cooper.service` activa, respaldo previo protegido y SQLite migrado de ocho a once entradas. Arranque automático deshabilitado, conservando el estado establecido por la migración al VPS. Solo se reanudó la web local; n8n local no se reactivó. Administrador: wdhg.xoxa@gmail.com.
- Puerta integrada: 284 unitarias, 43 E2E, 147 pruebas de flujos, lint, tipos, instalación y build; cero errores/advertencias. Dos rondas conjuntas Sentinel + Playwright de 58/58, 176 muestras de pantallas y 188 videos, incluidos recorridos completos a 1440/390 px. Lighthouse: 88 mediciones, rendimiento 97–100 y accesibilidad/buenas prácticas 100, sin advertencias. [Índice local](../cooper/.cache/videos-integracion3/index.html).
- Pulido: medios reales, Publicados y Aprendizaje, chat breve. Memoria: recuerdos privados por usuario/canal, recuperación más allá de 30 mensajes, tarjeta de regreso, consulta administrativa y borrado. Cobertura: pantallas de operación e inventario integrado de 32 flujos/1.211 nodos, 121 decisiones/esperas, 58 ajustes y nueve Data Tables. Informes históricos: [memoria](informes/cooper-memoria.md), [cobertura](informes/cooper-cobertura.md).
- Animación: ilustraciones originales, fábrica animada, bienvenida, celebración y pausa/movimiento reducido. Corregidos el solapamiento de la galería y las etiquetas repetidas de canales; regresiones y accesibilidad verificadas. [Informe de movimiento](informes/cooper-animacion-fuerte.md).
- Marcas: espacio privado con cuentas, diseños, revisiones, calendario, Publicados y Aprendizaje propios; proveedores simulados y migración integrada `0010_marcas`. [Informe](informes/cooper-marcas.md). No hay publicación real activada.
- **VPS migrado por la misión concurrente `cooper-vps-real`** (`1883fb3`, conservado en la integración): servicios y datos instalados, HTTPS y copias comprobados. El servidor mantiene el código anterior; integración 3 no lo despliega. Su aceptación real sigue pendiente. [Informe del VPS](informes/cooper-vps-real.md).
- Google OAuth: cliente «Cooper web» del proyecto n8n-videos; revisar callbacks localhost y dominio definitivo al aceptar el VPS. No se hicieron logins durante integración 3.
- Meta: portafolio «Cooper Estudio», app «Cooper», usuario cooper-bot y número +51 939 484 675. Configuración de firmas, plantillas y pago pendientes según el cierre del VPS; no se realizaron pagos ni envíos en esta misión.
- Contabo Cloud VPS 4, pedido 15717272; dominio cooperestudio.com en Cloudflare. IP/SSH/DNS ya resueltos por la misión VPS, sin revalidación remota en integración 3.
- Regla permanente: actualizar este ESTADO al terminar cada misión, conservando hechos, trabajo en curso, pendientes e ideas.

## En curso

- Orquestador `cooper-total`: integrar/desplegar los frentes y ensayar imagen nueva/reversa; la corrección del monitor `c18106f` ya está recogida en su rama. Monitor, receptor y timers ya están instalados; reinicio automático comprobado. Operación no reabrió workflows ni hizo push.

- Cooper total: integrar el frente aprendizaje y ejecutar su [ensayo de lectura](cooper-aprendizaje-ensayo.md) sobre publicaciones existentes, con respaldo/reversa, sin reanudar producción. La conexión real y la calidad de las lecciones todavía no se acreditan por las pruebas locales.
- **Lote cooper-total:** clon aislado publica 25/25 flujos con cuatro pasos sin credencial bloqueados explícitamente y tres entradas externas deshabilitadas; la entrada definitiva FINAL3 ya pasó importación32, publicación25, versiones y reversa exacta187tablas en un único recibo ligado al plan antes de otro intento real. No se ha habilitado producción de medios ni publicado contenido social. [Ensayos](informes/total-despliegue.md).

- Orquestador: aceptar Aprendizaje/Radar con datos reales, revisar activación segura de las entradas y aplicar delta menor de gastos/retorno. El lote principal ya está aplicado; no queda para Claude.
- Aceptación del VPS: sesión Google real, datos/SSE/adjuntos, Meta, entradas pausadas y conexión del chat con los planes de la PC. La copia fuera del VPS ya está activa y verificada; queda su custodia offline.
- La PC conserva la base del corte; no sincroniza escrituras posteriores del VPS. Elegir el destino de producción y conciliar los datos antes de cualquier reversa o actualización del servidor. [Instalación y reversa local](cooper-integracion3-despliegue.md).

## Pendientes de Walter

1. Resolver pago de Meta, configurar firma y plantillas WhatsApp con Claude; mantener mensajería pausada hasta aceptar la configuración.
2. Probar Google, SSE y adjuntos en el VPS y revisar Cooper local en Chrome. IP/SSH/DNS ya no son un pendiente de alta; no repetir el acceso root antiguo.
3. Revisar con Claude las dos esperas históricas y las diez entradas pausadas del VPS; elegir cuáles reabrir. El guion del Short `v-mwp2bjgj-7fvq` sigue como pendiente histórico, sin reanudación ni aprobación en esta misión.
4. Validar memoria con conversaciones ficticias usando el proveedor del plan: las pruebas locales no miden calidad semántica real. La síntesis añade una llamada por turno y hasta 12 segundos.
5. Fijar presupuestos, modelos, interruptores, perfiles de publicación y permisos OAuth; autorizar por separado un ensayo real de producción, medios y celebración. Operación puede mostrar indisponibilidad hasta instalar el nuevo puente.
6. Revisar los videos y probar un teléfono físico de gama media y Safari si se utiliza. La emulación local no sustituye esa aceptación.
7. Marcas: definir identidad/dueños, asignar activos y permisos, cotejar corpus bíblico y guía pastoral, aprobar plantilla WhatsApp y decidir retención/conciliación de medios y primer ensayo real.
8. Mantener disponible la PC para la réplica gratuita ya habilitada y custodiar claves offline; recuperación externa probada. Si necesita aviso durante caída total de VPS/n8n, elegir un canal independiente (pendiente B, sin cuentas ni pagos creados). Conservar la aceptación del túnel de planes a cargo del frente correspondiente.


9. Aprendizaje: revisar hipótesis editoriales, reautorizar solo las cuentas cuyo permiso de analytics falle y aprobar los futuros videos con los que contrastar las correcciones. No se inventan métricas de ventanas pasadas ni una mejora causal.

## Ideas conversadas

- Gestión de redes de sus marcas (iglesia, futura tienda de ropa y equipo): primera implementación disponible en modo simulado. La activación real multirred, permisos, calendario editorial y especialistas por rubro siguen pendientes de las decisiones anteriores.
- Microserie con IA: aplazada.
