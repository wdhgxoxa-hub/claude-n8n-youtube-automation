# Revisión e integración del extra de recuperación app

Corte: 21-11-2026, 17:34 Lima. Rama propia `total-integrador-producto-app`, desde la integración raíz `822f78d`. Sin acceso al VPS, ejecución del worktree ajeno ni modificación de sus archivos.

## Integración y alcance

- `a3708ba6c7d0d7cad8383b812c991d13429464ea` cierra `total-recuperacion-app`; se incorpora íntegro como `2e922ca`, sin conflictos. ESTADO conserva sus secciones y pendientes previos. La matriz histórica de 76 referencias queda complementada por este cierre posterior a su corte; su fila «sin cierre» describe correctamente la observación anterior.
- El helper nuevo conserva SHA256 `32676c66f973f63eb8a6e0c8928847613283313a4a43744d79bf86f4f7c37f04`. Solo se incorporan extra operativo, arnés, pruebas y documentación. La aplicación b3, el actualizador, Operator, la recuperación infra y los 25 archivos del bundle permanecen idénticos.
- Se corrige exclusivamente la receta para invocar `python3 -B` con `PYTHONPATH` explícito. Sin `-B`, importar los helpers crea `__pycache__` dentro del bundle y su validador posterior rechaza ese inventario adicional. No se cambia el helper ya ensayado ni se usa `-I`, que anularía esa ruta de importación.

## Verificación propia

241/241 pruebas operativas propias PASS con `python3 -B -W error -m unittest discover -s deploy/tests -p 'test_*.py'`, afinidad CPU16–21, salida 0 y sin advertencias. Cuatro comprobaciones independientes del paquete PASS: 27 huellas públicas, importación CLI `--help` con `-B` sin bytecode ni consumo de entorno, rechazo de código alterado y reproducción del rechazo por bytecode sin `-B`. Se valida la sintaxis de los seis bloques de comandos. [Recibo](evidencias/total-integrador-recuperacion-app/validacion.json).

Se cotejaron todas las huellas de entrega del frente. Su ensayo real cerrado acredita cbf→b3→cbf, siete servicios, migraciones 11→14→11, cinco IDs/imágenes/StartedAt intactos, recuperación de datos previos y archivo de escrituras posteriores copiado y verificado nuevamente. Recibo público SHA256 `1e5d15bef35efc9e0f910440d28b3d681fb5a76bae542e9b20874948dd6431ee`. Es evidencia del frente revisada; este revisor no repitió ese ciclo de contenedores. [Informe original y límites](total-recuperacion-app.md).

La revisión de código confirma sello del respaldo completo con WAL/medios, CAS de workflows/esquema y configuración antes y después de detener app, comparación de los cinco servicios contra su estado al iniciar la recuperación y conservación de mantenimiento ante fallo. No se usa `anterior.json` global. Una sospecha inicial de salud obsoleta tras un stop normal de Docker se retiró al consultar [Moby oficial](https://raw.githubusercontent.com/moby/moby/v28.5.2/container/health.go): el cierre del monitor marca unhealthy. No se presenta esa defensa sugerida como defecto de producción demostrado.

## Artefacto y secuencia

Paquete local independiente `recuperacion-app-b3.tar.gz`: 9.081 bytes, SHA256 `4eee6ba392e8f4b6722b031440fe7a170c3c7fb8bbc47cb2cac79cc5efce408e`. Contiene el helper exacto, manifiesto público, preflight y receta. No contiene datos, entorno ni copias del bundle. [Huellas](evidencias/total-integrador-recuperacion-app/paquete.json), [comandos exactos](evidencias/total-integrador-recuperacion-app/COMANDOS.md).

El preflight comprueba únicamente código y el inventario importable, sin importar Operator, consumir entorno ni crear estado operativo. La secuencia posterior autorizada es Marcas bloqueado → preparar app → actualizador certificado → sellar su resultado PASS concreto → infra → n8n → aceptación pública → snapshot → réplica. El sello debe existir antes de avanzar a infra. La recuperación exige conciliar/revertir primero n8n, después infra y finalmente app. Cada CLI toma su propio bloqueo compartido; no envolverlas en otro flock sobre el mismo archivo.

## Limitaciones y pendientes de Walter

Ninguno nuevo. La puerta web y las dos rondas siguen bajo responsabilidad de la integración raíz; este cambio externo a la imagen no las sustituye. Preparación/sello, push, despliegue, aceptación pública y réplica remota no se afirman ejecutados aquí. El ensayo real usa Podman local con adaptación declarada y no acredita Docker remoto, TLS público ni reboot. Antes de recuperar deben conciliarse efectos externos y escrituras posteriores conservadas.
