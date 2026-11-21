# cooper-total — infraestructura corregida

Frente `total-infra-segura`, base `233aafd`. Evidencia cerrada el 21-11-2026, 11:59 Lima. Implementado y probado localmente; pendiente de integración y aplicación coordinada por el orquestador. Este frente no modificó el VPS.

## Commits

- `afb6b69`: n8n/runner 2.47.6 y Caddy 2.11.8 por digest oficial; registro de imágenes anteriores, arnés Compose a 0,5 CPU por servicio y prueba del perímetro con Caddy nuevo.
- `d0f5e5a`: ensayo del motor sobre copia SQLite, aplicador conjunto con snapshot/reversa de datos y archivos, y pruebas de fallos.
- `6b9b4e0`: validación limitada a referencias públicas mediante `compose config --images`, Caddy al final con `--no-deps`, y hash del código en los recibos.

## Resultado probado

- **88 pruebas Python** pasan con `-W error`, sin advertencias. Incluyen ejecución pendiente que impide cortar, candidato alterado, compatibilidad motor/runner, recuperación de bytes SQLite y archivos tras fallo, y mantenimiento conservado cuando falla también la reversa. [Log](evidencias/total-infra-segura/python-final.log).
- **Ocho bloques Compose** pasan con la imagen Cooper `970d102` ya aprobada y los tres digests nuevos: TLS/editor privado, login ficticio, medios sintéticos Marcas, runner/firma/SSE, reconexiones, restic cifrado, volumen vacío y actualización/reversa. [Log](evidencias/total-infra-segura/compose.log).
- **Motor sobre clon real FINAL3:** 342→342 migraciones, 36 workflows y nueve tablas/118 filas conservados; segundo arranque CLI idempotente; recuperación exacta y CLI anterior 2.47.4 pasan. No hubo red, puertos, triggers ni extracción de credenciales. [Recibo](evidencias/total-infra-segura/motor.json).
- **Aplicador real en fixture aislado:** se arrancaron las imágenes anteriores, se aplicaron las nuevas y se inyectó un fallo posterior al arranque. Restauró primero las configuraciones, luego todos los datos mediante restic con verificación de manifiesto, volvió a las imágenes anteriores saludables y retiró mantenimiento. La segunda aplicación terminó `PASS`. [Reversa](evidencias/total-infra-segura/fallo-inyectado.json), [actualización](evidencias/total-infra-segura/actualizacion.json) y [resultado conjunto](evidencias/total-infra-segura/resultado.json).
- Código exacto del aplicador ensayado: SHA256 `3dead5c4c526a4c814a7f4d4c09c85d153c10ee43b79db5995f6c51242e46cd0`; Operator `5331274f0b37214e9c486d2d68b291c20580ad41e02523b99967798bdc59d56b`. El ensayo final incluye la corrección `6b9b4e0`; no se usa el recibo preliminar anterior a esa revisión.
- El Caddyfile candidato tiene SHA256 `17515ce1927fa921b8f3f7242c2e3cfe024b24b99b8b6e9874e9d1e1f442153c`, igual al arreglo del perímetro ya aplicado por el orquestador. El aplicador respalda la configuración real que encuentre al corte, no una versión histórica.

La puerta completa de Cooper `970d102` fue confirmada por el orquestador: instalación, lint, tipos, 322 unitarias, 49 E2E, build y 167 pruebas de flujos sin errores/advertencias. Este parche no modifica producto, compilación Cooper ni migraciones web. Las rondas integradas de producto y cualquier versión posterior siguen bajo control del orquestador.

## Aplicación y recuperación

El [procedimiento](../cooper-infra-actualizacion.md) exige imágenes precargadas, candidato separado, recibo ligado a hashes, misma imagen Cooper aceptada, stack saludable y ausencia de ejecuciones n8n en marcha. Usa el candado de operación y snapshot frío con restauración comprobada. Conserva `.env` fuera de los archivos copiados y no serializa el entorno efectivo. Recrea relays junto a sus namespaces y abre Caddy al final.

Los digests exactos y las referencias anteriores están en [infra-imagenes.json](../../deploy/infra-imagenes.json). El [recibo de aceptación](evidencias/total-infra-segura/ensayo.json) vincula los cuatro archivos públicos, las imágenes y el ensayo del motor. El paquete mantiene Cooper sin cambios.

## Limitaciones reales y Pendientes de Walter

1. **Pendiente técnico del orquestador:** repetir el ensayo del motor con una copia reciente después de las sondas de Aprendizaje/Competencia. El clon ensayado tiene 36 workflows y precede al monitor y a los subflujos temporales recientes. El aplicador también compara el inventario real del corte, pero ese control no se presenta como un ensayo previo de la copia más reciente.
2. **Pendiente técnico del orquestador:** instalar/aplicar el candidato y comprobar el conjunto real, en turno exclusivo. No se actualizaron imágenes ni servicios del VPS desde este frente. No se declara cerrado el riesgo del servidor mientras conserve las versiones antiguas.
3. El ensayo no escanea todas las dependencias del sistema operativo ni certifica ausencia de otras vulnerabilidades. Corrige las versiones identificadas; la reversa a imágenes antiguas recupera disponibilidad y reabre sus avisos conocidos.
4. Si cambia la imagen Cooper después de la congelación `970d102`, debe repetirse la aceptación correspondiente y emitir un recibo con la nueva identidad. No reconstruir o retaggear silenciosamente el artefacto aprobado.
5. No hay cuentas, pagos ni decisiones nuevas de Walter para este parche técnico. Continúan los pendientes previos de OAuth, permisos de proveedores y aprobación humana de publicaciones; el parche no los activa.

Fuentes oficiales: [aviso n8n y versión corregida](https://github.com/n8n-io/n8n/security/advisories/GHSA-q8rc-7m84-mfvj), [Caddy 2.11.8](https://github.com/caddyserver/caddy/releases/tag/v2.11.8), [pareja de versiones de runners](https://docs.n8n.io/deploy/host-n8n/configure-n8n/set-up-task-runners.md) y [CLI n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md).
