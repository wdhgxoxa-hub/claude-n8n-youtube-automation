# cooper-total — Chat VPS

21 de noviembre de 2026, Lima. Rama propia `total-chat-vps`; integración y despliegue final coordinados en `cooper-total`.

## Resultado probado

Implementado el túnel SSH privado y tres relés autenticados. **Prueba real desde el VPS:** peticiones anónimas 401; salud de n8n/runner 200; respuesta del plan Codex 200 en 5,9 segundos, sin herramientas; PC desconectada 503 y recuperación 200. Los siete contenedores quedaron saludables. Un intento de escucha TCP remota fue denegado, código 255. No se copiaron tokens ni se abrieron puertos públicos.

El overlay corrige también el destino de puente anterior, que no era una URL válida, y fija el chat completo con respaldo API apagado. **En la continuación se comprobó que Cooper ya tiene aplicado ese overlay.** La disponibilidad del relé no acredita por sí sola el chat de una sesión Google real. No se inició OAuth ni se fabricó una sesión de producción. El código de esta rama pide una frase de hasta 18 palabras por defecto, con segunda frase solo para una decisión; la imagen pública anterior todavía no contiene esa regla.

[Guía de operación y recuperación](../cooper-chat-vps.md). Evidencia en `docs/informes/evidencias/total-chat-vps/` y cierre de despliegue en `cooper-total.md`.

## Commits

`a2eb8a7` introduce transporte, unidades y brevedad; `b35418b` conserva el contrato explícito de dos frases; `ab43da3` acota el plazo de radar; `e2ed83b` usa el UID real del socket; `46f95e2` corrige salud y configuración SSH; `222edac` habilita Unix manteniendo cerradas escuchas TCP; `5f37a95` añade sondas sin credenciales; `6ceb5df` fija el destino privado y desactiva respaldo de pago. La corrección común de imagen visible `71613de` se incorporó como `edb6561`. El puente de investigación `178a9b4` fue integrado por el orquestador.

## Puerta

Puerta completa repetida: `npm ci`, lint con cero advertencias, tipos, **284 unitarias**, **43 E2E con Sentinel**, build; desde raíz **147 pruebas de flujos**, todo código 0, cero errores y advertencias. Cinco pruebas del relé verifican tokens distintos, permisos, rechazo de Origin/rutas/cuerpo excesivo, caída y recuperación, y redirecciones. Integrado con el puente: 18 pruebas correctas.

El primer intento falló por caché de navegador Sentinel ausente; se reutilizó la instalación compatible y se repitió la puerta entera. No se cambiaron umbrales ni guardianes. La carga inmediata de la imagen de Marcas corrige el aviso de navegador que detectó el equipo. Las pruebas web usan datos ficticios aislados; las sondas remotas solo prueban el transporte real.

## Limitaciones y pendientes de Walter

La PC y su sesión del plan deben estar disponibles para respuestas completas, radar y análisis. El respaldo básico no tiene capacidades del modelo completo. La cuota única puede devolver ocupado durante otra investigación. Verificar las pantallas privadas en una sesión Google de Walter sigue pendiente; esta misión prohíbe iniciar OAuth. Las dos rondas integradas de Sentinel/Playwright y el despliegue de la versión combinada corresponden al informe final.

## Continuación: configuración efectiva y reconexión observada

21-11-2026, Lima. Se conservó el trabajo previo en `total-chat-vps`, sin merge ni push. `b840a0b` corrige un falso positivo de la sonda: antes comprobaba siempre `127.0.0.1:8789`, aunque el adaptador de Cooper apuntara a otro destino. Ahora comprueba el destino efectivo, su carácter privado, el proveedor del plan y el bloqueo de pago antes de enviar autenticación. Cuatro regresiones fallaron en tres casos con el código anterior y pasaron tras corregirlo; se rechazan también redirecciones y errores que puedan revelar configuración privada.

- **Configurado y probado en VPS:** `COOPER_CHAT=codex-local`, `COOPER_CHAT_API_RESPALDO=0` y destino privado correcto. La sonda corregida recibió 401 anónimo y 200 del plan en 5,6 segundos. Se usa Codex de la PC; no se instaló Claude CLI ni se trasladaron sesiones al VPS.
- **Reconexión real sin intervención:** durante las verificaciones, el VPS rechazó conexiones SSH y HTTPS. El servicio de túnel pasó de cero a tres reinicios y volvió a `active/running` por sí solo. La sonda posterior volvió a responder 200. No se atribuye la interrupción a una causa no comprobada ni se presenta como un reinicio provocado por este frente.
- **Acceso público:** HTTPS volvió a servir salud y entrada con 200, raíz con 307, y estado/SSE/chat sin sesión con 401. El host de acceso al navegador no estaba disponible. Por tanto, no se completó un turno privado desde `https://cooper.cooperestudio.com`; queda para la sesión existente de Walter.
- **Despliegue:** imagen observada `localhost/cooper:05d833787525fa98b183b3934ef13bd5dff1ca76`. El overlay está activo, pero las respuestas de hasta 18 palabras y las demás mejoras del producto requieren la imagen integrada del orquestador. Esta continuación no reinició servicios, no cambió n8n ni sustituyó la aplicación compartida.
- **Rollback:** documentada la parada/reanudación exclusiva de `chat-cooper`, conservando el respaldo básico sin gasto, la base y los relés de fábrica. La prueba previa de caída 503/recuperación 200 permanece separada de esta reconexión observada. El respaldo básico se verifica con pruebas aisladas; no se afirma haberlo usado en una sesión real de producción.

**Puerta de cierre repetida sobre `b840a0b`:** `cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`, código 0; 284 unitarias y 43 E2E, sin reintentos. Desde raíz `node --test tests/flujos_v2.test.cjs`, 147/147; `node --test tests/verificar-chat.test.mjs tests/tunel-codex.test.mjs tests/puente-codex.test.mjs`, 21/21. Cero errores y cero advertencias. [Registro completo](evidencias/total-chat-vps/cierre/puerta.log), [flujos](evidencias/total-chat-vps/cierre/flujos.log) y [transporte](evidencias/total-chat-vps/cierre/transporte.log). El commit de cierre solo añade documentación y evidencia; se identifica con `git log -1 -- docs/informes/total-chat-vps.md`.

Evidencia adicional: [cierre](evidencias/total-chat-vps/cierre/). Los archivos contienen solo resultados, conteos y registros de pruebas con datos ficticios. La referencia `auditoria-aprendizaje.md` no existe en este árbol; no se inventó su contenido. Fuentes oficiales reconsultadas: [OpenSSH](https://man.openbsd.org/ssh.1) y [Compose](https://docs.docker.com/reference/compose-file/services/).

**Pendientes de Walter:** probar un turno con su sesión Google ya abierta y revisar la brevedad después del despliegue integrado. **Pendiente del orquestador:** integrar esta corrección de sonda y desplegar la imagen conjunta; no requiere nuevas credenciales ni pagos.
