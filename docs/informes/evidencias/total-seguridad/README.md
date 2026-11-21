# Evidencia de total-seguridad

21-11-2026, Lima. Datos ficticios para pruebas locales; lecturas remotas
limitadas a configuración pública, versiones, permisos y estados. No se
incluyen valores de credenciales, cuerpos privados ni cookies.

- `puerta/`: ejecución final completa sobre el commit de código indicado en
  `resultado.json`. Cada paso contiene comando, duración, retorno y hash del
  log original. `sha256_versionado` identifica la copia incluida aquí, a la
  que solo se quitaron espacios al final de las líneas y se normalizó el salto
  final. Los logs no se filtraron para ocultar errores o advertencias.
- `intentos-previos.json`: antecedentes de preparación y primera puerta verde;
  no sustituyen la puerta final. Los hashes corresponden a los logs originales
  conservados en `cooper/.cache/total-seguridad/`.
- `rojo.log` y `caddy-rojo.log`: fallos intencionales de regresión contra el
  comportamiento anterior. `verde.log` y `caddy-verde.log`: comprobaciones
  posteriores a las correcciones; la cobertura ampliada está en la puerta final.
- `deploy-tests.log`: 22 pruebas del despliegue, con advertencias Python tratadas
  como errores. `caddy-adaptacion.json` y `herramientas.json`: adaptación local,
  versiones y digest de la imagen pública de Caddy usada, sin red del contenedor.
- `lighthouse-*`: cuatro mediciones locales en temas claro/oscuro y móvil/escritorio.
  Solo es una comprobación del cliente de auditoría y de la portada; no son
  métricas de campo ni una nueva auditoría de todas las pantallas.
- `vps-lectura.json` y `publico.json`: observaciones puntuales del VPS y del
  perímetro, sujetas a cambios de las otras misiones. El GET 404 del puente
  no certifica su bloqueo: véase S04 en el informe.
- `dependencias.json`, `npm-audit.json` y `secretos-metadatos.json`: inventario,
  avisos conocidos y exclusión por nombres. No equivalen a escaneo completo
  de imágenes o de valores secretos incrustados en el historial.

Verificar las copias desde este directorio con `sha256sum -c SHA256SUMS`.
El [informe](../../total-seguridad.md) explica alcance, limitaciones y pendientes.
