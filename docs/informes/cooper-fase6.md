# Informe — fase 6: noticias y puente Codex

Fecha: 20-11-2026. Rama: `cooper-fase6`. Worktree: `/home/david/Proyectos/cooper-wt/cooper-fase6`. Base: `96bc916`. Código final verificado: **`347aa43b002ee995b9643b0099a4ec464cb732df`**. El commit posterior solo añade este informe.

## Commits

| Commit | Contenido |
| --- | --- |
| `d18302d` | Servicio local autenticado, ejecución Codex aislada, simulador y documentación. |
| `8efc198` | Subflujo GPT con respaldo API, radar/verificación de noticias, guardias de guion/storyboard/medios/publicación, migración aditiva y pruebas. |
| `941b28c` | Activación por canal y chat, persistencia y conciliación de Cooper, pruebas unitarias y E2E. |
| `291d380` | Corrección de etiqueta accesible y sesión de navegador en el ensayo de noticias. |
| `347aa43` | Rechazo de búsquedas fallidas como evidencia, con regresión en Codex simulado. |

## Qué se implementó

- Modo noticia por canal y por pedido desde Cooper; herencia congelada en el video, validación booleana y permisos existentes. El simulador se detiene explícitamente en Verificación.
- Radar del día por nicho y verificador independiente, con fechas de Lima, fuentes citadas y URLs respaldadas por actividad de búsqueda. Un dossier vacío, antiguo, contradictorio o sin fuentes detiene el proceso.
- Verificación obligatoria del guion y del storyboard; huellas SHA-256 para impedir que una versión diferente llegue a producción. Las correcciones invalidan los certificados. Revalidación de la fila persistida antes de publicar.
- Mapas, cifras y esquemas propios, generados por las rutas audiovisuales existentes. Se rechazan planos de archivo, avatares y URLs de medios; las noticias no reutilizan referencias visuales del canal.
- `puente-codex`: HTTP loopback autenticado, prompt por stdin, entorno sin claves API, sandbox de lectura, sin shell/apps/hooks, una ejecución simultánea, límite de salida, timeout y cancelación del grupo de procesos. No se registran prompts, respuestas, cabeceras o stderr.
- Crítico, verificador y radar intentan Codex primero. Caída, timeout, saturación o respuesta inválida seleccionan Responses API si `allowTextoApi` está activado. Se registran proveedor efectivo, costo y ahorro estimados por tarea y dueño. El gasto API empieza apagado.
- Documentación de operación, contratos, fuentes oficiales y límites en [modo noticia](../cooper-modo-noticia.md) y [puente Codex](../puente-codex.md). Variables de ejemplo sin secretos en [`.env.example`](../../servicios/puente-codex/.env.example).

## Evidencia de la puerta obligatoria

