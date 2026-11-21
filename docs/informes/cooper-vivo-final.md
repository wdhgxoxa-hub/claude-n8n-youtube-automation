# Cooper final en vivo

20 de noviembre de 2026, America/Lima. Worktree `/home/david/Proyectos/cooper-wt/cooper-final`, rama `cooper-final`. Base de aplicación: `e9c39778d7b646eb06be4e932bb8baf8e166a095`. Administrador conservado: `wdhg.xoxa@gmail.com`.

## Resultado

**Cooper responde en http://localhost:3000 desde `cooper-final`.** `cooper.service` y `puente-codex.service` están activos y habilitados. Cooper, puente y n8n escuchan respectivamente en `127.0.0.1:3000`, `127.0.0.1:8789` y `127.0.0.1:5678`. Se conserva la infraestructura local con ngrok.

- n8n mantiene sus 32 IDs anteriores y añade únicamente dos subflujos de fase 6: **34 workflows, 32 publicados, cero nombres duplicados**. Se actualizaron los 28 workflows existentes de `workflows/v2`; los cuatro legados permanecen. FX se publicó después de sus dependencias.
- Se añadieron nueve columnas de Data Tables. No había filas pendientes de migración de dueño. `modo_noticia=false` quedó escrito en los dos canales. No se cambiaron etapas, aprobaciones, guiones, trabajos, costos ni publicaciones.
- Todos los ajustes previos y asociaciones existentes de credenciales se conservan. La adición `allowTextoApi=true` habilita el respaldo solicitado. Las ramas nuevas de HeyGen/ElevenLabs siguen sin credencial asociada. No hubo prueba paga ni producción de medios.
- Codex está primero en los flujos de texto. Una petición real del crítico, enviada desde `videos-n8n`, devolvió **HTTP 200, ruta `codex`, JSON válido, 6.864 ms**. El mismo origen obtuvo 200 en salud autenticada y 401 sin token.
- SQLite de Cooper pasó de cinco a ocho migraciones: `0005_chat_ia`, `0006_whatsapp`, `0007_noticias`. Integridad correcta y cero errores de claves foráneas. Se conserva el archivo de producción en `~/.local/share/cooper/cooper.sqlite`.
- No apareció `ANTHROPIC_API_KEY` disponible en el entorno ni en los `.env` de los repositorios/worktrees revisados. El chat conserva su modo anterior, **simulado**, mediante `COOPER_CHAT=simulada` en la unidad. No se activaron llamadas a Claude/OpenAI para el chat.

No se hizo OAuth, push, merge, pago, publicación de videos ni modificación de D&S Factory. Se respetó la autorización específica de esta misión para desplegar Cooper/n8n. Los cambios previos en `cooper-ensayo.md`, los dos archivos de bytecode y `docs/misiones/` se dejaron fuera de los commits.

## Respaldo y preservación

Antes de modificar servicios o datos se creó:

```text
/home/david/.cache/cooper-vivo/respaldo-20261120-215220-0500/
```

Contiene el volumen n8n con SQLite consistente mediante respaldo en línea, historial/versiones publicadas, 32 workflows, nueve Data Tables con filas/esquemas, aprobaciones pendientes y la SQLite de Cooper. Directorios 0700 y archivos 0600; **32 hashes comprobados**. Se verificaron integridad, claves foráneas y lectura de las 187 tablas SQLite.

Una copia separada se abrió con n8n 2.47.4 en un contenedor efímero **sin red ni puertos**, sin arrancar servidor. Exportó los 32 workflows: IDs, nodos y conexiones coincidieron. No se restauró el volumen vivo. Los logs del volumen no se consideran una instantánea transaccional. [Resultado del ensayo de restauración](evidencias/cooper-vivo-final/respaldo-verificado.json).

Las ejecuciones **400 y 540** conservan exactamente sus filas de ejecución y datos persistidos, comprobadas por hash. Las nueve tablas conservan sus columnas previas de negocio; solo `updatedAt` de los canales cambió al escribir el modo noticia apagado. Las cuatro filas de `publicaciones` y las decisiones siguen intactas. No se visitaron formularios pendientes. [Preservación](evidencias/cooper-vivo-final/datos-verificados.json).

Los cuatro cron se pausaron durante la actualización y se restauraron al final con sus nodos completos originales. Se verificaron horarios, parámetros, indicadores y publicación. Antes de reiniciar contenedores había cero ejecuciones `new`/`running`. [Estado final](evidencias/cooper-vivo-final/estado-final.json).

## Servicios y configuración

