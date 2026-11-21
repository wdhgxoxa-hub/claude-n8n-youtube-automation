# Marcas simuladas: activación remota verificada

21-11-2026, 18:54 Lima. **PASS** después del lote n8n y del extra de horario Radar, con un único escritor coordinado. La preparación verificó proveedor `simulada`, interruptor habilitado, secreto disponible sin exponerlo, cola vacía y CAS posterior a Radar. Solo se publicaron `CooperMarcasPub1` y `CooperMarcasMet1`; no se importaron definiciones ni se modificaron runtime, entorno o imagen.

## Evidencia

- Preparación: `/var/lib/cooper-operacion/total-cierre-marcas-preparado.json`, SHA-256 `b57bb895a4dd7c0597a7e9bdc09b7ed445b9a2cdd5d863e7d501a2e38ccaa74a`.
- Activación: `/var/lib/cooper-operacion/total-cierre-marcas-activado.json`, SHA-256 `afaa6bf2ada46f8b579186e415d54735e3d09f0123fb6615eb5a86b9596c1890`.
- Snapshot previo creado, restaurado y verificado antes de publicar: `ed1524351b3cd2b974c69d41b486c16299d469e4defc603f78fe0bec2052d21a`.
- [Verificación independiente](aplicacion.json): cuatro disparadores `activated`, sin error y con la versión publicada correcta; 45 workflows, 31 activos y 15 credenciales contadas sin valores; 43 workflows ajenos, tablas de negocio, identidades y configuración pública preservados; siete servicios `healthy`; mantenimiento retirado y las tres colas de Marcas vacías.
- Helper sin cambios, SHA-256 `4bfdb6c789461661ac2246325f1a067ab0a15d38b59093fd1d29c6982f8cfd20`. La publicación y la reversa usan la CLI oficial individual por ID.

## Conciliación exacta de las fuentes

La primera preparación se detuvo antes de mutar por diferencia de contrato. El [diagnóstico estructural](diagnostico-fuentes.json) identificó un único delta en cada worker: el lote integrado conserva `Reloj.disabled=false` explícito y las fuentes canónicas omiten ese campo. Ambos representan el reloj habilitado, pero el CAS exige contenido exacto.

Se derivaron dos fuentes públicas desde las canónicas añadiendo únicamente ese `false` booleano. Se mantuvieron intactos helper, bundle, fuentes canónicas y definición viva. [La evidencia focal](fuentes-normalizadas.json) registra hashes anteriores/derivados, contrato exacto aceptado y rechazo de la fuente no conciliada y de `true`, cadena `"false"` y `null`: cinco comprobaciones PASS. Retirar el campo añadido reproduce exactamente cada JSON canónico. Las fuentes conciliadas se transfirieron a `extra-marcas/fuentes-lote` y sus hashes remotos coincidieron antes de repetir únicamente la preparación afectada.

## Reversa y límites observados

El extra ya cuenta con ensayo local real de publicación, reloj de cinco minutos, POST HMAC 200 y despublicación/reversa, además de las pruebas focales y la regresión combinada aprobada de 269 pruebas. No se repitió ese ensayo de producto en producción. La reversa preserva contenido, versión y los 43 ajenos; el contador oficial de publicación puede avanzar. Si fuera necesaria, el orden es **Marcas → Radar → lote** y cada fase exige su recibo y CAS exactos, sin forzar estados posteriores ni punteros globales.

El recibo de activación admite el comando `revertir` del mismo helper con su SHA explícito y una salida nueva; cualquier cambio posterior de fase o metadata debe conciliarse antes de usarlo. La reversa automática ante fallo y la restauración del snapshot previo estaban acreditadas; no se ejecutó una reversa remota posterior a este PASS.

Los horarios quedaron publicados: publicación simulada cada cinco minutos y métricas cada hora. Se observaron los cuatro disparadores registrados y sanos; no se esperó el siguiente ciclo de producción ni la ventana horaria de métricas. No hubo seeds, ejecución manual de negocio, OAuth, pagos ni publicaciones reales en redes. Los valores de credenciales y de archivos `.env` no se leyeron, imprimieron ni copiaron; el adaptador existente consumió la configuración de forma opaca para sus guardas.

Escritura VPS liberada al coordinador a las 18:54 Lima para la copia final. Sin pendientes técnicos nuevos de esta fase ni decisiones adicionales de Walter.
