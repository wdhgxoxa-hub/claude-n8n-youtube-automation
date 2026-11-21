# Rendimiento de medios y propuesta de Caddy

21 de noviembre de 2026 (Lima). Misión `total-rendimiento`. Cambios de interfaz implementados en la rama; propuesta de proxy pendiente de aplicación. No se accedió al VPS, no se leyó configuración real ni se modificó `deploy/Caddyfile`.

## Medios de la aplicación

`public/` contiene cuatro dibujos SVG y cuatro animaciones JSON originales, sin fotografías, GIF ni videos decorativos. El inventario mide **75.069 bytes originales / 8.197 bytes gzip**, calculados archivo a archivo con `node:zlib`; esto es potencial de compresión, no tráfico observado en el VPS. Los dibujos conservan su formato vectorial: convertirlos en AVIF/WebP aumentaría la dependencia de resolución sin un ahorro demostrado. El motor Lottie continúa diferido al viewport y sus posters conservan tamaño reservado.

| Activo | Original, bytes | Gzip, bytes |
| --- | ---: | ---: |
| cooper-celebra.json | 19.956 | 1.649 |
| cooper-celebra.svg | 3.043 | 795 |
| cooper-reacciona.json | 12.401 | 1.265 |
| cooper-reacciona.svg | 2.629 | 767 |
| cooper-recibe.json | 12.396 | 1.247 |
| cooper-recibe.svg | 2.629 | 767 |
| fabrica.json | 18.762 | 1.125 |
| fabrica.svg | 3.253 | 582 |

Desde `7aab905`, el poster de bienvenida se incluye como una URL `data:` cuando `IlustracionViva` recibe `prioritaria` y el dibujo es `cooper-recibe`. `scripts/generar-movimiento.mjs` produce `src/marca/poster-bienvenida.ts` a partir del mismo SVG original de **2.629 bytes**: conserva el dibujo, sus dimensiones y la animación posterior. Así, la primera presentación del dibujo no espera otra solicitud HTTP; el motor Lottie sigue esperando su decodificación y la entrada al viewport. La estabilidad de la primera presentación se completa en `e8968d7`, conservando la coreografía durante la navegación interna. Su efecto sobre LCP se contrasta en la matriz Lighthouse final, no en el ensayo de descargas de JPEG/MP4 de abajo.

Esta decisión añade la URL codificada de **4.460 bytes antes de compresión** al JavaScript que importa el componente y al HTML de las instancias prioritarias; la URL `data:` no tiene una entrada independiente en la caché HTTP. Es el tamaño de la cadena generada, no una medición del incremento exacto del bundle minificado o del documento comprimido. El archivo público `cooper-recibe.svg` y los otros siete activos **no cambian**. Las instancias sin prioridad y los demás dibujos conservan la URL pública, la carga diferida cuando corresponde y la revalidación habitual del SVG. La propuesta de Caddy sigue cubriendo esos archivos públicos; el dibujo incluido en HTML/JS se comprime con su documento o bundle.