`cooper.service` apunta al worktree final. Su `EnvironmentFile` referencia directamente el `.env.local` anterior de `cooper-ensayo`: **no se copió ni modificó ese archivo**. Se instaló con `npm ci`, se aplicaron las migraciones y se usó el build de producción verificado. No hay emisor de sesiones E2E en producción.

El puente usa la [unidad versionada](../../deploy/systemd/puente-codex.service), código instalado en `~/.local/lib/cooper/puente-codex` y token nuevo en `~/.config/cooper/codex.env` (0600). Se ejecuta como David con su sesión ChatGPT ya disponible, sin copiar autenticación ni iniciar sesión. Ignora la configuración de usuario al invocar Codex, deshabilita shell/apps/hooks, usa sandbox de lectura, temporales privados, límite de tiempo y una sola ejecución simultánea. La unidad aplica `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=read-only` y `UMask=0077`; permite a Codex escribir su directorio de estado. **No se creó una identidad de sistema dedicada**; ese aislamiento adicional queda pendiente.

Los contenedores conservan imágenes 2.47.4, volumen y archivos de entorno anteriores. Se añadió `codex.env` como archivo de entorno y `PUENTE_CODEX_URL`/`PUENTE_CODEX_TOKEN` a la lista permitida del runner. Pasta usa `-T,3000,-T,8789`: ambos servicios siguen en loopback. El runner mantiene usuario 65532, raíz de solo lectura, `/tmp` temporal, sin capacidades y únicamente `crypto` permitido.

Los contenedores anteriores se conservan detenidos, con reinicio desactivado:

```text
videos-n8n-antes-final-20261120
videos-n8n-runner-antes-final-20261120
```

No arrancar dos contenedores contra el mismo volumen. Los diarios, unidades anteriores, inspecciones privadas y scripts específicos están en `~/.cache/cooper-vivo-final/` (privado). La clave de mantenimiento solo se consume dentro del proceso desde `~/.config/cooper/n8n-api-key`; no se registra ni incorpora a los servicios.

IDs nuevos, que deben reutilizarse en próximas actualizaciones:

| Declarativo | ID vivo |
| --- | --- |
| `FabTextoGPT0001` | `YgWu9aUDsB2VYaz3` |
| `FabNoticia000001` | `rvwLNNS309MEi8cL` |

[Mapa completo de los 30 workflows de fábrica](evidencias/cooper-vivo-final/mapa-workflows.json).

## Validación

| Comprobación | Resultado |
| --- | --- |
| Estado por dueño y administrativo | 200; dos canales, cinco videos, dueños correctos y noticias apagadas |
| Dueño ficticio sin recursos | 200; cero canales/videos |
| Rol administrativo falsificado | 403 |
| Tendencias y gastos administrativos | 200; respuesta válida; tendencias no dispara investigación |
| HMAC desde n8n a Cooper | Firma válida: 200/`nueva`; inválida: 401 |
| Entrada, sesión y proveedores Auth.js | HTTP 200; `/admin` sin sesión: 307 |
| Crítico real por puente desde el contenedor | 200, ruta Codex, contrato válido; sin API de respaldo |
| Playwright sobre entrada viva, 390/1440 px | Sin errores ni advertencias de consola, sin desbordamiento |
| Lighthouse entrada viva, móvil/escritorio | **100 rendimiento / 100 accesibilidad / 100 buenas prácticas**, cero advertencias |

Evidencias: [consultas](evidencias/cooper-vivo-final/consultas.json), [firma](evidencias/cooper-vivo-final/hmac.json), [crítico y registro del servicio](evidencias/cooper-vivo-final/critico-real.json), [navegador](evidencias/cooper-vivo-final/navegador-vivo.json), [Lighthouse vivo](evidencias/cooper-vivo-final/lighthouse-vivo-resumen.json), [SQLite local](evidencias/cooper-vivo-final/cooper-local.json).

El HMAC fue una consulta de recibo desconocido, sin reservar, confirmar ni despachar una orden. La llamada del crítico llegó directamente al puente desde el contenedor; no se provocó una producción de n8n para recorrer el crítico completo. El respaldo API está configurado y cubierto por pruebas ficticias; no se invocó para comprobar gasto real.

Las animaciones del estudio privado se verificaron con datos y sesiones ficticios en E2E, incluidas consola, pausa y movimiento reducido. La entrada viva sí se revisó sin sesión. No se fabricó una sesión de producción para inspeccionar el panel privado.

