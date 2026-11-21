# Actualizar n8n, runner y Caddy juntos

Procedimiento de `total-infra-segura`. Usar una ventana exclusiva del orquestador. El aplicador modifica únicamente cuatro archivos públicos y las versiones de infraestructura; exige que Cooper conserve la misma imagen que superó la aceptación. No configura proveedores ni publica workflows.

## Candidato y evidencia

`deploy/infra-imagenes.json` registra las imágenes nuevas y las anteriores por digest, para Linux amd64. n8n y runner deben compartir versión. La referencia actual es n8n/runner 2.47.6 y Caddy 2.11.8; las anteriores son 2.47.4 y 2.11.2. Se conservan para recuperación de disponibilidad, aunque tienen los avisos que motivan el cambio.

La aceptación requiere tres pruebas separadas:

1. `COOPER_VPS_TEST_IMAGE=<Cooper aprobado> node deploy/tests/compose.mjs`: ocho bloques con red interna, TLS, login ficticio, medios sintéticos, runner/firma/SSE, restic y recuperación. Cada servicio del ensayo está limitado a 0,5 CPU.
2. `python3 deploy/ensayar-motor-n8n.py --base <SQLite de copia restaurada> --salida <directorio nuevo>`: CLI oficial nuevo dos veces, inventario/hash de negocio e idempotencia; restaura los bytes anteriores y prueba el CLI antiguo. Usa red `none`, 0,5 CPU, clave ficticia y exportación a `/dev/null`; no arranca triggers ni exporta credenciales.
3. `COOPER_LAB=1 python3 deploy/tests/infra-aplicador.py --fixture <carpeta e2e-vps>/ensayo.env --ensayo <recibo> --imagen-archivo <imagen.tar.gz>`: únicamente desde un checkout corto bajo `~/.cache`, rootless y sobre el fixture ficticio de la primera prueba. Arranca las versiones anteriores, aplica las nuevas, inyecta fallo, comprueba reversa de archivos/datos/versiones y vuelve a aplicar con éxito. No renderiza ni consulta proveedores. Conserva recibos con hashes del código ensayado.

El recibo de aceptación contiene `estado: PASS`, ocho bloques Compose, hashes SHA256 de `compose.yaml`, `Caddyfile`, `n8n-task-runners.json` e `infra-imagenes.json`, referencias de imágenes, identidad de configuración de Cooper (`cooper_image_id`), `cooper_artefacto: {"sha256": "<hash del archivo>", "etiqueta": "localhost/cooper:<fuente>"}` y resultado del ensayo del motor. Es un registro operativo de las pruebas, no una firma de un tercero. Cualquier cambio en esos cuatro archivos o en Cooper obliga a repetir la aceptación correspondiente y emitir otro recibo.

La etiqueta y el archivo deben ser los mismos de la aceptación. Se verifica el SHA del archivo y el hash de sus bytes de configuración; nunca se interpreta `Config.Env`. Docker/containerd puede devolver el digest del manifiesto donde Podman devuelve el de configuración. En ese caso se exporta únicamente la imagen pública activa y se prueba el enlace índice → manifiesto verificado → configuración ensayada. No se exporta el contenedor ni se acepta solo la etiqueta. El fixture de Compose puede terminar con un alias temporal de reversa: el arnés acredita ambos IDs antes de fijar su etiqueta final.

Para aislar recursos frente a las rondas de interfaz, los tres ensayos admiten `COOPER_ENSAYO_CPUSET` con un rango coordinado (por ejemplo, `0-7`); conservan la cuota de 0,5 CPU. Usar rutas absolutas del fixture y del recibo al ejecutar el arnés.

## Preparar el corte

