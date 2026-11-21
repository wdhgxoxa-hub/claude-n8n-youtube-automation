# Inventario y simulación de retención

M06 · 21-11-2026, Lima. Herramienta local del operador, **solo lectura**. No activa retención, purga, tareas programadas ni llamadas a proveedores. B08 sigue pendiente de Walter.

Desde `cooper/`, con una copia SQLite coherente obtenida por el procedimiento de respaldo existente:

```bash
npm run datos:inventario -- --simular \
  --base /ruta/privada/copia.sqlite \
  --politica retencion.example.json \
  --salida /ruta/privada/informe-nuevo.json
```

La ruta es obligatoria; no usa `COOPER_DATABASE_PATH`, `.env`, la conexión de la web ni migraciones. Usa `better-sqlite3` existente con `readonly`, `fileMustExist`, `query_only` y una transacción de lectura. Requiere el esquema de integración 3 (hasta `0010_marcas`); una base incompleta o JSON de referencias ilegible falla sin generar informe. Una relación SQL rota también falla; referencias sin destino detectadas en campos JSON quedan como incidencias y bloquean todos los candidatos.

El acceso corresponde al operador con permiso del sistema de archivos sobre la copia; no es una API web ni admite IDs para hacerse pasar por administrador. No se modifican los controles de acceso de Cooper. El informe contiene IDs locales por dueño y debe custodiarse como información privada: se crea con modo `0600`, sin sobrescribir archivos ni enlaces existentes. Solo se imprime éxito o error genérico. No pasar datos personales como nombres de archivo. El operador debe registrar el identificador de su copia, el commit de la herramienta y la huella del informe en su expediente privado.

## Alcance del inventario

| Datos | Qué registra y qué protege |
| --- | --- |
| Adjuntos originales y huérfanos | ID, dueño, bytes declarados y referencias desde mensajes, perfil, fotos/evidencia de biblioteca, logos actuales y de revisiones de piezas, originales y medios de Marcas. Huérfano significa **sin referencias en esta proyección**, no permiso de borrar. |
| Derivados | Medios de piezas conservadas y vistas previas de activos, incluidos publicados y cancelados. Un adjunto puede tener usos de original y derivado: todas sus referencias se conservan, sus bytes se cuentan una sola vez. |
| Mensajes y memoria | Fechas y longitud en bytes, sin contenido. El historial posterior al corte de olvido se protege; solo el anterior puede ser candidato si supera el plazo y no hay bloqueos. Memorias activas se conservan. Olvidar no equivale a borrar mensajes. |
| Consentimiento e identidad | Presencia y fecha de los registros actuales de activos/contactos y retos, nunca texto, frase o grabación. Evidencias y consentimientos protegidos; revocar no libera originales. |
| Operaciones | Bloqueos por dueño: chat activo, tarjetas pendientes/en ejecución/inciertas, órdenes de puente sin confirmar, entrenamiento/revisión/error de biblioteca, producción pendiente, piezas pendientes o inciertas, ingestas pendientes/descargando, avisos y acciones WhatsApp no terminados. Un consumidor de otro dueño protege también originales/vistas del activo compartido. No se levantan bloqueos por su antigüedad. |
| Ingestas y avisos | ID, dueño y fecha. Las ingestas completas/fallidas pueden simularse por plazo; avisos conservan trazabilidad. No se incluyen captions, teléfonos, payloads ni identificadores remotos. |
| Medios remotos | Número de referencias de montaje, escenas, miniaturas y publicaciones en la proyección de cada video. No lee URLs en JavaScript, no las exporta, descarga ni comprueba vigencia. Las vistas remotas de activos se indican como copia no inspeccionada. |

El JSON incluye corte UTC, política efectiva, SHA-256 de política y proyección clasificada, referencias, bloqueos, decisión por recurso y totales por dueño. `candidato_simulado` es una observación, nunca una orden. Un mensaje candidato sigue protegiendo sus adjuntos porque aún existe; no se simulan cascadas que supongan borrados previos. Cambiar el plazo no habilita ninguna escritura. La huella de inventario cubre la proyección y clasificación, no los cuerpos privados ni el archivo SQLite completo; no sustituye una copia verificable.