Ejecutada íntegramente sobre `347aa43`, con `pipefail`, sin saltos ni pruebas omitidas:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
```

| Comando | Resultado | Código |
| --- | --- | --- |
| `npm ci` | PASS; 357 paquetes instalados, 364 auditados, 0 vulnerabilidades. | 0 |
| `npm run lint` | PASS; 0 errores y 0 advertencias. | 0 |
| `npm run typecheck` | PASS; TypeScript estricto. | 0 |
| `npm test` | PASS; 120 pruebas en 16 archivos. | 0 |
| `npm run test:e2e` | PASS; 23 escenarios Chromium, incluidas auditorías axe y modo noticia. | 0 |
| `npm run build` | PASS; Next.js 16.4.6. | 0 |
| `node --test tests/flujos_v2.test.cjs` | PASS; 129 pruebas, 0 omitidas. | 0 |
| `node --test tests/puente-codex.test.mjs` | PASS; 10 pruebas con ejecutable Codex ficticio y HTTP local. | 0 |
| `node --test tests/migrar_dueno.test.mjs` | PASS; 7 pruebas con tablas ficticias (sin cambios posteriores en migración). | 0 |

Cadena final completa, incluidos flujos y servicio: **0**. Escaneo de los cuatro logs finales: **0 advertencias**. No se desactivaron reglas de lint, auditorías ni pruebas. Se desactivó únicamente el aviso de actualización de npm y la telemetría de Next; `PYTHONDONTWRITEBYTECODE=1` evita artefactos Python en el repositorio.

Evidencia local, excluida de Git y reproducible:

- [Puerta completa](../../cooper/.cache/fase6/puerta-completa.log).
- [Flujos](../../cooper/.cache/fase6/flujos.log), [servicio](../../cooper/.cache/fase6/servicio.log), [migración](../../cooper/.cache/fase6/migracion.log).
- [Generación](../../cooper/.cache/fase6/generacion.log): regenerar los JSON no produjo diferencias; los diez workflows modificados/nuevos permanecen inactivos y sin `pinData`.
- [Captura 390 px](../../cooper/test-results/visual/noticias-390.png) y [1440 px](../../cooper/test-results/visual/noticias-1440.png), inspeccionadas. El ensayo verifica ausencia de desbordamiento y violaciones axe en ambos tamaños; la suite conserva ambos temas y la matriz de anchuras anterior. El enlace de salto visible en las capturas refleja el foco de la auditoría.

Entorno: Node.js 24.22.3, npm 12.2.2, Python 3.14.10, Next.js 16.4.6, Chromium 159.0.8154.6. E2E usa sesiones y bases temporales del arnés existente. No se inició sesión Google ni se llamó a proveedores pagos.

La primera puerta falló en cuatro escenarios E2E: tres detectaron la misma etiqueta accesible incompleta y el cuarto usaba una sesión HTTP ajena al contexto del navegador. Se corrigieron las causas y se repitió toda la cadena. Durante la primera provisión, Playwright avisó de que descargaba su compilación compatible Ubuntu 24.04 para este SO; las puertas posteriores usaron ese navegador instalado sin advertencias. [Log inicial conservado](../../cooper/.cache/fase6/puerta-inicial.log). La última puerta incluye también la corrección de evidencia de búsqueda del servicio.

## Limitaciones reales

- No se ejecutó contra n8n en vivo ni contra la cuenta ChatGPT de Walter. Las pruebas de fábrica ejecutan el JavaScript generado y revisan el grafo; no son un ensayo de importación y ejecución en una instancia n8n de esta fase. El servicio sí se ejercitó por HTTP con un proceso Codex simulado.
- No se garantiza que el CLI instalado en producción exponga URLs en sus eventos JSONL. Si no lo hace, las noticias pasan al respaldo API; si este está apagado o falla, se detienen. Sesión, cuota y disponibilidad del modelo siguen pendientes de comprobación real por Walter.
- La verificación con modelos y fuentes no garantiza veracidad ni exactitud de mapas generados. Se conservan las aprobaciones editoriales humanas. No hubo generación audiovisual paga ni medición real del plazo «en horas».
- Las noticias vencen al cambiar el día de Lima o superar 24 horas desde verificación. No se publican automáticamente al día siguiente. Los bloqueos quedan en la última etapa persistida y en el vigilante de errores; no hay una cola nueva de recuperación automática.
- Ahorro y costo son estimaciones de tareas completadas. Excluyen precio fijo del plan, infraestructura e intentos fallidos/incompletos; no constituyen conciliación de facturas.
- El puente requiere loopback compartido o túnel local administrado entre n8n y el servicio. No se modificó infraestructura para hacerlo accesible.

## Pendientes de Walter

1. Revisar e integrar los commits; después aplicar las columnas aditivas e importar los workflows mediante el procedimiento habitual. Revisar especialmente guardias de noticias, caducidad y atribución de costos.
2. Preparar un usuario de sistema dedicado con Codex y su sesión ChatGPT, sin acceso a documentos privados ni conectores adicionales. Configurar el token del puente en almacenamiento privado y el acceso loopback de n8n. No copiar autenticación al repositorio.
3. Confirmar la credencial y modelo de respaldo, ajustar tarifas estimadas y habilitar `allowTextoApi`; decidir canales y `allowRadar`. Los interruptores audiovisuales conservan su estado anterior.
4. Realizar un ensayo manual acotado de noticia real, éxito Codex, timeout/cuota agotada, respaldo y bloqueo por fuentes insuficientes. Validar revisión editorial, mapas/cifras y alertas antes de habilitar producción.

No hubo push, merge, despliegue, pagos, OAuth, cambios en D&S Factory ni lectura/copia de secretos reales. Se conservaron intactos los directorios no versionados preexistentes `docs/diseno/` y `docs/misiones/`. Entrega lista para revisión independiente; no se declara integrada ni probada en vivo.