- Instalar los helpers del commit aprobado en `/opt/cooper/deploy/`: `aplicar-infra.py`, `ensayar-motor-n8n.py` y `ensayar-n8n.py`; conservar el `operar.py` integrado y revisado. No reemplazar los archivos de configuración activos en esta fase.
- Preparar fuera de `/opt/cooper/deploy/` una carpeta privada de candidato con los cuatro archivos públicos exactos, y el recibo aprobado por separado. No copiar `.env`, claves, tokens, certificados ni credenciales a esa carpeta.
- Conservar el archivo público exacto de Cooper ligado al recibo y comprobar su SHA después del transporte. No reutilizar un recibo de una imagen intermedia.
- Precargar las seis referencias nuevas/anteriores de `infra-imagenes.json` o confirmar que ya existen. El aplicador usa `image inspect` antes de parar servicios; no descarga imágenes durante el corte ni usa `latest`.
- Confirmar el turno exclusivo, stack saludable y ninguna ejecución n8n `new`/`running`. Las esperas históricas permanecen intactas. Mantener la configuración de Marcas simulada y los workers inactivos, según su procedimiento independiente.
- Si la base ha avanzado desde el ensayo, usar una copia reciente para repetir el ensayo de motor. El aplicador compara todos los workflows y tablas de negocio reales del corte antes/después, incluidos los que no existían en el clon de aceptación.

## Aplicar

```bash
sudo python3 /opt/cooper/deploy/aplicar-infra.py \
  --candidato /var/lib/cooper-operacion/candidato-infra \
  --ensayo /var/lib/cooper-operacion/ensayo-infra.json \
  --imagen-archivo /var/lib/cooper-operacion/imagen-aprobada.tar.gz \
  --salida /var/lib/cooper-operacion/resultado-infra.json
```

El recibo de salida debe ser nuevo. El script toma el mismo candado que las copias, rechaza mantenimiento pendiente y verifica hashes, versión anterior ensayada, identidad de Cooper e imágenes precargadas. Compose se consulta con `config --images`: solo devuelve referencias públicas, nunca un entorno efectivo serializado.

Antes del corte registra los archivos **actualmente instalados**, sus hashes y las imágenes reales. Así conserva el arreglo vigente del perímetro Caddy; no vuelve a una versión de configuración histórica. Después crea snapshot frío con restauración comprobada, confirma que no quedaron ejecuciones en marcha, instala el candidato e inicializa n8n mediante CLI sin arrancar triggers. Compara inventarios y filas de negocio. Recrea Cooper/n8n/runner y los relays que existan, y abre Caddy al final con `--no-deps` para preservar los namespaces ya recreados. Solo al comprobar salud e imágenes escribe `PASS` y retira mantenimiento.

## Fallo y recuperación

Ante un fallo, detiene los servicios y restaura primero los cuatro archivos públicos originales. Recupera el snapshot en un directorio nuevo, archiva los datos del intento, copia los datos comprobados al volumen activo y verifica nuevamente el manifiesto. Reaplica ownership, recrea las versiones anteriores y exige salud e identidad exacta de todas las imágenes. Entonces registra `FALLO_REVERTIDO`, `reversion: PASS` y retira mantenimiento; el proceso sigue devolviendo error para que el operador no confunda reversa con actualización exitosa.

Si falla también la recuperación, el marcador de mantenimiento permanece y no se declara éxito. Conservar el recibo, `/var/lib/cooper-operacion/infra-*/configuracion-anterior`, los datos del intento y el snapshot. No borrar el marcador ni reabrir entradas hasta completar manualmente esa misma secuencia y verificar salud. Si el fallo ocurrió antes de obtener snapshot, se restablecen los archivos y el arranque previo; aún no hubo migración de datos.

La copia del entorno queda fuera de este procedimiento. Sus consumidores existentes pueden usarla en runtime, pero no se imprime ni se incorpora a respaldos de configuración pública. El rollback restaura la disponibilidad; volver a imágenes antiguas no cierra los avisos de seguridad.

Fuentes oficiales consultadas el 21-11-2026: [parche n8n](https://github.com/n8n-io/n8n/security/advisories/GHSA-q8rc-7m84-mfvj), [release n8n 2.47.6](https://github.com/n8n-io/n8n/releases/tag/n8n%402.47.6), [release Caddy 2.11.8](https://github.com/caddyserver/caddy/releases/tag/v2.11.8), [versiones compatibles del runner](https://docs.n8n.io/deploy/host-n8n/configure-n8n/set-up-task-runners.md) y [CLI oficial](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md).

Contrato de identidad contrastado con [Docker/containerd](https://docs.docker.com/engine/storage/containerd/), [inspección Podman](https://docs.podman.io/en/latest/markdown/podman-image-inspect.1.html) y [manifiesto OCI](https://specs.opencontainers.org/image-spec/manifest/).
