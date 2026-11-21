# Recuperación tras PASS: revisión del integrador

21-11-2026, Lima. Revisión exclusivamente local y de solo lectura de `total-integrador` en `971ab28ce089696bac268edbf12bbc6ffbc0182e`, cuyo candidato de imagen es `b3e608eec138a03fce419a66954497b8fc2c50ea`. No se editaron ese worktree ni sus procesos. No hubo SSH, ejecución de contenedores ni lectura de entorno o bases reales en este encargo.

## Hallazgo A concreto

El árbol revisado acredita la reversa automática ante un fallo **durante** la aplicación de infraestructura, pero no contiene `deploy/recuperar-infra.py` ni una ruta explícita y ensayada para recuperar una aplicación ya terminada **PASS**. Es un pendiente de Codex; no requiere una decisión de Walter.

| Evidencia en el árbol revisado | Alcance comprobado |
| --- | --- |
| `deploy/aplicar-infra.py:311` | Escribe PASS, retira mantenimiento y retorna. La reversa de configuración/datos está exclusivamente en el `except` que comienza en la línea 315. |
| `deploy/tests/infra-aplicador.py:128` | Inyecta un fallo dentro de `apply`, exige `FALLO_REVERTIDO`, comprueba datos/configuración/imágenes y luego ejecuta otra aplicación PASS en la línea 144. No invoca recuperación después de ese PASS. |
| `docs/informes/total-integrador-operacion-b3.md:22` | Distingue correctamente el fallo inyectado y la segunda aplicación. Su recibo `evidencias/total-integrador-operacion-b3/infra-aplicador.json` declara ese mismo alcance y la adaptación de namespaces del arnés Podman. No constituye prueba de la ruta posterior a PASS. |
| `docs/cooper-operacion.md:72` y `deploy/revertir.sh:3` | La receta genérica llama `Operator.rollback`. En `deploy/operar.py:262`, ese método recupera snapshot y puntero Cooper, pero no restaura los archivos públicos de infraestructura guardados por `aplicar-infra.py`. |

Por tanto, después de cambiar el motor no basta con recomendar `revertir.sh`: restauraría bases anteriores conservando la configuración de motor actual. La secuencia debe identificar primero el recibo de infraestructura concreto y recuperar su configuración y datos juntos; solo después, si corresponde, revertir Cooper mediante su propio puntero. No se ejecutó esa receta genérica ni se alteró el VPS para demostrar el hallazgo: el alcance está explícito en las funciones y pruebas citadas.

## Reutilización de los commits ya preparados

El helper inicial y su receta están en `374ec06` del orquestador (original `fe0f602`); la corrección de identidad de imágenes está en `73cdb65` (original `207c264`). Sus 16 regresiones cubren recibo/huella explícitos, cambios de configuración, referencias mutables, aliases con idéntico ID, ausencia de imágenes, snapshot inválido, conservación de escrituras y punteros, recuperación con contenedores no saludables y mantenimiento en caso de fallo. La aceptación real de cuatro servicios sobre la imagen 22 pertenece al informe de operación; no se atribuye a b3 ni al helper que se adapte ahora.

**No basta con copiar el helper antiguo al integrador.** Hay dos diferencias de contrato acreditadas:

1. **Relés con imágenes anteriores distintas.** `Operator.compose` admite `image_overrides` en `deploy/operar.py:148`. El aplicador guarda `imagenes-reversa.json` y su SHA en `deploy/aplicar-infra.py:271`; `previous_image_overrides`, línea 217, certifica las referencias por servicio. La reversa automática pasa ese archivo a `start` en la línea 329. Después de PASS los relés adoptan la imagen nueva de Cooper, aunque el recibo conserve relés antiguos distintos; el ensayo lo comprueba en `deploy/tests/infra-aplicador.py:147`. El helper antiguo presupone que los relés no cambiaron y no pasa el override al arranque restaurado. Con ese escenario debe rechazar la recuperación; no se puede presentar como compatible.
2. **Identidad de runtime frente a configuración/manifiesto.** `verify_cooper_identity` y `verify_service_identity` enlazan las identidades públicas que pueden diferir entre motores. El recibo conserva `identidad_cooper`, `identidades_anteriores` e `identidades_nuevas`. La adaptación no debe volver a imponer igualdad entre el ID de configuración de la imagen ensayada y el ID de runtime Docker cuando el aplicador ya acreditó su cadena. Tampoco debe aceptar una referencia movida por similitud de texto.