Las imágenes del perfil, los adjuntos, las fotografías de avatares y las piezas de Marcas usan `next/image`, dimensiones o contenedor reservado, y carga diferida predeterminada. Se mantiene `unoptimized`: el optimizador de Next no reenvía cabeceras de autenticación y los endpoints privados comprueban dueño/sesión en cada descarga. No se amplía una caché pública para estos recursos. [Documentación oficial de Image](https://nextjs.org/docs/app/api-reference/components/image).

Cambios del frente:

- El montaje con miniatura conserva el poster y pasa de `preload="metadata"` a `preload="none"`; el archivo llega al pulsar reproducir. Cuando no hay miniatura se conserva `metadata` para poder mostrar el primer fotograma. Los clips por escena reutilizan su imagen como poster y mantienen `none`.
- Marcas monta su galería únicamente mientras «Vista previa de la pieza» está abierta. Cerrarla desmonta el reproductor y detiene la reproducción; abrirla vuelve a ofrecer los controles. Los reels usan `preload="none"`, `playsInline` y proporción 720×1280 reservada.
- Los previews de catálogo de avatares solo se montan al solicitarlos; las voces y avatares propios conservan `preload="none"`. Los reproductores de YouTube/TikTok mantienen `loading="lazy"`.

El coste de `metadata` depende del archivo y del navegador. `preload` es una sugerencia; las E2E comprueban solicitudes y reproducción en Chromium, sin afirmar equivalencia con Safari o un teléfono físico. El montaje sin miniatura conserva el comportamiento anterior. [Guía oficial de video](https://web.dev/learn/performance/video-performance).

Marcas produce originales JPEG de 1080×1350/1920, calidad 90, y MP4 H.264/AAC de 720×1280, 25 fps, con `+faststart`. Son archivos destinados a revisión y publicación, por lo que no se modifica su formato ni calidad para mejorar una puntuación de la web. Los proveedores externos entregan sus propios formatos; no se descargaron medios privados ni se generaron trabajos pagos. Una futura variante de vista previa WebP/AVIF, con tamaño limitado y autorización por dueño, requiere contrato de variantes y medición de almacenamiento/CPU. No queda implementada por este frente.

### Ensayo reproducible de descargas

Desde `cooper/`, después de construir la revisión correspondiente:

```bash
node scripts/rendimiento-medios.mjs antes
# Construir los cambios de esta misión antes de la segunda ejecución.
node scripts/rendimiento-medios.mjs despues
```

El script arranca `e2e-server.mjs` en puertos libres, crea una base y una sesión efímeras, usa los proveedores simulados y genera un JPEG/MP4 ficticios mediante el renderizador existente. Mide solicitudes y bytes de red con CDP, caché del navegador desactivada y 1,2 segundos de reposo antes de reproducir. Comprueba tanto la espera como la reproducción posterior. Los resultados quedan en `cooper/.cache/rendimiento/medios/{antes,despues}/resumen.json`; el inventario de SVG/JSON forma parte del mismo resumen. Las E2E de `resultados.spec.ts` y `marcas.spec.ts` también verifican que no se descargue video antes de reproducir ni medios de una galería cerrada.

**Resultados finales medidos el 21-11-2026 a las 13:20 y 14:27 de Lima**, Chromium 159.0.8154.6, sin otras auditorías simultáneas. El segundo ensayo usa el build `4Xi4psM4kl7xfruXnnLzq`, código `7aab905`; ambos finalizan con salida 0. Los archivos sintéticos mantienen exactamente el mismo tamaño: JPEG **39.889 bytes** y MP4 **18.666 bytes**. La columna de tráfico incluye las cabeceras HTTP que cuenta CDP.

| Momento observado | Solicitudes antes → después | Bytes de red antes → después |
| --- | ---: | ---: |
| Montaje con poster, sin pulsar reproducir | 2 → 1 | 59.676 → 40.450 |
| Montaje reproduciéndose | 2 → 2 | 59.676 → 59.676 |
| Galerías de Marcas cerradas | 1 → 0 | 19.226 → 0 |
| Galerías abiertas, sin pulsar reproducir | 2 → 1 | 59.676 → 40.450 |
| Reel de Marcas reproduciéndose | 2 → 2 | 59.676 → 59.676 |

En este fixture el montaje y la galería abierta evitan **19.226 bytes iniciales (32,2%)**; las galerías cerradas evitan toda su transferencia inicial. El montaje pasa de `readyState=4` a `readyState=0` antes de reproducir, demostrando que la descarga del MP4 se difiere. Al reproducir, ambos reproductores avanzan más de 0,1 s y descargan el mismo contenido que antes. Marcas pasa de dos elementos multimedia ocultos a ninguno. El ahorro real depende de los archivos que se produzcan; estas cifras no estiman el tamaño de medios privados ni miden ancho de banda del VPS.

## Situación de Caddy y caché

La referencia versionada usa `caddy:2.11.2-alpine`, HTTPS, límites de cuerpo, sin registro de consultas/cuerpos, y proxy con `flush_interval -1` y `stream_close_delay 5m`. No contiene `encode`. Eso **no implica que Cooper se sirva sin compresión**: `next start` comprime HTML y estáticos con gzip por defecto. Se debe medir `Content-Encoding` en la instalación concreta antes de atribuirle un ahorro. [Next: compress](https://nextjs.org/docs/app/api-reference/config/next-config-js/compress).

Se intentó una lectura pública `HEAD https://cooperestudio.com/entrar`, limitada a estado, Content-Type, Cache-Control, Content-Encoding, Vary y Server. La resolución DNS de este entorno falló antes de establecer conexión. Por ello no se afirma ninguna cabecera ni rendimiento de la instancia viva.

| Recurso | Política propuesta |
| --- | --- |
| `/_next/static/*` | Conservar `Cache-Control` de Next para archivos con hash: público, un año e immutable. No sustituir cabeceras de errores por immutable. |
| `/movimiento/*` | Conservar ETag y `public, max-age=0` de Next; revalidar al reutilizar. Los nombres no llevan hash y cambian entre despliegues. |
| HTML/RSC, `/api/*`, perfil, adjuntos y muestras | Conservar `private`/`no-store` del origen. No instalar caché compartida ni convertir respuestas autenticadas en públicas. |
| SSE de `/api/eventos` y `/api/chat` | Conservar `no-store`, flujo inmediato y exclusión del nuevo `encode`. |
| MP4/WebM, JPEG/WebP/AVIF, WOFF2 | No volver a comprimir: ya son formatos comprimidos y los videos necesitan conservar semántica de rangos. |

Next documenta por qué los archivos de `public/` no tienen caché prolongada por defecto. Los SVG/JSON podrían pasar a nombres con hash de contenido en otro cambio coordinado entre generador y consumidor; solo entonces sería correcto asignarles un año e immutable. [Next: public](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder).

## Propuesta revisable, sin aplicar

Reemplazar únicamente el bloque del dominio de Cooper por este bloque, conservando los bloques de seguridad y n8n existentes. La rama de estáticos solicita contenido sin comprimir al origen para permitir negociación zstd/gzip en Caddy; el resto conserva exactamente la ruta de streaming existente.

```caddyfile
{$COOPER_DOMAIN} {
	import seguridad
	request_body {
		max_size 9MB
	}
	@publicos path /_next/static/* /movimiento/*
	handle @publicos {
		encode zstd gzip {
			minimum_length 512
			match {
				header Content-Type application/javascript*
				header Content-Type text/javascript*
				header Content-Type text/css*
				header Content-Type application/json*
				header Content-Type image/svg+xml*
			}
		}
		reverse_proxy cooper:3000 {
			header_up -X-Forwarded-Port
			header_up Accept-Encoding identity
			transport http {
				compression off
				dial_timeout 5s
				response_header_timeout 35s
			}
		}
	}
	handle {
		reverse_proxy cooper:3000 {
			flush_interval -1
			stream_close_delay 5m
			header_up -X-Forwarded-Port
			transport http {
				dial_timeout 5s
				response_header_timeout 35s
			}
		}
	}
}
```

La propuesta usa módulos estándar, no habilita una caché de respuestas en Caddy y no cambia `compress` en Next. No hay doble compresión: en la rama pública el origen recibe `Accept-Encoding: identity`; fuera de ella sigue atendiendo Next. La lista de MIME excluye SSE aunque una ruta mal configurada lo devolviera. Caddy administra `Vary: Accept-Encoding` y los validadores de las respuestas que comprime. La documentación actual describe además cambios posteriores a 2.11.2; esta propuesta no depende de sus mejoras de streaming. [Caddy encode](https://caddyserver.com/docs/caddyfile/directives/encode), [proxy y streaming](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

El bloque propuesto y el fragmento `seguridad` se validaron con `caddy validate` en la imagen local 2.11.2, `--network=none`, dominios ficticios y TLS interna: **Valid configuration, salida 0, sin advertencias**. Evidencia: `cooper/.cache/rendimiento/caddy/validacion-bloque.log`. Validar la plantilla completa también acepta la configuración, pero avisa que su listener HTTP de redirección no recibe HTTPS automático; ese listener ya existe y no pertenece al cambio. La validación no comprueba rendimiento, DNS, certificados ni conectividad del VPS.

Antes de una aplicación autorizada: validar el bloque en la versión elegida de Caddy, medir un asset con `identity`/`gzip`/`zstd`, verificar que el segundo acceso a un chunk con hash usa caché y que un SVG mutable se revalida, comprobar que los errores no quedan cacheados y repetir sesión, descarga privada y SSE por el proxy. El despliegue y su reversa requieren una misión autorizada; esta entrega no reinicia contenedores ni modifica el VPS.

## Pendientes de Walter

1. Revisar y autorizar por separado la aplicación de esta propuesta de Caddy; decidir con el operador la versión exacta que se desplegará.
2. Aceptar reproducción, pausa al cerrar y reconexión SSE en un teléfono físico de gama media y Safari, si forma parte del uso real.
3. Si los medios reales resultan pesados, priorizar variantes de vista previa privadas y su retención. Requieren medición con material autorizado; no se estima un ahorro sobre archivos que esta misión no ha leído.
