# Chat — aceptación real del contexto y las herramientas

21-11-2026, Lima. Integrado en la rama `cooper-total`; el despliegue final se acredita en el informe del orquestador.

## Cambios y prueba

- `ecdc49f`: recordar una preferencia no propone modificar la guía del canal. La memoria no confirma acciones ni altera permisos.
- `9bd86ea`: las herramientas de video explicitan que su identificador corresponde al video, evitando confundirlo con el canal. La misma clasificación se usa para validar las propuestas.
- `801af85`: la orientación hacia Avatares y voces explica la verificación de identidad y consentimiento.

Se ejecutó `npm run evaluar:chat -- --real --autorizar-plan` con el plan Claude existente de la PC, base ficticia aislada, HTTP bloqueado y sin ejecutar herramientas. La evaluación final pasó **37/37**, con 37 llamadas, después de las correcciones. Incluye 30 turnos de intención/aislamiento y siete casos de memoria: preferencia corregida, pendiente resuelto, regreso tras cuarenta mensajes, dos ideas ambiguas y olvido. Se revisaron también las respuestas completas; las propuestas siguen requiriendo confirmación humana.

La primera evaluación de esta integración pasó 36/37 y descubrió que Referencias recibía un canal. La validación rechazó el ID sin mutación. La segunda pasó 36/37: la orientación sobre avatar omitió mencionar identidad. Ambos resultados se conservan junto al final, sin recalificarlos ni ocultarlos. [Índice, revisiones y huellas](evidencias/total-chat-aceptacion/indice.json), [resultado final](evidencias/total-chat-aceptacion/final.json).

En el ensayo final, las 33 respuestas tuvieron p50 **2,82 s** y p95 **4,42 s**; las cuatro síntesis, p50 **2,55 s** y p95 **3,05 s**. Son tiempos del proveedor local e incluyen su arranque, no latencias de la interfaz/SSE. La rúbrica de brevedad exige como máximo dos frases y cuarenta palabras; el prompt pide una frase de dieciocho palabras cuando sea posible. No se afirma que una muestra garantice respuestas idénticas en el futuro.

El puente **real del VPS** se verificó por separado con el plan configurado: tres contextos correctos, HTTP 200, sin llamadas mutantes, respuestas de 8–14 palabras y 5,46–5,82 s. [Evidencia](evidencias/total-competencia-aceptacion/competencia-chat-contexto-real.json). Esa prueba confirma transporte y comprensión, no sustituye la prueba de memoria persistente anterior.

## Pendientes de Walter

- Mantener la PC disponible para el plan. El respaldo básico y la recuperación del túnel tienen sus propias pruebas en [Chat VPS](total-chat-vps.md).
- Aceptar el uso cotidiano desde su sesión Google real; esta misión no inició OAuth ni fabricó una sesión de producción.

La puerta completa integrada se documentará en [cooper-total](cooper-total.md); esta aceptación semántica no la sustituye.