La adaptación mínima asignada a operación debe conservar los controles anteriores y añadir:

- Validación del archivo de overrides dentro del directorio operativo del recibo, sin enlaces, con SHA y contenido exactos; acreditar cada imagen anterior local antes del corte.
- Validación de los contenedores actuales contra las identidades del PASS concreto, incluidos los relés que adoptaron Cooper; mantener las cadenas públicas ya certificadas y el rechazo de deriva.
- Aplicación del override verificado al resolver y arrancar la configuración restaurada, sin descargas, con Caddy al final y comprobación final de los siete IDs anteriores.
- Conservación del snapshot y archivo de las escrituras posteriores, imagen Cooper y punteros `release.json`/`anterior.json`; no cambiar el contrato de mantenimiento por un fallo.
- Regresiones positivas de imágenes mezcladas y del ciclo PASS→recuperación; negativas de override alterado/ausente/fuera de estado, referencias movidas y contenedor actual ajeno. Ensayo del helper exacto y de la nueva imagen antes de atribuir aceptación real.

Operación implementará esa adaptación en una rama/worktree propios desde el integrador. Este informe no duplica su código ni autoriza una mutación remota.

## Arnés Docker conservado, sin ejecución remota

Commit `a82e78e`: `deploy/tests/infra-recuperacion-docker.py` y sus pruebas. Es código reutilizable preparado para el contrato antiguo, **no una aceptación Docker y no compatibilidad automática con b3**. La ejecución se suspendió al detectar el aviso de coordinación de la otra sesión. No debe ejecutarse contra el candidato nuevo sin adaptar y volver a certificar sus contratos.

El arnés genera entorno, secretos ficticios y bases vacías dentro de una raíz nueva `lab-docker7-<16hex>`; no recibe un `.env` ni una base existente. Valida proyecto, rutas canónicas, binds internos, siete servicios, redes internas, puertos solo loopback, imágenes precargadas y código exacto mediante SHA. Limita la suma a 2.8125 GiB y 1.9 CPU en CPU 2–3; Cooper usa 1 GiB sin swap. No hereda el entorno del proceso.

Prepara un Unix ficticio para los relés y comprueba rechazo anónimo y transporte autorizado dentro del laboratorio. Conserva punteros sintéticos no vacíos y una escritura posterior al PASS. Exige observar marcador de mantenimiento, Caddy detenido y retirada del marcador después de PASS; **no afirma HTTP 503**. Solo consulta IDs, fechas de arranque y salud del stack real para detectar cambios ajenos; las comprobaciones de ejecuciones/esperas corresponden al operador remoto.

Prueba local: `PYTHONDONTWRITEBYTECODE=1 python3 -W error -m unittest discover -s deploy/tests -p 'test_*.py'` → **161/161 PASS**, sin advertencias, incluida la negativa que impide convertir un error de `inspect` en evidencia de cierre de ingreso. `git diff --check` → salida 0. Una resolución local previa de Compose sobre el entorno ficticio validó los siete servicios y sus límites; no arrancó contenedores. No se repitió la puerta de Cooper porque este encargo solo añade un arnés operativo y documentación; la puerta del producto corresponde a la imagen y rama del integrador.

Fuentes oficiales consultadas para el arnés: [Compose config](https://docs.docker.com/reference/cli/docker/compose/config/), [redes Compose](https://docs.docker.com/reference/compose-file/networks/) y [servicios/límites de Compose](https://docs.docker.com/reference/compose-file/services/). Su disponibilidad documental no sustituye el ensayo real pendiente.

## Pendientes de Walter

Ninguno nuevo. La adaptación del helper, su ensayo exacto y la corrección de la receta son trabajo A de Codex. La coordinación del único operador remoto y las aceptaciones del candidato actual permanecen con el integrador; no se adelanta despliegue, recuperación ni push.
