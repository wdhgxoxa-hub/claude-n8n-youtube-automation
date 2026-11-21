# Total seguridad — Cooper y VPS

21-11-2026, Lima. Rama/worktree propios `total-seguridad`, base `de397f3`.
**Código corregido y propuesta de VPS preparada; sin integración, push ni
despliegue.** Solo lecturas por SSH y comprobaciones públicas sin sesión en el
VPS. No se hicieron OAuth, pagos, publicaciones ni cambios en D&S Factory.

## Resultado y prioridades

| Hallazgo | Alcance y corrección | Estado |
| --- | --- | --- |
| S01 · Origen no comprobable y MIME ambiguo | Las mutaciones admitían ausencia de Origin/Referer; `includes(application/json)` aceptaba tipos como `text/plain; type=application/json`. Ahora se exige origen exacto, con Referer como respaldo solo si falta Origin, y MIME JSON exacto. Endurecimiento CSRF; no se afirma un ataque exitoso en un navegador real. | Implementado con regresión roja/verde y E2E. |
| S02 · Límite público evadible | Un ID distinto en cada petición de medios de Marcas creaba un cupo nuevo y hacía crecer el mapa de memoria. Ahora el tráfico sin sesión comparte 300/minuto/proceso; las sesiones conservan su cupo de 120. | Implementado y probado con 301 IDs, recuperación y separación de sesión. |
| S03 · Referencias de medios inconsistentes | Se comprobaba la pieza, pero no el dueño del adjunto al entregar el medio. Ahora se valida dueño, pertenencia de la cuenta a la marca y caducidad entera. La reproducción requiere una referencia interna corrupta/heredada; las altas normales ya controlaban los adjuntos. | Implementado y probado; también firma, revisión y suspensión. |
| S04 · Puente interno atravesaba Caddy | `handle @webhooks` se ordenaba antes de `respond @puente 404`. El GET 404 observado podía proceder de n8n, no del bloqueo. Se usa un `handle @puente` anterior al público. No se eludió ni probó el token del backend. | Parche de configuración probado con el adaptador real de Caddy 2.11.2, sin red. **Pendiente de aplicar por el orquestador.** |
| S05 · n8n 2.47.4 con avisos vigentes | La versión observada entra en cuatro rangos afectados publicados el 13-11-2026. La corrección en esa rama es 2.47.6; uno de los avisos es alto y requiere roles personalizados con gestión de usuarios. No se exploraron usuarios/credenciales reales para comprobar explotabilidad. | **Pendiente prioritario del orquestador:** ensayo, respaldo, actualización conjunta n8n/runner y aceptación. |
| S06 · Caddy 2.11.2 anterior a parches de seguridad | Hay avisos corregidos en 2.11.4/2.11.5/2.11.8. Varias condiciones no existen en el Caddyfile revisado (file_server, root por host, forward_auth, captura del cuerpo); el aviso de cabeceras afecta upgrades 101 y depende del upstream. No se demuestra explotación en este VPS. | Propuesta de actualizar por digest a 2.11.8 o posterior compatible tras ensayo; pendiente del orquestador. |

El [guion de aplicación y rollback](../cooper-total-seguridad-vps.md) contiene
los cambios concretos de Caddy, actualización de n8n/runner y ajuste opcional
de SSH. El firewall observado no necesita un cambio para cerrar los puertos
internos. La puerta del código no equivale a declarar el VPS sin hallazgos.

## Commits

| Commit | Cambio |
| --- | --- |
| `e8d27db` | Origen verificable, MIME exacto, regresiones y clientes E2E con Referer correcto. |
| `dbe8c6a` | Dueño de medios, límite público fijo, regresiones de firma, sesión y SSRF; README. |
| `87af2db` | Bloqueo de Caddy anterior al proxy público y prueba de su orden efectivo. |
| `495121a` | Referer canónico también en el cliente de auditoría Lighthouse aislada. |
| Commit de cierre | Este informe, guion, evidencia y ESTADO; localizar con `git log -1 -- docs/informes/total-seguridad.md`. |

