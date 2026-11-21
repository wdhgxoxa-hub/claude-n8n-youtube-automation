# Margen Real — estrategia editorial investigada

Consulta: **21-11-2026, Lima**. Identidad objetivo: [@MargenRealtv](https://www.youtube.com/@MargenRealtv), `UCjG7RP3o2RGGju9YnH6lnFg`. Ocho referentes hispanos, tres peruanos, con **60 videos en las muestras**. Investigación y propuesta en el repositorio; no aplicada a la biblia activa, no integrada, no desplegada ni publicada.

| Archivo | Contenido y uso |
| --- | --- |
| [biblia.json](biblia.json) | **Parche editorial parcial**, no biblia completa ni reemplazo de la plantilla. Promesa, público, reglas y resúmenes con fuentes dentro de `notas`, más textos por red. Solo campos ya aceptados por Cooper. |
| [competidores.json](competidores.json) | Observaciones públicas, selección, fechas, duración, precisión de vistas, medias, medianas, razones y límites por referente. Incluye candidatos mínimos para reproducir el filtro de los tres canales hispanos de la misma cohorte. |
| [identidad.json](identidad.json) | IDs exactos, homónimos, Shorts propios y ambigüedad de TikTok. País de la misión separado del país público. |
| [lecciones.json](lecciones.json) | Cinco hipótesis externas y piloto propuesto. `confirmadas` vacío: no son aprendizajes propios validados ni filas para importar a Aprendizaje. |
| [Informe](../../docs/informes/total-margen-estrategia.md) | Decisiones, comparación, piloto, evidencia de puerta y pendientes de Walter. |

## Cómo llega al contexto de la fábrica

El repositorio base solo contenía [la plantilla](../_plantilla/biblia.json); **n8n no lee automáticamente esta carpeta**. El Orquestador obtiene la biblia activa desde `fab_trabajos.resultado.resultado`, mediante `biblia_ruta = trabajo:<job_id>`, y la pasa a `datos.biblia` en `Nuevo video`. El archivo propuesto coloca el resumen útil y sus URLs dentro de campos que sí viajan al guionista; las rutas locales sirven de trazabilidad al revisor, no se presume que el modelo abra esos archivos.

Cuando se autorice una integración posterior, el operador debe identificar el `canal_id` interno del dueño mediante los mecanismos existentes, comprobar su channel ID y conciliar las notas vigentes con esta propuesta. El ID público de YouTube **no es** el `canal_id` de n8n. No crear otro canal por coincidencia de nombre.

Reutilizar **Operación → Biblia** y sus confirmaciones por campo (`control_fabrica`, acción `biblia`, que deriva en `ajustar_biblia`), sin escribir tablas por fuera del puente ni cambiar controles de acceso. Las hojas del JSON corresponden a `nicho`, `publico`, `promesa`, `idioma`, `notas`, `publicacion.youtube` y `publicacion.tiktok`. Cada valor admite hasta 6.000 caracteres. Conservar reglas previas que sigan vigentes al conciliar `notas`; no borrarlas ciegamente. No reemplazar el objeto completo: voz, activos, nombre, presupuesto, calendario, otras redes y lecciones existentes se mantienen.

Esta misión no contiene órdenes ejecutadas, IDs internos supuestos, parámetros de confirmación automática ni scripts de importación. Las hipótesis de [lecciones.json](lecciones.json) permanecen fuera de `biblia.lecciones`: el [contrato aprender](../../skill/FABRICA.md) exige repetición del patrón en tres videos propios. La investigación externa no cumple esa condición.

## Leer bien la evidencia

`ratio_media_muestra = vistas / (suma(vistas disponibles) / n)`, incluyendo el video evaluado. 2× es una etiqueta exploratoria; no significancia estadística. Las medianas muestran cuánto pesa un solo video. Los máximos son **de la muestra**, no de todo el canal.

Infomercado usa una serie reciente de Shorts. PQS y Emprende Trome son archivos locales históricos; Trome además es una muestra por buscador con sesgo de selección. Los tres canales Adrián/Eduardo/Luis usan los primeros ocho elegibles por antigüedad visible de uno a doce meses y duración de 4–60 minutos, dentro de los 30 recibidos. Meses redondeados no equivalen a días exactos. Emprende Aprendiendo mezcla explicaciones, noticias y clase; Detrás del Margen tiene alcance pequeño. No combinar las medias entre esas muestras.

Se tomaron páginas públicas sin autenticación. Contadores enteros de `watch` y vistas redondeadas de tarjetas se etiquetan por registro. Las cifras no se normalizaron a igual edad. Ninguna retención, CTR, ingreso o apertura audiovisual de competidores se observó: los ganchos son inferencias de títulos/descripciones. Los hechos empresariales prometidos por esos títulos requieren investigación propia antes de usarse en guiones.

TikTok `@margenreal` responde como **margen** mediante oEmbed; su vínculo con YouTube sigue sin comprobar. El homónimo `@MARGENREAL` declara **España**. El supuesto mexicano exacto no quedó corroborado; Detrás del Margen sí declara México, pero es otra denominación.

## Verificación reproducible sin red

Desde la raíz:

```bash
node --test tests/margen_estrategia.test.cjs
```

Recalcula muestras y selección, verifica referencias de hipótesis, separación de identidades y límites del parche. Ejecuta los nodos Code existentes `Aplicar ajuste` y `Nuevo video` sobre filas ficticias: demuestra que los campos se preservan y que el guionista recibe las notas y las fuentes. No llama n8n ni modifica SQLite. La puerta obligatoria del proyecto y sus resultados quedan en el informe.
