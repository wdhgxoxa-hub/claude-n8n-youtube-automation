# Retención — integración de montajes y conciliación

21-11-2026, Lima. Commit `66732be`, integrado localmente en `cooper-total`.

El inventario M06 ahora incluye los bytes almacenados de `montajes_fabrica`, su dueño y fecha, sin recuperar el contenido. Conserva las referencias al video origen y a la revisión exacta elegida por cada pieza de Marcas; una revisión nueva no sustituye la anterior en el inventario. Si falta el video origen, el montaje sigue protegido. También reconoce la ingesta conciliada como `cancelada`: ya no bloquea todos los candidatos del dueño como si continuara descargándose.

Las **26 pruebas de retención** y ESLint pasaron sin advertencias. La regresión nueva comprueba dos revisiones, una pieza publicada, un origen retirado, ausencia de contenido privado en la salida y huella SQLite idéntica antes/después. Se probaron ingestas completas, fallidas y canceladas. Lint, tipos y **437 unitarias** de la integración posterior también pasaron; la puerta final se registra en [cooper-total](cooper-total.md).

## Pendientes de Walter

Se conservan los pendientes de [M06](total-m06.md): política de plazos, excepciones y custodia. No hay ejecutor de borrado, caducidad automática ni purga real. Los bytes inventariados no equivalen a espacio recuperable.