## Propuesta pendiente de aprobación

`retencion.example.json` conserva todo con `null`. Para comparar escenarios se puede crear otra política con enteros de 1 a 36.500 días por categoría y excepciones por `duenos` o claves `tabla:id` de `recursos`. El esquema rechaza campos desconocidos, modo de ejecución, plazos negativos/fraccionarios y cualquier plazo de consentimiento. Los bloqueos prevalecen sobre el plazo.

Propuesta para evaluar con Walter, **sin activar**: comparar 30/90 días para mensajes anteriores al olvido y 7/30 días para ingestas terminadas; originales, derivados, identidad, consentimientos y trazabilidad permanecen sin plazo hasta resolver sus excepciones y copias. Esos números son escenarios técnicos para medir impacto, no una política aprobada ni una obligación normativa.

Los adjuntos actuales no tienen fecha de alta ni procedencia durable tras desaparecer su última referencia. Por ello ni siquiera un huérfano con plazo configurado puede ser candidato; no se infiere su fecha desde un mensaje o del mtime del archivo SQLite. Los consentimientos viven dentro de `assets`: si otra función elimina esa fila, el inventario no reconstruye el consentimiento histórico. La herramienta no altera ese comportamiento heredado. Walter debe decidir conservación de pruebas y trazabilidad antes de encargar un ejecutor físico.

## Borrado y recuperación

No existe opción `--ejecutar`, endpoint de purga ni programador. Las pruebas `tests/retencion.test.ts` usan SQLite temporal y datos ficticios: referencias compartidas, revocación, bloqueos, aislamiento por dueño, política estricta, salida privada y ausencia de modificación de la base. El ensayo de recuperación hace `backup` de una fixture, elimina un mensaje **desde el test**, verifica el huérfano y restaura la copia; el inventario recuperado coincide y el mensaje vuelve íntegro. No se borró ni restauró producción.

Para una futura ejecución autorizada habrá que aprobar cada lote, revalidar referencias/revisión bajo bloqueo justo antes de borrar, conciliar operaciones, ensayar reversa con la versión vigente y tratar por separado originales, consentimiento, SQLite/WAL, temporales, proveedores y copias. Restaurar una copia completa puede reintroducir datos ya olvidados y perder escrituras posteriores: requiere un procedimiento específico, no restauración automática. La conciliación no debe reenviar operaciones inciertas.

## Límites y pendientes de Walter

- Fijar plazos, excepciones, responsable/custodia y tratamiento de la revocación para fotos, voces, consentimiento, mensajes, derivados y copias. Autorizar por separado cualquier borrado real y su alcance remoto.
- El inventario es local y acotado a las familias anteriores: no cubre contenido en n8n, proveedores, historial remoto, directorios temporales, generaciones de copias, ni todos los registros de auditoría/gasto del esquema. No certifica borrado físico, recuperación de espacio ni cumplimiento de una política todavía inexistente.
- Bytes conocidos: tamaño declarado de adjuntos, bytes de mensajes/resúmenes y base64 de vistas; no son espacio recuperable ni tamaño total de SQLite. Tampoco se identifica una duplicación por contenido.
- Sin fechas/procedencia históricas no se puede prometer clasificación completa de originales/derivados huérfanos. Nuevos campos de referencia o migraciones deben incorporarse a esta proyección antes de confiar en sus candidatos. No se introdujo otra base ni una migración de reconstrucción ficticia.

Fuentes oficiales consultadas antes de implementar (21-11-2026): [better-sqlite3: opciones, transacciones y backup](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md), [SQLite query_only](https://www.sqlite.org/pragma.html#pragma_query_only) y [extracción JSON](https://www.sqlite.org/json1.html). No se incorporó ninguna API externa.
