# Cooper total — informe del orquestador

**Corte provisional: 21-11-2026, 11:46 Lima. La misión continúa.** Rama y worktree propios `cooper-total`. Este informe se cerrará después de la aceptación real, las dos rondas finales, el despliegue y el push autorizado. No se presenta el código local como producción aceptada.

## Alcance autorizado

Walter autorizó integrar, publicar en las ramas `version-chatgpt` y `main` del remoto propio `mio`, desplegar en el VPS y aplicar el lote n8n con respaldo y reversa probados. Se mantienen las prohibiciones de D&S Factory, pagos, OAuth iniciado por el agente y publicación social sin aprobación humana. Los ensayos de proveedores se limitan a lecturas y al plan ya disponible de la PC. No se leyeron ni mostraron valores de secretos o archivos `.env`.

## Evidencia comprobada hasta este corte

| Frente | Implementado e integrado | Prueba que ya existe | Límite en este corte |
| --- | --- | --- | --- |
| Lote n8n | 32 flujos, cinco columnas, publicación ordenada y guardas explícitas para cuatro pasos sin credencial. | Aplicación real FINAL3: 25 publicados, nueve tablas/118 filas conservadas, siete servicios saludables. El intento anterior se revirtió realmente. | Falta el delta posterior de periodos Lima y `retorno_url`, y resolver las entradas seguras. [Recibos](total-n8n-lote.md). |
| Cooper y Marcas | Navegación de resultados, controles de origen/medios, FFmpeg y firma del worker; seguimiento durable de biblioteca sin navegador. | Imagen `970d102`: migración de copia real 8→11 y reversa; ocho bloques Compose, JPEG/reel con audio, firma, SSE, copia/restauración. | Imagen preparada; todavía no acredita despliegue final. Marcas conserva modo simulado y publicación apagada. [Aceptación](total-marcas-runtime.md). |
| Aprendizaje | Ventanas 24h/72h/7d, contexto creativo, causas e hipótesis trazables; lectura obligatoria de lecciones por el siguiente guion. | Regresiones locales y E2E de la puerta integrada. | Aceptación real en curso; se diagnosticó que CLI no inicializa Data Tables y se preparó una entrada efímera privada con el runner normal. No se atribuyó ese fallo a Google. [Implementación](total-aprendizaje.md). |
| Competencia | Radar obligatorio antes de la idea, fuente/fecha, comparables, homónimos y diferenciación Perú. | Pruebas locales; las entradas incompletas quedan señaladas, sin inventar cuentas ni métricas. | Sondas gratuitas y persistencia real pendientes del turno compartido de n8n. [Implementación](total-competencia.md). |
| Chat | Túnel firmado y relés privados; respuesta breve del plan de la PC; respaldo básico. | Respuesta real, rechazo anónimo, caída y reconexión, arranque automático. | La evaluación semántica ampliada y la aceptación desde sesión Google real se distinguen del transporte. [Informe](total-chat-vps.md). |
| Operación | Copias restic cifradas en VPS y réplica gratuita en PC; monitor y alertas Telegram. | Restauración externa y reinicio real del VPS con servicios/timers recuperados. | La copia depende de PC disponible; falta canal de alerta independiente si cae todo el VPS. [Informe](total-operacion.md). |
| Seguridad | Origen/MIME, aislamiento de medios, límite público fijo y orden del bloqueo de Caddy. | Regresiones, adaptación real de Caddy y npm audit sin vulnerabilidades conocidas del lock de Cooper. | Bloqueo Caddy desplegado con reversa real 401→404→401→404; n8n/runner 2.47.6 y Caddy 2.11.8 ya pasan ensayo aislado, pendientes de aplicación remota. [Revisión](total-seguridad.md). |

## Puerta y rondas

La puerta integrada pasó sobre el código de producto congelado en `85a4f3c` (incluido en la imagen `970d102`): **322 unitarias, 49 E2E, 167 pruebas de flujos**, instalación, lint, tipos y build, sin errores ni advertencias. [Logs y huellas](evidencias/cooper-total/puerta/resumen.json). Los instaladores posteriores tienen verificaciones adicionales independientes y no cambian esa imagen.

La primera ronda preliminar conjunta detectó un p95 de fotogramas de 33,3 ms frente al límite de 25 ms mientras concurrían compilaciones. Se conserva el fallo y no se cuenta como ronda limpia. La ejecución `final-1` de 64 casos está en curso. No se han rebajado umbrales, añadido reintentos ni omitido pruebas. Cualquier cambio posterior de producto exige repetir la validación correspondiente antes del cierre.

## Auditoría y trabajo concurrente

La [auditoría inicial](faltantes-total-inicial.md) conserva el primer corte; la [auditoría ampliada](faltantes-total.md) registra sus observaciones con hora y evidencia. Sus propuestas no equivalen a funciones aprobadas ni a defectos confirmados. El cierre distinguirá correcciones, límites humanos y propuestas futuras. La segunda tanda externa M01/M03/M05/M06/M07/M08/M09/M10 está en revisión; se compartieron los commits ya integrados para evitar duplicaciones y se reservó el VPS a los ensayos coordinados.

## Pendientes de Walter

1. Entrar con Google y aceptar el recorrido privado real, SSE y adjuntos; no se fabricó una sesión de producción.
2. Completar solo los permisos de cuentas/proveedores que fallen en las lecturas reales, y la configuración Meta/plantillas/pago si desea activarlos. No se compró acceso.
3. Aprobar contenido y producción con coste; revisar las dos esperas históricas antes de reabrir entradas que puedan producir o publicar.
4. Mantener disponible la PC para el plan y la réplica gratuita, custodiar material de recuperación offline y elegir un aviso externo para caída total.
5. Definir identidad, responsables, retención y conciliación de medios/cuentas; validar hipótesis editoriales con futuras publicaciones aprobadas.

Esta lista es provisional: al terminar las sondas se reducirá a bloqueos demostrados, sin convertir tareas técnicas pendientes en decisiones humanas.

## Cambios remotos adicionales comprobados

El 21-11 a las 11:45 Lima se aplicó el orden seguro de Caddy, con respaldo privado de su configuración pública y candado operativo. Se validó, recargó, revirtió y reaplicó: el POST anónimo al puente cambió **401→404→401→404**. Las rutas efímeras de aceptación también devuelven 404 desde Internet. Cooper mantuvo HTTPS saludable y n8n no se reinició. [Recibo de reversa real](evidencias/cooper-total/caddy-reversa-real.json).