Los cambios de Playwright añaden el Referer canónico a sus llamadas API directas;
no omiten el control CSRF ni cambian expectativas de permisos. No hay migraciones
de SQLite ni cambios de contratos n8n en el producto. Los archivos de misión
que ya estaban sin seguimiento se preservaron sin incorporarlos al commit.

## Revisión por superficie

- **Auth/sesiones:** Auth.js JWT de 24 horas, Google con correo verificado y lista
  permitida; `currentUser` reconsulta actividad, permiso y rol en SQLite. Una
  claim con rol admin no eleva el rol persistido. Suspensión, retirada y usuario
  inexistente se rechazan; el emisor E2E sigue fuera de la aplicación.
  No se ensayó Google real ni se emitieron sesiones de producción.
  La configuración del runner permite expresamente unas pocas variables del
  puente y `crypto`; editar workflows n8n sigue siendo un privilegio de confianza.
  Los roles privados de Cooper no aíslan a quien pueda editar código en n8n.
  No se inventariaron permisos reales del editor ni se cambiaron sus credenciales.
- **Rol/marca:** APIs de gestión y administración reutilizan `requireAdmin`,
  `requireOwner` y `requireOwn`; Marcas vincula cuenta/pieza/adjunto al dueño.
  El chat conserva su ámbito propio incluso para el administrador. La nueva
  defensa de lectura cierra referencias inconsistentes de medios.
- **Inyección:** consultas con Drizzle y parámetros, sin `sql.raw` de entradas;
  React escapa texto, la plantilla SVG escapa XML y valida colores/tipografía;
  los CLI usan argumentos separados, sin shell. Se conservan pruebas de HTML
  disfrazado de archivos, IDs ajenos, mensajes maliciosos y acceso administrativo.
- **SSRF:** destinos de API fijados en adaptadores; previews/medios remotos
  exigen HTTPS y hosts habilitados, sin usuario/contraseña/puerto extra ni
  redirecciones. Regresiones rechazan loopback, metadata, IPv6 local, esquemas
  de archivo, suplantación por sufijo y userinfo sin llamar al transporte.
  No se afirma aislamiento de red contra un CDN/DNS comprometido ni se cambian
  las salidas permitidas de los contenedores.
- **CSRF/cabeceras:** control estricto en mutaciones de sesión, autenticación
  HMAC separada para webhooks. CSP con nonce distinto por respuesta, sin
  `unsafe-inline` en scripts; estilos inline conservados por animación. HSTS,
  DENY, nosniff, permisos y no-store comprobados. El host canónico en producción
  debe seguir configurado en `AUTH_URL`, y el proxy debe controlar Host.
- **Límites:** 90 escrituras/300 lecturas por usuario y proceso, cuatro SSE,
  límites de cuerpos/adjuntos existentes y nuevo cupo público fijo. No hay
  limitador distribuido ni defensa volumétrica perimetral; una ráfaga puede
  agotar el cupo público durante un minuto. OAuth y webhooks requieren una
  política perimetral si aumenta la exposición/tráfico.
- **Secretos:** inspección de nombres versionados/históricos y reglas de ignore;
  sin nombres de entornos reales o llaves en los patrones revisados. No se
  leyeron sus contenidos ni valores. Eso no certifica ausencia de valores
  incrustados en todo el historial o rotación de secretos.

## Dependencias y VPS observado

`npm audit --json`: **0 vulnerabilidades conocidas en el lock de Cooper**.
Next 16.4.6 y sharp 0.35.5 están después del parche del
[aviso de optimización de imágenes](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw).
No se cambiaron dependencias sin hallazgo. [Inventario](evidencias/total-seguridad/dependencias.json)
y [audit](evidencias/total-seguridad/npm-audit.json).

VPS observado a las 11:08–11:09 Lima, sujeto a cambios concurrentes:

