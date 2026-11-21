# Lote de aprendizaje para el orquestador

Base común: `de397f3`. Este lote es una entrega local, no una importación ni activación remota.

- [Diff de los siete flujos](flujos.patch), respecto de la base común.
- [Manifiesto y SHA-256](manifiesto.json) de las exportaciones completas en `workflows/v2/`.
- Fuentes: `tools/cooper/aprendizaje.js`, `aprendizaje_flujos.py`, `observabilidad.js` y `skill/FABRICA.md`. Se integran junto a la web, sus contratos y pruebas.

El orquestador debe combinar las fuentes de los frentes antes de regenerar el lote integrado: no sustituir a ciegas Orquestador/API/Retorno, compartidos con otras misiones. El diff conserva IDs y las exportaciones están inactivas. No hay migración nueva; requiere las columnas de observabilidad de Integración 3.

M7 consulta cada hora, condicionado por `allowAnalytics`. El interruptor «Medición y aprendizaje automático» de Aprendizaje modifica ese mismo ajuste mediante el control administrativo existente, con revisión de concurrencia y registro de cambios. Tras importar el lote, el orquestador debe dejar el disparador M7 publicado para que el interruptor pueda gobernar las consultas. Pausar el ajuste conserva el historial y la lectura de lecciones del siguiente guion.

La consulta adicional `GET /youtube/v3/videos` usa el permiso ya conectado y solicita solo título, miniatura y duración. No sube ni modifica videos. YouTube entrega 100 intervalos, que se ubican en segundos usando la duración publicada; no se fabrican muestras cada segundo. Una falta de permiso/duración conserva los contadores disponibles y deja la curva vacía. Los datos pueden llegar tarde: se guarda fecha y demora real, no una reconstrucción retrospectiva del hito.

El plan de aprendizaje usa `PUENTE_CODEX_URL` de loopback y `PUENTE_CODEX_TOKEN`, sin ruta de API pagada. Si la PC no responde, conserva evidencia para reintentar. El siguiente guion se valida contra los IDs requeridos antes de avanzar. Los patrones exigen tres videos independientes; una hipótesis no demuestra causalidad ni mejora.

La aceptación en producción, con respaldo y reversa, pertenece al orquestador. No activar producción audiovisual para verificar este lote. Las pruebas de este cierre emplean métricas, modelos y cuentas ficticias.