Lighthouse del estudio aislado midió 32 combinaciones: **rendimiento 96–100, accesibilidad 100, buenas prácticas 100; cero advertencias y cero comprobaciones binarias fallidas**. El primer inicio oscuro móvil dio LCP aproximado de 2,85 s y rendimiento 96 en dos ejecuciones. El modo adicional `--animacion`, que exige 100 en todas, terminó con rc 1; ese objetivo extra **no se alcanzó**. La auditoría habitual `--rapida`, con el umbral documentado de rendimiento ≥90, pasó con rc 0 sin cambiar código ni umbrales. [32 mediciones](evidencias/cooper-vivo-final/lighthouse-estudio.json), [log estricto](evidencias/cooper-vivo-final/lighthouse-estudio.log) y [auditoría habitual](evidencias/cooper-vivo-final/lighthouse-rapida.log). Son mediciones de laboratorio, no datos de campo.

## Puerta obligatoria

Ejecutada completa en el worktree final, sin `.env` real en su directorio, con bases/puertos/secretos ficticios para ensayos:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
```

| Paso | Resultado | rc |
| --- | --- | --- |
| npm ci | Instalación limpia, cero vulnerabilidades | 0 |
| lint | Cero errores y advertencias; `--max-warnings 0` | 0 |
| typecheck | PASS | 0 |
| npm test | 216 pruebas, 22 archivos | 0 |
| test:e2e | 32 escenarios, sin omisiones | 0 |
| build | Next.js 16.4.6, producción | 0 |
| flujos_v2 | 129 pruebas, sin omisiones | 0 |
| Puente Codex y migración, adicionales | 18 pruebas, sin omisiones | 0 |

**Puerta obligatoria: cero errores, cero advertencias.** [Log completo](evidencias/cooper-vivo-final/puerta.log), [flujos](evidencias/cooper-vivo-final/flujos.log), [puente/migración](evidencias/cooper-vivo-final/servicio-migracion.log). La auditoría opcional de 100 puntos se registra separadamente; no se presenta como PASS. Código de aplicación verificado: `e9c3977`; los commits de esta misión solo añaden la unidad y documentación/evidencias. Node 24.22.3, Codex CLI 0.163.0. La regresión Python usó `PYTHONDONTWRITEBYTECODE=1` y temporales propios. El log versionado normaliza únicamente espacios finales y retornos de carro de progreso; el original permanece en `cooper/.cache/vivo-final/puerta.log`.

## Incidencias corregidas

1. El respaldo inicial no pudo leer `config` del volumen desde el usuario del host. Se repitió mediante `podman unshare`, sin cambiar permisos vivos; solo el respaldo posterior verificado se considera válido.
2. El proceso anterior de Cooper excedió sus 30 segundos de parada y systemd lo terminó con SIGKILL. SQLite pasó integridad y no había órdenes en curso. El servicio final está activo. El runner anterior también consumió su ventana de parada; se conservó detenido.
3. Al restaurar cron, el Radar conservaba un `disabled` temporal porque el original no tenía esa propiedad. Se reemplazó el nodo completo y la comparación final de los cuatro cron pasó.
4. La preparación inicial asociaba credenciales nuevas por tipo genérico. La revisión detectó cinco referencias incorrectas: respaldo OpenAI y cuatro nodos de medios sin configurar. Se corrigió la selección por ID exacto y se republicaron los tres workflows afectados. **No se ejecutó el respaldo ni esas ramas con las referencias incorrectas.** La revisión final comprobó los 1.021 nodos: OpenAI usa su credencial original; las ramas no configuradas siguen vacías. [Corrección](evidencias/cooper-vivo-final/correccion-asociaciones.json) y [verificación final](evidencias/cooper-vivo-final/asociaciones-verificadas.json).

## Reversa

Procedimiento específico para esta instantánea; revisar actividad posterior antes de usarlo. No restaurar una SQLite antigua sobre actividad legítima ni borrar recibos. Conservar primero un respaldo nuevo de ambas bases y comprobar ausencia de ejecuciones `new`/`running`. Mantener las esperas históricas.

1. Detener Cooper y pausar únicamente los cron. En una sesión sin bus de usuario, exportar `XDG_RUNTIME_DIR=/run/user/1000` y `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus` antes de `systemctl --user`.

```bash
systemctl --user stop cooper.service
node ~/.cache/cooper-vivo-final/operar.mjs pausar
node ~/.cache/cooper-vivo-final/operar.mjs revertir
```

`revertir` despublica FX al comienzo, restaura grafos/versiones anteriores y deja los dos subflujos nuevos inactivos. Los cron se recuperan al final con la acción separada `cron-anterior`. Las columnas aditivas, filas y diario permanecen: no hay reasignaciones de dueño que revertir en esta misión.

2. **No volver directamente al servicio anterior con su carpeta de cinco migraciones:** rechazaría el diario actual. Está preparada una carpeta de reversa en `~/.local/lib/cooper/reversa-final-20261120/`, con copia del build anterior, las ocho migraciones y dependencias del worktree anterior. Se comprobó HTTP 200 y el migrador antiguo contra una copia de la base actual, con integridad correcta. No se probó una reversa viva completa. Conservar `cooper-ensayo/node_modules`; no retirar ese worktree mientras dependa de él la recuperación. [Ensayo](evidencias/cooper-vivo-final/reversa-cooper-verificada.json).

```bash
cp ~/.cache/cooper-vivo-final/cooper-reversa-compatible.service ~/.config/systemd/user/cooper.service
systemctl --user daemon-reload
systemctl --user start cooper.service
```

La unidad compatible conserva la SQLite actual y referencia el `.env.local` anterior. Las nuevas tablas/columnas quedan sin uso por el código anterior. Cualquier migración futura requiere volver a validar esta compatibilidad.

3. Si también se revierte el entorno de contenedores: con cero trabajos activos, detener `videos-n8n-runner` y `videos-n8n`, desactivar su reinicio y conservarlos con otro nombre; recuperar los dos nombres `*-antes-final-20261120`, restaurar `task-runners-antes.json` a `~/.config/cooper/task-runners.json`, devolver `--restart=unless-stopped` y arrancar n8n seguido del runner **sobre el volumen actual**. Nunca arrancar ambos pares simultáneamente. Verificar las lecturas y HMAC antes del siguiente paso.

```bash
node ~/.cache/cooper-vivo-final/operar.mjs cron-anterior
systemctl --user disable --now puente-codex.service
```

Restaurar únicamente los cron respaldados, con las versiones originales. Conservar `codex.env`, diarios y datos para diagnóstico; no borrar credenciales. La recuperación completa por desastre exige comprobar `SHA256SUMS` y conciliar cualquier actividad posterior; el ensayo aislado no autoriza sobrescribir el volumen vivo.

## Commits

| Commit | Contenido |
| --- | --- |
| `7b3c3f4` | Unidad privada de usuario para el puente Codex |
| Commit de cierre de este informe | Estado de vivo, guías, evidencias y reversa compatible |

No hubo push ni merge a `main`/`version-chatgpt`. [Manifiesto de evidencias](evidencias/cooper-vivo-final/SHA256SUMS.txt).

## Limitaciones reales y Pendientes de Walter

- Chat con IA: suministrar `ANTHROPIC_API_KEY` por el mecanismo privado elegido y autorizar su ensayo; mientras tanto funciona el simulador anterior.
- Revisar el panel privado con la sesión Google real; no se hizo OAuth ni se emitieron cookies de producción. Revisar también el contexto histórico de las esperas 400/540, sin aprobarlas automáticamente.
- Preparar una identidad dedicada para el puente si se requiere separación de la sesión personal de David. La sesión/cuota/modelo actuales funcionaron para una llamada corta; no se garantiza disponibilidad continua.
- Ensayar una noticia completa, búsqueda con fuentes, recuperación por cuota/timeout y respaldo API pago. Noticias siguen apagadas; no se validó producción de medios ni publicación. Asociar HeyGen/ElevenLabs requiere otra configuración explícita.
- Mejorar el primer LCP del estudio móvil si se quiere cumplir el objetivo adicional de Lighthouse 100 en todas las combinaciones; el valor medido fue 96, sin advertencias.
- No se ejecutó una reversa completa sobre servicios vivos, ni un callback de progreso producido por un video. Se verificaron respaldo, compatibilidad de reversa, consulta HMAC y preservación de datos.
- Los cron conservan sus horarios; no se ejecutaron ticks omitidos durante la ventana de mantenimiento. La clave REST tiene su caducidad existente. VPS, dominio y respaldo periódico siguen siendo decisiones posteriores.

## Documentación oficial contrastada

- [Autenticación de n8n](https://docs.n8n.io/api/authentication/) y OpenAPI de la imagen instalada 2.47.4 (`public-api/v1/openapi.yml`): columnas, actualización de filas, `publishIfActive=false`, publicación por versión y despublicación.
- [Podman/Pasta](https://docs.podman.io/en/latest/markdown/podman-run.1.html): reenvío TCP de contenedor a loopback del host.
- [Codex no interactivo](https://learn.chatgpt.com/docs/non-interactive-mode) y [autenticación](https://learn.chatgpt.com/docs/auth?surface=cli), contrastados con `codex exec --help` y estado de sesión local; sin login nuevo.
- Guía oficial de variables de Next instalada en `cooper/node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`. No se llamaron APIs de proveedores audiovisuales ni al respaldo OpenAI durante la validación.
