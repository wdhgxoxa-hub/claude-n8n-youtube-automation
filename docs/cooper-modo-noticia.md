# Modo noticia — fase 6

El canal puede pedir noticias del día de su nicho. El proceso exige hechos verificables, fuentes citadas y recursos didácticos originales. Se conservan las aprobaciones humanas y los interruptores de producción audiovisual.

## Desde Cooper

En **Canales**, el botón «Modo noticia» activa o desactiva la modalidad para los próximos videos. En el chat, con el canal seleccionado: «Activa modo noticia», «Desactiva modo noticia» o «Quiero un video de la noticia del día». El chat real dispone de herramientas tipadas para ambas acciones; el simulador reconoce estas expresiones. Toda mutación del chat requiere pulsar Confirmar en su tarjeta, incluida la modalidad de noticias.

El evento existente `ajustar_biblia` transmite `parametros: {campo:"modo_noticia", valor:true|false}` y actualiza la modalidad del canal, sin sustituir su biblia. `nuevo_video` admite `parametros.modo_noticia` booleano; si falta, hereda el canal. La modalidad queda congelada en el video: desactivar el canal no relaja los controles de una noticia en curso. Cooper y FX validan tipo, dueño y recurso. El estado remoto añade `modo_noticia` opcional, compatible con emisores anteriores.

En modo simulado, el video queda detenido en Verificación con un aviso explícito; no produce noticias ni inventa fuentes. La migración SQLite `0007_noticias` conserva los datos existentes.

## Recorrido de fábrica

1. El radar diario consulta canales activos con `modo_noticia`, cuando `allowRadar=true`, independientemente de vidIQ. Guarda `noticia_hoy` por canal. Las consultas de tendencias de Cooper muestran ese titular y su fecha.
2. Al pedir un video noticia se ejecuta de nuevo el radar y el verificador, sin depender de una caché anterior. El tema libre sirve como pedido; el radar elige la noticia relevante del nicho. `F · Noticia del día verificada` usa el [puente de texto](puente-codex.md).
3. El radar propone un titular de hoy en **America/Lima** y hechos identificados. Cada hecho exige fuentes HTTPS con título y fecha, presentes entre las URLs que consultó el proveedor. Rechaza noticias futuras, de otro día, listas vacías, IDs repetidos y URLs inventadas.
4. Un verificador independiente vuelve a buscar, confirma cada hecho y conserva su ID y texto. Cualquier omisión, contradicción, fuente ausente o respuesta ilegible detiene el paso antes del guion. El dossier persistido contiene hechos, fuentes y fecha de verificación.
5. Claude escribe a partir del dossier. Se verifica todo el resultado, incluidos título y ganchos, antes de solicitar aprobación. El registro guarda una huella SHA-256 del objeto exacto. Esta comprobación se ejecuta incluso con crítico apagado o al agotar sus revisiones.
6. El storyboard debe usar planos `imagen` o `clip`, `origen_visual:"generado"` y `recurso_didactico:"mapa"|"cifra"|"esquema"`. Requiere prompt y rechaza URLs en planos, archivo y avatares. Se vuelve a verificar narración, cifras, mapas, prompts y miniatura; guarda otra huella antes de aprobar.
7. Las correcciones invalidan las huellas correspondientes. Producción exige el guion y storyboard exactos certificados. No utiliza referencias de personajes o escenarios de la biblia; las imágenes se generan por la ruta API existente y las cifras se componen como texto. Los clips parten de esas imágenes propias.
8. Las rutas de publicación del Orquestador y Upload-Post consultan de nuevo la fila persistida. Sin dossier vigente y ambas huellas no publican. Las verificaciones caducan al cambiar el día de la noticia o superar 24 horas: no se permite programar noticias para días posteriores sin una nueva producción verificada.

Un fallo detiene el workflow y utiliza el vigilante de errores existente. El video permanece en su última etapa persistida; esta fase no añade una cola automática de reintentos ni una interfaz de recuperación de noticias bloqueadas. El operador puede resolver el problema y emitir un nuevo pedido; no debe falsificar las marcas de verificación para desbloquearlo.

## Contratos y persistencia

Columnas nuevas en `fab_canales`: `modo_noticia` boolean y `noticia_hoy` string JSON. En `fab_videos`: `modo_noticia` boolean, `noticia` string JSON, `noticia_guion_hash` y `noticia_storyboard_hash` strings. Migración aditiva declarada en [contratos/cooper-migracion-tablas.json](../contratos/cooper-migracion-tablas.json); no aplicada al entorno real. Las escrituras de video mantienen el sello y callback de progreso existentes.

Ejemplo de hecho (ficticio):

```json
{"id":"h1","dato":"La medición es de 12 unidades.","estado":"ok","fuentes":[{"url":"https://observatorio.example.test/boletin","titulo":"Boletín primario","fecha":"2026-11-20T09:00:00-05:00"}]}
```

El dato se contrasta con búsqueda del proveedor; no basta que el modelo devuelva `verificado:true`. Las URLs en el dossier no son recursos visuales descargables: no entran como `input_image`. No hay extracción de fotografías, capturas o clips de sitios de noticias.

## Límites y pendientes de Walter

- La verificación es una evaluación de modelos con evidencia de búsqueda, no una garantía de veracidad. Conservar revisión editorial humana, sobre todo para afirmaciones sensibles. Los mapas generados pueden requerir revisión de límites, escala y rótulos.
- El CLI puede no exponer URLs de búsqueda en JSONL. En tal caso las noticias usan Responses como respaldo; si está apagado o también falla, se detienen. No se probó acceso real a fuentes, cuenta ChatGPT, API ni medios pagos.
- No se garantiza salida en un número fijo de horas: influyen cuotas, fuentes, aprobaciones humanas y generación. La ruta evita investigación de vidIQ y usa plazos acotados de texto.
- Walter debe preparar el puente privado, migrar tablas, revisar/importar workflows, habilitar la política de gasto y elegir los canales. No hay despliegue, OAuth ni cambios en D&S Factory en esta misión.

Pruebas: nodos de radar/verificador, fechas y evidencia, huellas, correcciones, exclusión de medios, ruta Codex/API y aislamiento en `tests/flujos_v2.test.cjs`; servicio con Codex simulado; activación, persistencia, permisos y detención del simulador en Vitest; control de canal, detalle detenido y capturas móvil/escritorio con axe en Playwright. La evidencia final se recoge en [el informe](informes/cooper-fase6.md).
