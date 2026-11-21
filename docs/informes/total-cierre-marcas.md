# Cierre técnico de los trabajadores Marcas simulados

21-11-2026, 18:19 Lima. Rama/worktree propios `total-cierre-marcas`, base `af2774c`. **Implementado, probado, integrado y desplegado.** El integrador incorporó `42172e5` como `1c3e051` y `b5e0460` como `96ea620`; 269 regresiones combinadas PASS. La activación del VPS terminó PASS el 21-11-2026 a las 18:54 Lima: dos workers, cuatro disparadores registrados, 45 workflows/31 activos, colas vacías y siete servicios saludables. [Ejecución y diagnóstico acotado de referencias](evidencias/total-integrador/cierre-n8n/marcas/ejecucion.md).

## Cambios y procedencia

Commit `42172e5`: extra separado `deploy/activar-marcas-simuladas.py`, quince pruebas de guardas y ensayo real. Parte del archivo sin commit dejado por `total-marcas-simuladas`, SHA-256 `e0bb00f9cfbbd68dda5c1566fe41f3931b4c557f2a3959b4b5b0c2dab921b26f`; ese trabajo ajeno permanece intacto. La adaptación fija `operar.DEPLOY=/opt/cooper/deploy` exclusivamente al ejecutar el CLI. No cambia aplicación, imagen b3, generador, definiciones ni bundle certificado.

El extra prepara un recibo ligado a contenido/versiones/publicaciones de todos los workflows, ejecuciones/esperas, configuración pública, release e imágenes. Exige proveedor simulado, interruptor habilitado, secreto dedicado presente mediante booleanos y cuentas/piezas/ingestas vacías. Repite CAS antes y después del snapshot verificado; publica o despublica exclusivamente `CooperMarcasPub1` y `CooperMarcasMet1` con CLI oficial. Conserva tablas de negocio y workflows ajenos. Ante fallo posterior al snapshot archiva el n8n fallido y restaura únicamente n8n; no sustituye env ni datos de Cooper.

## Evidencia

- **259/259 pruebas operativas**, incluidas quince nuevas, con `python3 -B -W error -m unittest discover -s deploy/tests -p 'test_*.py'`; cero errores/advertencias. [Log](evidencias/total-cierre-marcas/unitarias.log).
- **Siete servicios reales**, imagen b3, n8n/runner 2.47.6, Caddy 2.11.8, CPU 16–23, Cooper 1 GiB/swap0. Redes backend y salida internas: publicar ambos workers exactos → reloj real de Publicación → **un POST HMAC 200** a Cooper → despublicar ambos → salud, imágenes, contenido y versiones conservados → limpieza PASS. Cola vacía, cero GET externos, sin disparo manual, OAuth ni publicación real. [Resultado](evidencias/total-cierre-marcas/real.json), [log](evidencias/total-cierre-marcas/real.log).
- Los cuatro disparadores (Reloj e Inicio de ambos workers) constaron `activated`, sin errores ni reintentos. [Metadata segura](evidencias/total-cierre-marcas/disparadores.json).
- Se reutilizan las pruebas ya aprobadas del mismo runtime: [Compose b3](evidencias/total-integrador-operacion-b3/compose.log), con JPEG/reel, HMAC válido/inválido y reinicio; [ramas integradas](evidencias/total-integrador-n8n/ramas-resumen.json), con tres casos Marcas dentro de 48 casos. No se repitieron esos ciclos ni se atribuyen pruebas nuevas.
- La puerta de producto permanece la [puerta final aprobada](evidencias/total-integrador/puerta-final.json): npm ci, lint, tipos, 467 unitarias, 103 E2E, build y 235 pruebas de flujos, cero errores/advertencias. Este extra no modifica producto ni su imagen; la suite Python combinada final corresponde al integrador. [Huellas y procedencia](evidencias/total-cierre-marcas/fuentes.json).

Dos intentos del arnés quedaron descartados: el primero esperaba una fila de ejecución que la retención `none` elimina y usaba una espera menor al intervalo de cinco minutos; el segundo se interrumpió para corregir esa espera y dejó una advertencia de proceso durante la cancelación. La aceptación es únicamente la tercera pasada, salida 0 y log limpio. El arnés inicializa un owner ficticio como el laboratorio Compose existente, y observa el POST real sin alterar el workflow ni su retención.

## Aplicación y reversa

El integrador controla la secuencia **lote certificado → Radar → Marcas → copia final**, con un único escritor. Instalar este extra y los dos JSON públicos fuera del bundle de 25 archivos. Verificar SHA-256 contra `fuentes.json`; importar `operar` del bundle certificado mediante `PYTHONPATH`, sin copiar ni modificar sus helpers. Ejecutar con `python3 -B`, sin `-I` porque eliminaría ese `PYTHONPATH`:

```bash
sudo -n env PYTHONPATH=/home/operador/total-integrador-20261121/aplicadores-certificados-b3e608e/bundle/deploy \
  python3 -B /home/operador/total-integrador-20261121/extra-marcas/activar-marcas-simuladas.py \
  preparar --fuente /home/operador/total-integrador-20261121/extra-marcas/fuentes \
  --salida /var/lib/cooper-operacion/total-cierre-marcas-preparado.json
```

Con el SHA-256 devuelto por esa preparación, misma invocación y rutas base:

```text
activar --recibo /var/lib/cooper-operacion/total-cierre-marcas-preparado.json --sha256 SHA_PREPARADO --salida /var/lib/cooper-operacion/total-cierre-marcas-activado.json
revertir --recibo /var/lib/cooper-operacion/total-cierre-marcas-activado.json --sha256 SHA_ACTIVADO --salida /var/lib/cooper-operacion/total-cierre-marcas-revertido.json
```

Preparar únicamente después del PASS de Radar; no reutilizar un recibo preparado antes. Verificar después estados publicados, versión del borrador, `workflow_publication_trigger_status`, ausencia de mantenimiento y salud de siete servicios. Si hay que retroceder varias fases, el orden es Marcas → Radar → lote → infraestructura → Cooper. No usar rollback global.

## Límites reales y Pendientes de Walter

1. La reversa oficial conserva definición, versión y estado publicado anterior; `versionCounter` avanza. No es una reversa byte a byte de SQLite. El snapshot adicional preserva el estado desplazado.
2. Se observó el intervalo real de Publicación (cinco minutos), no el de Métricas (una hora). Métricas quedó publicado, con sus disparadores registrados y después despublicado; la próxima ventana productiva requiere observación posterior.
3. Cero GET externos corresponde al ensayo de cola vacía con red cerrada. No promete ausencia permanente de consultas externas si se incorporan futuras ingestas. El modo simulado evita publicación real; activos, contenidos, permisos y primer ensayo real siguen en los pendientes ya existentes de Walter.
4. Ninguna decisión nueva de Walter bloquea este extra técnico. El despliegue y el registro de disparadores del VPS están acreditados; no se atribuye todavía observación del siguiente reloj productivo.

Documentación oficial consultada: [CLI n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md), [publish:workflow 2.47.6](https://github.com/n8n-io/n8n/blob/n8n%402.47.6/packages/cli/src/commands/publish/workflow.ts), [OwnerController 2.47.6](https://github.com/n8n-io/n8n/blob/n8n%402.47.6/packages/cli/src/controllers/owner.controller.ts). El owner se crea solo en laboratorio sintético.
