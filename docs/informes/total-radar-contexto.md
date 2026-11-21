# Radar: salida de subflujos normalizada

Fecha: 2026-11-21 14:44 (Lima). Frente de cooper-total, rama/worktree propios `total-radar-contexto`.

## Qué se corrigió

El recorrido completo fallaba en `Competencia con YouTube`, aunque una repetición del tramo final había pasado. El motor aislado reprodujo **ReservedKeyFoundError / Invalid output format** al devolver directamente el ítem recibido de Execute Workflow. Ese ítem incluía las claves superiores `json`, `pairedItem` y `metadata`; el validador del nodo Code rechaza esta última. La causa queda reproducida con proveedores sintéticos y sin red, sin atribuirla a una pareja ambigua ni a Google.

Commit **`d1c6750`**: se selecciona la misma respuesta válida por canal o el mismo respaldo web anterior y se crea un ítem explícito `{json:{...elegido.json},pairedItem:{item:k}}`. No se cambia el contenido de negocio, el criterio de aceptación, las conexiones, los permisos ni los horarios. Generador y JSON canónico coinciden. El cambio no modifica Cooper ni su imagen.

## Pruebas y evidencia

- [n8n 2.47.4: 4/4 PASS](evidencias/total-radar-contexto/motor-2474.log).
- [n8n 2.47.6: 4/4 PASS](evidencias/total-radar-contexto/motor-2476.log).
- [Flujos: 173/173 PASS](evidencias/total-radar-contexto/flujos.log).

La regresión `tests/radar_contexto_n8n.test.mjs` recorre los nodos canónicos completos de `antes_idea`, tres Execute Workflow reales y Data Tables reales. Sustituye las fuentes externas por respuestas ficticias en red interna sin Internet. Primero demuestra el fallo del código anterior y que no escribió tendencias; después prueba un canal y tres canales, incluido un respaldo web ante una respuesta ajena. Contrasta los datos devueltos con los persistidos.

La publicación local registra el webhook de forma asíncrona. El arnés solo permite repetir el 404 inequívoco de registro ausente mientras el contador demuestra que no hubo ninguna ejecución nueva; nunca repite un éxito o fallo de ejecución. El primer intento del arnés mostró ese 404 y el segundo, un formato de respuesta HTTP que devolvía solo el primer ítem; ambos ajustes pertenecen al arnés. Los registros anteriores quedan en `/tmp/cooper-radar-contexto-2476-final.log` y la caché privada del frente de cierre. No se han cambiado umbrales.

La puerta web completa corresponde al orquestador sobre el artefacto nuevo `bfd5e79`; este frente no la declara terminada. El código queda **implementado, integrado y aplicado en el VPS**; la aceptación con fuentes reales continúa en el frente competencia. El reinicio acotado de sondas mantuvo siete servicios saludables y las esperas 400/540; no aplicó esta corrección.

## Delta certificado y aplicado

Commit de código **`c0772dc`** (integrado por el orquestador como `3596d5b`): modalidad cerrada `radar_resolver`, limitada a tres objetivos publicados y orden hijo→Radar→API. El hijo procede de la fuente integrada `758fbd9`; Radar cambia únicamente `Competencia con YouTube.parameters.jsCode` y la API únicamente `Resolver.parameters.jsCode` (optimización H19). Las huellas del resto impiden introducir otros cambios. Las dependencias del hijo ya deben estar publicadas, las referencias de credenciales se reutilizan sin extraer sus valores y no se abre ningún horario.

Las 132 pruebas Python pasan con `-W error`. El lote se ensayó sin red, credenciales ficticias y límites de CPU en [n8n 2.47.4](evidencias/total-radar-contexto/delta3/ensayo-2474.json) y [2.47.6](evidencias/total-radar-contexto/delta3/ensayo-2476.json): tres importaciones, tres publicaciones en el orden certificado, 45→45 workflows, nueve tablas y **144 filas**, integridad/FK y reversión exacta. SHA de copia/restauración: `843e562c22b08208969aa77c5f8d76b5d0c736a54757f141bd8fdc89f6a82c9a`.

[Aplicación real](evidencias/total-radar-contexto/delta3/aplicacion-vps.json): **PASS**, con nueva copia fría `963cd2fbf81b571d7648eb422f59541c0a58386ee36b732f772b2496331ca96e`. Entrada `036631ccf577443d5592af9b7b97c6a165e288d240b053f8048f6129c3f8af80`; plan `9ef411a60c4254b0a0324fa57bdfc8cef1f59f985df002d0775c073d04a19be3`. Se preservaron nueve tablas/144 filas, SHA `b7034c2581cfbad07cfd454b209fd2bdf4657df1ae5e0adbae04143c0ab16610`, y todos los workflows ajenos. Cero columnas agregadas y cero entradas reabiertas. Siete servicios saludables; cero ejecuciones nuevas/en curso y esperas **400/540** intactas; freno `allowTextoApi=false` validado antes y después sin divulgar Ajustes.

Versiones publicadas:

| Workflow | Versión | Entrada |
|---|---|---|
| FabCompYouTube01 | 725330ee-47e3-49e8-83d2-1042262f5b57 | Interna |
| FabRadar00000001 | a054ba99-0ffc-472e-a4ed-a0758cca37c4 | Interna; horario deshabilitado |
| xorCR0lfNlil8Ovy | 372aadf1-b595-4c16-9438-e0e98be2f76b | API existente |

La normalización del Radar tiene SHA `2644d673a8da8792b66932c8d7b146bd1c75edca02c74d7463dda9d8b099ecfe`; Resolver `fbe854c83acc16e0d47dfcc8f6dda12e1e00c7b800a9ee61327b2528c08d72e1`. El primer wrapper temporal rechazó la operación antes de llamar al aplicador porque faltaba el helper público del freno de texto. No existían recibo ni marcador de mantenimiento y no hubo mutación; se completó el paquete y se repitieron las precondiciones. [Procedencia e intento conservado](evidencias/total-radar-contexto/delta3/procedencia.json).

El turno quedó cedido al frente competencia para una sola aceptación íntegra del Radar productivo y retirada de las tres sondas. La publicación técnica no se presenta como aceptación de proveedores. La imagen `bfd5e79` y la actualización de infraestructura continúan sin activar; su aceptación exacta histórica (`64ebdd0:docs/informes/total-imagen-bfd5e79.md`) es independiente de este lote. La integración conserva esta referencia de procedencia sin incorporar aquella aceptación de imagen como prueba de su nueva versión.

## Fuentes oficiales

La documentación de [Execute Sub-workflow](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflow/) describe el retorno del último nodo al padre. La de [vinculación de ítems](https://docs.n8n.io/build/work-with-data/reference-data/link-data-items/) documenta el enlace entre ítems. La restricción exacta se contrastó con `Code/result-validation.js` de las imágenes oficiales fijadas por digest y se prueba mediante el motor real, sin modificar el validador.

## Limitaciones y Pendientes de Walter

No se acepta todavía el Radar real: el delta certificado ya está aplicado y queda comprobar las fuentes. Ninguna decisión de Walter bloquea esta corrección. La disponibilidad de muestras y la acreditación de homónimos continúan sujetas a evidencia real; no se crean competidores, métricas ni outliers para completar el resultado.