- SSH: root/contraseñas/teclado deshabilitados, clave pública habilitada, sin X11
  ni GatewayPorts; reenvío local. UFW, fail2ban, actualizaciones de seguridad y
  cooper-firewall activos. OpenSSH `1:9.6p1-3ubuntu13.20` coincide con la
  corrección Ubuntu de [USN-8928-1](https://ubuntu.com/security/notices/USN-8928-1).
- Entrada IPv4 TCP accesible desde esta PC: 22/80/443. No accesibles:
  8443/3000/5678/5679/5680/8789. Editor 8443 ligado a loopback. Las cadenas
  Docker IPv4/IPv6 aceptan conexiones establecidas y 80/443, con DROP final.
  No se ejecutó un escaneo indiscriminado ni una prueba de carga.
- `/etc/cooper` 0700; entorno y contraseña restic 0600, root:root; comprobados
  solo con `stat`. El catálogo APT almacenado no muestra actualizaciones
  pendientes; no se refrescó ni se certifican todos los paquetes del SO.
- HTTPS verificado: entrada 200; estado, SSE y Marcas 401 sin sesión; editor/API
  n8n públicos 404. La observación del puente se interpreta con S04, no como
  prueba de bloqueo. Se mantiene acceso backend a n8n y callback firmado.
- n8n/runner 2.47.4: avisos
  [roles](https://github.com/n8n-io/n8n/security/advisories/GHSA-q8rc-7m84-mfvj),
  [rutas de integración](https://github.com/n8n-io/n8n/security/advisories/GHSA-c772-hjfp-gfc2),
  [SSRF Bedrock](https://github.com/n8n-io/n8n/security/advisories/GHSA-g333-hr44-g82p) y
  [triggers](https://github.com/n8n-io/n8n/security/advisories/GHSA-h59h-rf6m-7jp5).
  Se documenta la versión afectada; no se explotaron ni activaron esas funciones.
- Caddy 2.11.2: se contrastaron los avisos de
  [cabeceras en upgrades](https://github.com/caddyserver/caddy/security/advisories/GHSA-8qx7-j2v2-x6q5),
  [forward_auth](https://github.com/caddyserver/caddy/security/advisories/GHSA-6365-7ppr-5r92),
  [handlers](https://github.com/caddyserver/caddy/security/advisories/GHSA-j8px-rmrx-76h9) y
  [root derivado del host](https://github.com/caddyserver/caddy/security/advisories/GHSA-r766-rf9f-588h).
  El último afecta configuraciones con raíz dependiente del host; aquí los
  nombres son explícitos y no hay servidor de archivos. La actualización propuesta
  cubre los rangos, sin atribuir automáticamente su gravedad a la configuración.

[Lecturas SSH](evidencias/total-seguridad/vps-lectura.json),
[comprobaciones públicas](evidencias/total-seguridad/publico.json) y
[metadatos de exclusión](evidencias/total-seguridad/secretos-metadatos.json).
No se escanearon todas las capas de imágenes del VPS; queda el procedimiento
por digest en el guion. No hay declaración de «cero vulnerabilidades del VPS».

## Puerta y evidencia

**Puerta completa: 0 errores y 0 advertencias.** Ejecutada secuencialmente
el 21-11-2026, de 11:27:49 a 11:34:29 Lima, sobre `495121a` (último commit
de código). El commit de cierre solo añade documentación/evidencia y ESTADO.
Node 24.22.3, npm 12.2.2; proveedores, usuarios y datos ficticios en instancias
locales efímeras. No hubo pruebas omitidas ni desactivación del guardián Sentinel.

| Paso obligatorio | Resultado | Evidencia |
| --- | --- | --- |
| `cd cooper && npm ci` | rc 0; 0 vulnerabilidades conocidas | [log](evidencias/total-seguridad/puerta/01-ci.log) |
| `npm run lint` | rc 0, sin advertencias | [log](evidencias/total-seguridad/puerta/02-lint.log) |
| `npm run typecheck` | rc 0 | [log](evidencias/total-seguridad/puerta/03-typecheck.log) |
| `npm test` | 306/306, 34 archivos | [log](evidencias/total-seguridad/puerta/04-unitarias.log) |
| `npm run test:e2e` | 44/44; Sentinel incluido | [log](evidencias/total-seguridad/puerta/05-e2e.log) |
| `npm run build` | rc 0 | [log](evidencias/total-seguridad/puerta/06-build.log) |
| Raíz: `node --test tests/flujos_v2.test.cjs` | 147/147, sin omitidas | [log](evidencias/total-seguridad/puerta/07-flujos.log) |

Además, `PYTHONDONTWRITEBYTECODE=1 python3 -W error -m unittest discover -s
deploy/tests -p 'test_*.py' -v`: **22/22** ([log](evidencias/total-seguridad/deploy-tests.log)).
La regresión de Caddy usa su adaptador real 2.11.2, configuración ficticia y
contenedor sin red; el orden anterior falla y el nuevo pasa. Los cinco bloques
Bash del guion pasaron `bash -n`; **no se ejecutaron en el VPS**.

`node scripts/auditoria.mjs --rapida`: **4/4 mediciones**, rendimiento 98–100,
accesibilidad y buenas prácticas 100, sin advertencias ni comprobaciones binarias
fallidas ([resumen](evidencias/total-seguridad/lighthouse-resumen.json)). Alcance:
portada, dos temas, móvil/escritorio; no sustituye aceptación en equipos reales.

La misión añade 22 unitarias, una E2E y dos pruebas de despliegue. Se conserva la
[regresión roja](evidencias/total-seguridad/rojo.log) y su
[comprobación verde](evidencias/total-seguridad/verde.log), además del caso
[rojo](evidencias/total-seguridad/caddy-rojo.log)/[verde](evidencias/total-seguridad/caddy-verde.log)
de Caddy. Un primer intento detectó un fixture incompleto de tipos y otro la
falta del navegador de Sentinel: se corrigieron el fixture y la caché aislada,
sin saltar tests. La primera puerta verde se repitió tras ajustar el cliente de
Lighthouse; [antecedentes](evidencias/total-seguridad/intentos-previos.json).

[Registro de comandos, tiempos, retornos y hashes](evidencias/total-seguridad/puerta/resultado.json)
y [índice de evidencia](evidencias/total-seguridad/README.md). Los hashes originales
y los de las copias versionadas se distinguen; solo se normalizaron espacios
finales y saltos de línea. El manifiesto `SHA256SUMS` permite verificar las copias.

## Limitaciones reales y Pendientes de Walter

1. Orquestador: aplicar S04 con rollback, ensayar y actualizar n8n/runner por S05 y Caddy por S06,
   conservar los cambios de los otros frentes y repetir la aceptación del conjunto.
   No hay cambios del VPS aplicados por esta misión.
2. Walter: ventana de mantenimiento y aceptación de sesión Google, SSE y
   adjuntos reales; los tests usan cuentas/datos ficticios y proveedores simulados.
3. Decidir IP/VPN estable, destinos de túneles y política de tráfico perimetral;
   la propuesta SSH opcional no debe romper el frente del chat. Falta sonda
   externa IPv6 y revisión integral de imágenes por digest.
4. Conservar el pendiente de copias fuera del VPS y su restauración independiente.
   No se sustituyen los pendientes anteriores de Meta, medios, presupuestos y roles.
5. `auditoria-aprendizaje.md` no está en esta base ni entre los archivos localizados;
   no se inventa su contenido. Se consultaron los informes VPS e integración 3,
   ESTADO, especificación, entrega, README y guía de movimiento disponibles.

Fuentes adicionales consultadas antes de usar contratos:
[Auth.js](https://authjs.dev/reference/core),
[Node HTTP](https://nodejs.org/api/http.html),
[CSRF OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[SSRF OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html),
[firewall Docker](https://docs.docker.com/engine/network/packet-filtering-firewalls/) y
[npm audit](https://docs.npmjs.com/cli/v12/commands/npm-audit/).
Se leyeron también las guías de Route Handlers y CSP instaladas con Next 16.4.6.
