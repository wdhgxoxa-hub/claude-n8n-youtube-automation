# Imagen 22ece8e: construcción y aceptación operativa

Fecha: 2026-11-21 15:59 (Lima). Frente operación de `cooper-total`.

**Construida, ensayada y trasladada al VPS; no cargada ni activada.** La imagen nueva incorpora la corrección de memoria de H19 de la fuente exacta `22ece8e1f078b149944118feeabbb6c803992ff4`. Superó migración/reversa 11→13 con 1 GiB y swap cero, los ocho bloques Compose bajo el mismo límite y el aplicador exacto de infraestructura con fallo deliberado, recuperación y actualización posterior. La puerta completa, las dos rondas secuenciales y la revisión visual corresponden a raíz y todavía no se declaran terminadas aquí.

## Identidad y procedencia

| Campo | Valor |
|---|---|
| Fuente y etiqueta canónica | `22ece8e1f078b149944118feeabbb6c803992ff4` / `localhost/cooper:22ece8e1f078b149944118feeabbb6c803992ff4` |
| ID de configuración | `sha256:160671f7218a412ddeade2a0ed5d634b33772be3057e14f6d50cef70395e4159` |
| Archivo | 269.723.823 bytes |
| SHA-256 del archivo | `02bb9b4d27d1fdeddc6ed62492a7021c033618d1b66efd4f5ad5e7057b9eb6a7` |
| Formato y healthcheck | Docker; `HEALTHCHECK` presente |
| Migraciones | 13, sin nuevas migraciones respecto a `bfd5e79` |
| Construcción | CPU 0–1; cero advertencias |

[Manifiesto exacto](evidencias/total-imagen-22ece8e/imagen-final.json) con objetos Git de producto, hash de archivo de fuentes y log de construcción; [construcción](evidencias/total-imagen-22ece8e/construccion.log). La etiqueta completa coincide en archivo, ensayos y recibo del aplicador. Se validaron los metadatos públicos del archivo sin interpretar su entorno.

El manifiesto vigente `evidencias/cooper-total/imagen-final.json` se actualiza. El anterior de `bfd5e79` queda preservado íntegro en `evidencias/cooper-total/imagenes/bfd5e79283bdd2c571937a9f30d8ff512015430f/imagen-final.json`; sus demás recibos históricos permanecen intactos y no se atribuyen a esta imagen.

## Pruebas del artefacto

1. [Clon completo](evidencias/total-imagen-22ece8e/clon-completo.json) preparado desde el snapshot `38b362…`, con manifiesto y WAL de ambas bases verificados. No se trasladó un SQLite incompleto ni se leyó una base viva.
2. [Migración/reversa](evidencias/total-imagen-22ece8e/migracion.json): 11→13, 27 tablas anteriores conservadas, integridad/claves foráneas correctas y arranque de la imagen anterior. `memory.max=1073741824`, `memory.swap.max=0` comprobados; red/puertos ausentes. Respaldo autónomo SHA-256 `46fe24a5d662514d9915780a2b11c9cbfb5e3b7e8fd34302a72ad8f91c032cfa`.
3. [Ocho bloques Compose](evidencias/total-imagen-22ece8e/compose.log), exit 0: salud/TLS/cabeceras/acceso, login ficticio, Marcas JPEG/reel con audio y firmas, runner 2.47.6 y callback firmado, SSE/reconexiones, restic/restauración/reinicio, exportación/importación y actualización/reversa de estado. El kernel confirmó 1 GiB sin swap para Cooper. No hubo OAuth, proveedores de pago ni publicación real.
4. [Aplicador exacto](evidencias/total-imagen-22ece8e/infra-resultado.json): [fallo provocado y reversión](evidencias/total-imagen-22ece8e/infra-fallo-inyectado.json) con archivos/datos recuperados; [aplicación posterior](evidencias/total-imagen-22ece8e/infra-actualizacion.json) con salud y preservación PASS. Archivo, tag e ID de Cooper coinciden con la imagen construida.

El aplicador permanece en SHA-256 `9273e7d6e60114948ec7413dfbe92bbf2311cbbe1ff0879fb5d4706e8c5738cd` y Operator en `5331274f0b37214e9c486d2d68b291c20580ad41e02523b99967798bdc59d56b`. Se conservan los archivos públicos ya aceptados: Compose `b3071fc8…edb7`, Caddy `17515ce1…153c`, runner `1ab00c49…6712` y manifiesto `51ad012e…c5a3`. [Contrato completo](evidencias/total-imagen-22ece8e/infra-ensayo.json).

El certificado n8n 2.47.6/reversa 2.47.4 sigue correspondiendo al corte de **45 workflows/nueve tablas/146 filas**, independiente del cambio de Cooper. No se presenta como una nueva copia del estado vivo. La configuración de producción no recibió cambios de memoria/swap.

La primera invocación del arnés de infraestructura omitió `COOPER_LAB=1` explícito y fue rechazada antes de leer configuración o arrancar servicios. [Rechazo conservado](evidencias/total-imagen-22ece8e/intento-previo.json). Se repitió correctamente; la ejecución aceptada terminó sin advertencias ni cambios de umbrales.

## Traslado y siguiente paso

[Transferencia verificada](evidencias/total-imagen-22ece8e/traslado-vps.json) a `/var/lib/cooper-operacion/imagen-22ece8e1f078b149944118feeabbb6c803992ff4.tar.gz`, escritura privada y promoción del archivo tras comparar tamaño/SHA. No se ejecutó `load`, actualización de aplicación ni recreación de servicios en el VPS.

Artefacto local: `/home/david/.cache/cooper-final4/.cache/aceptacion/imagen.tar.gz`. El paquete público de aplicación se preparó en `cooper/.cache/aceptacion/bundle-infra-22ece8e/`, validado contra el recibo; no incluye entorno, credenciales ni bytecode. Su traslado/instalación queda para el turno autorizado de activación.

Commits relevantes: `22ece8e` fija el producto corregido; `5a581e8` agregó la comprobación de 1 GiB sin swap en los arneses. Este commit registra la construcción y los ensayos del nuevo artefacto. No se repitieron navegadores ni se modificó código de producto en este frente.

## Limitaciones y pendientes de Walter

El VPS continúa en su versión anterior hasta completar puerta, dos rondas y revisión visual. Entonces hará falta una copia fresca, actualizar Cooper, configurar el secreto worker de Marcas opacamente con precondiciones, aplicar infraestructura, verificar el arranque final y repetir copia/réplica/restauración y aceptación pública. El caso H19 exhaustivo y sus límites los documenta competencia; estos ocho bloques no lo sustituyen.

Ninguna decisión nueva de Walter bloquea esos pasos técnicos ya autorizados. Se conservan los pendientes de sesión Google legítima, proveedores y aprobación humana de publicaciones. La réplica fuera del VPS continúa dependiendo de la PC.
