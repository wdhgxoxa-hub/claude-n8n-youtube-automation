# Recuperación de infraestructura después de PASS

21-11-2026, Lima. Ensayo local del subfrente Operación, en rama `total-integrador-operacion-b3` y checkout propio `/home/david/.cache/tiop-b3`. No hubo SSH ni mutaciones del VPS. La aplicación bajo prueba es la imagen b3 ya acreditada por H19; este trabajo añade cobertura operativa, sin cambiar Cooper ni el bundle certificado de 25 archivos.

## Código y alcance

- Helper de Producto: `cd39539cf10c686717ee3fc2e44b355faa1ca6e4`, `recuperar-infra.py` SHA256 **`beaa5cabeb4f94fb99940922751818a8e771e54dd591e975795397308ca0a3ba`**. Se copió únicamente ese archivo público por commit y se comprobó su huella antes del ensayo.
- Commit del arnés: **`e88f592`**, «Ensayar recuperación de siete servicios después de PASS». Añade `--recuperar-despues-pass`; el comportamiento sin esa opción permanece intacto. Exige relés previos con imágenes mezcladas y mantiene el mismo candado durante aplicación y recuperación.
- Imagen: `localhost/cooper:b3e608eec138a03fce419a66954497b8fc2c50ea`, archivo gzip SHA256 **`9ea269e6746e197c5626ae04fa6835bbcf9eb18274d7d0192225582e8e493d20`**. Se reutilizó el mismo archivo exacto de la [aceptación operativa b3](total-integrador-operacion-b3.md).
- `aplicar-infra.py` y `operar.py` permanecieron idénticos a los ya ensayados: SHA256 `d9b8a8faec7ff1b4658dc25f941595778951338698e7d035d26dae96e85dab2c` y `0a42c6f610ebca5afd2eaa93e5c695a0f9d5fbdaa55482a889543177ed447a56`.

El helper original de otra misión no acreditaba esta mezcla ni las identidades OCI usadas por el integrador. Producto adaptó esa compatibilidad y añadió una comparación de workflows y esquema de negocio contra el snapshot previo para rechazar una recuperación que borraría cambios n8n posteriores. Sus pruebas unitarias se documentan en su propio cierre; aquí se acredita la operación real del helper adaptado sobre servicios de laboratorio.

## Ensayo real

Se creó un fixture nuevo, `/home/david/.cache/tiop-b3/cooper/.cache/e2e-vps-e2Lk2r`, mediante `deploy/tests/compose.mjs` intacto. Usó CPU 16–21, puertos exclusivamente loopback, red interna, datos sintéticos y Cooper limitado a **1 GiB sin swap**. El fixture anterior `nUwTZv` y sus recibos se conservaron sin modificación.

| Paso | Resultado |
| --- | --- |
| Compose completo del nuevo fixture | **8/8 PASS**, salida 0 y stderr vacío. |
| Estado previo mixto | Cooper y chat-cooper en b3; chat-n8n y chat-runner en cbf20685; infraestructura anterior. |
| Fallo inyectado durante actualización | **FALLO_REVERTIDO**, reversa PASS con los siete IDs iniciales exactos. |
| Aplicación posterior completa | **PASS**, infraestructura nueva y los tres relés en b3. |
| Recuperación de esa aplicación PASS | **PASS**, siete IDs originales exactos, datos y configuración restituidos. |
| Punteros de Cooper y cierre | Punteros conservados, sin mantenimiento; salida 0, stderr vacío y cero contenedores restantes. |

El arnés copia el recibo público de aplicación byte a byte dentro del estado operativo, comprueba su SHA y lo entrega al helper. No copia el entorno. La recuperación acredita el snapshot antes del corte y preserva el estado desplazado; el recibo registra las huellas de los workflows, del manifiesto restaurado y del override de imágenes. El arnés compara de nuevo los siete IDs, la configuración y los punteros después de la salud real de todos los servicios.

El recibo completo del arnés tiene SHA256 **`7061420596d3fc01b5961725e046fb57bdcd5558921d2ba62155b0dae3cba868`**. El código de arnés ejecutado tiene SHA256 **`36e4959f2b4cb08238e7acc2e81a36a3439c486d085ccd71f342b2533077d0aa`**. Evidencias: [aplicador](evidencias/total-integrador-recuperacion-b3/aplicador.json), [recuperación](evidencias/total-integrador-recuperacion-b3/recuperacion.json), [Compose](evidencias/total-integrador-recuperacion-b3/compose.log), [cierre y hashes](evidencias/total-integrador-recuperacion-b3/cierre.json) e [índice completo](evidencias/total-integrador-recuperacion-b3/indice.json).

La adaptación exclusiva de Podman permanece igual: relés con `/sys` vacío de solo lectura, retirada únicamente de dependientes de namespace detenidos antes de recrear sus padres, conservación de argumentos, overrides y red. Todas las comprobaciones de salud, identidades, datos, candados y comparaciones del helper se ejecutan completas. Este ensayo no atribuye a Docker el orden de retirada específico de Podman.

La primera invocación local omitió `COOPER_LAB=1` externo y fue bloqueada por la guarda de configuración antes de crear un candidato o arrancar servicios. Se conservó ese diagnóstico y se repitió con la marca correcta, sin cambiar la guarda. [Constancia del intento bloqueado](evidencias/total-integrador-recuperacion-b3/invocacion-inicial.json).

## Límites y reproducibilidad

Se acredita la **recuperación inmediata de la mezcla anterior**. No se ensayó persistencia de esa mezcla ante una futura recreación Compose que omita el override por servicio: esa operación podría adoptar la imagen global b3 en chat-n8n/chat-runner. El resultado no debe describirse como garantía de persistencia ante recreaciones posteriores.

El helper debe estar disponible con la huella indicada junto a los módulos operativos certificados. La invocación probada usa exclusivamente un fixture sintético:

```sh
COOPER_LAB=1 COOPER_ENSAYO_CPUSET=16-21 PYTHONDONTWRITEBYTECODE=1 \
taskset -c 16-21 python3 -W error deploy/tests/infra-aplicador.py \
  --fixture RUTA_NUEVO_FIXTURE/ensayo.env \
  --ensayo /home/david/.cache/cooper-ti-operacion-b3/infra-aceptacion.json \
  --imagen-archivo /home/david/.cache/cooper-ti-operacion-b3/cooper-b3e608e.tar.gz \
  --imagen-reles-anterior localhost/cooper:cbf20685e07bf07566573825418d87799bed5ad9 \
  --recuperar-despues-pass
```

La puerta general y las dos nuevas rondas secuenciales permanecen a cargo del integrador. El frente Operación verifica sus videos por separado. Esta evidencia no declara despliegue ni aceptación de las rondas fallidas anteriores. El coordinador integra este commit documental y actualiza `docs/ESTADO.md` para preservar los cambios de los demás frentes.

## Pendientes de Walter

1. Ninguno nuevo para este ensayo local. La operación posterior debe conservar el límite documentado sobre recreaciones sin override; no se añadió una política nueva de persistencia.
