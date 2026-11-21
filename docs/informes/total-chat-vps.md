# cooper-total — Chat VPS

21 de noviembre de 2026, Lima. Rama propia `total-chat-vps`; integración y despliegue final coordinados en `cooper-total`.

## Resultado probado

Implementado el túnel SSH privado y tres relés autenticados. **Prueba real desde el VPS:** peticiones anónimas 401; salud de n8n/runner 200; respuesta del plan Codex 200 en 5,9 segundos, sin herramientas; PC desconectada 503 y recuperación 200. Los siete contenedores quedaron saludables. Un intento de escucha TCP remota fue denegado, código 255. No se copiaron tokens ni se abrieron puertos públicos.

El overlay corrige también el destino de puente anterior, que no era una URL válida, y fija el chat completo con respaldo API apagado. **La disponibilidad del relé no acredita por sí sola el chat de una sesión Google real:** la aplicación recibirá este overlay al despliegue final del orquestador. No se inició OAuth ni se fabricó una sesión de producción. El chat ahora pide una frase de hasta 18 palabras por defecto, con segunda frase solo para una decisión.

[Guía de operación y recuperación](../cooper-chat-vps.md). Evidencia en `docs/informes/evidencias/total-chat-vps/` y cierre de despliegue en `cooper-total.md`.

## Commits

`a2eb8a7` introduce transporte, unidades y brevedad; `b35418b` conserva el contrato explícito de dos frases; `ab43da3` acota el plazo de radar; `e2ed83b` usa el UID real del socket; `46f95e2` corrige salud y configuración SSH; `222edac` habilita Unix manteniendo cerradas escuchas TCP; `5f37a95` añade sondas sin credenciales; `6ceb5df` fija el destino privado y desactiva respaldo de pago. La corrección común de imagen visible `71613de` se incorporó como `edb6561`. El puente de investigación `178a9b4` fue integrado por el orquestador.

## Puerta

Puerta completa repetida: `npm ci`, lint con cero advertencias, tipos, **284 unitarias**, **43 E2E con Sentinel**, build; desde raíz **147 pruebas de flujos**, todo código 0, cero errores y advertencias. Cinco pruebas del relé verifican tokens distintos, permisos, rechazo de Origin/rutas/cuerpo excesivo, caída y recuperación, y redirecciones. Integrado con el puente: 18 pruebas correctas.

El primer intento falló por caché de navegador Sentinel ausente; se reutilizó la instalación compatible y se repitió la puerta entera. No se cambiaron umbrales ni guardianes. La carga inmediata de la imagen de Marcas corrige el aviso de navegador que detectó el equipo. Las pruebas web usan datos ficticios aislados; las sondas remotas solo prueban el transporte real.

## Limitaciones y pendientes de Walter

La PC y su sesión del plan deben estar disponibles para respuestas completas, radar y análisis. El respaldo básico no tiene capacidades del modelo completo. La cuota única puede devolver ocupado durante otra investigación. Verificar las pantallas privadas en una sesión Google de Walter sigue pendiente; esta misión prohíbe iniciar OAuth. Las dos rondas integradas de Sentinel/Playwright y el despliegue de la versión combinada corresponden al informe final.
