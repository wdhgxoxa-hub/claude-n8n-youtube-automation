# Radar: salida de subflujos normalizada

Fecha: 2026-11-21 14:22 (Lima). Frente de cooper-total, rama/worktree propios `total-radar-contexto`.

## Qué se corrigió

El recorrido completo fallaba en `Competencia con YouTube`, aunque una repetición del tramo final había pasado. El motor aislado reprodujo **ReservedKeyFoundError / Invalid output format** al devolver directamente el ítem recibido de Execute Workflow. Ese ítem incluía las claves superiores `json`, `pairedItem` y `metadata`; el validador del nodo Code rechaza esta última. La causa queda reproducida con proveedores sintéticos y sin red, sin atribuirla a una pareja ambigua ni a Google.

Commit **`d1c6750`**: se selecciona la misma respuesta válida por canal o el mismo respaldo web anterior y se crea un ítem explícito `{json:{...elegido.json},pairedItem:{item:k}}`. No se cambia el contenido de negocio, el criterio de aceptación, las conexiones, los permisos ni los horarios. Generador y JSON canónico coinciden. El cambio no modifica Cooper ni su imagen.

## Pruebas y evidencia

- [n8n 2.47.4: 4/4 PASS](evidencias/total-radar-contexto/motor-2474.log).
- [n8n 2.47.6: 4/4 PASS](evidencias/total-radar-contexto/motor-2476.log).
- [Flujos: 173/173 PASS](evidencias/total-radar-contexto/flujos.log).

La regresión `tests/radar_contexto_n8n.test.mjs` recorre los nodos canónicos completos de `antes_idea`, tres Execute Workflow reales y Data Tables reales. Sustituye las fuentes externas por respuestas ficticias en red interna sin Internet. Primero demuestra el fallo del código anterior y que no escribió tendencias; después prueba un canal y tres canales, incluido un respaldo web ante una respuesta ajena. Contrasta los datos devueltos con los persistidos.

La publicación local registra el webhook de forma asíncrona. El arnés solo permite repetir el 404 inequívoco de registro ausente mientras el contador demuestra que no hubo ninguna ejecución nueva; nunca repite un éxito o fallo de ejecución. El primer intento del arnés mostró ese 404 y el segundo, un formato de respuesta HTTP que devolvía solo el primer ítem; ambos ajustes pertenecen al arnés. Los registros anteriores quedan en `/tmp/cooper-radar-contexto-2476-final.log` y la caché privada del frente de cierre. No se han cambiado umbrales.

La puerta web completa corresponde al orquestador sobre el artefacto nuevo `bfd5e79`; este frente no la declara terminada. El código queda **implementado y probado localmente**, pendiente de integración/aplicación del delta y aceptación con fuentes reales. El reinicio acotado de sondas mantuvo siete servicios saludables y las esperas 400/540; no aplicó esta corrección.

## Fuentes oficiales

La documentación de [Execute Sub-workflow](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflow/) describe el retorno del último nodo al padre. La de [vinculación de ítems](https://docs.n8n.io/build/work-with-data/reference-data/link-data-items/) documenta el enlace entre ítems. La restricción exacta se contrastó con `Code/result-validation.js` de las imágenes oficiales fijadas por digest y se prueba mediante el motor real, sin modificar el validador.

## Limitaciones y Pendientes de Walter

No se acepta todavía el Radar real: queda aplicar el delta certificado y comprobar las fuentes. Ninguna decisión de Walter bloquea esta corrección. La disponibilidad de muestras y la acreditación de homónimos continúan sujetas a evidencia real; no se crean competidores, métricas ni outliers para completar el resultado.
