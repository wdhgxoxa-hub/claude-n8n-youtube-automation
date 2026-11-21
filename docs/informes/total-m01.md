# M01 — retorno de la fábrica y contrato del cerebro

21-11-2026 (Lima). Rama/worktree `total-m01`, base
`de397f3195856c10b6a9959171ff42da4328d9ec`. Alcance: H08/M01 de
`faltantes-total.md`. **Implementado y probado localmente; no integrado ni
desplegado por esta misión.** No hubo push, merge, cambios en el VPS/n8n vivo,
OAuth, pagos, publicaciones ni acceso a valores de credenciales reales.

## Commits y trabajo reutilizado

Antes de implementar se revisaron `git branch`, los frentes `total-*`, el
historial de `cooper-total` y el aviso del orquestador. El dominio canónico y
`retorno_url` ya estaban cubiertos por `8a8f8a0`; se reutilizó ese commit.

| Commit | Contenido |
| --- | --- |
| `a621530` | Cherry-pick con atribución de `8a8f8a0`. Conflictos resueltos conservando la base de esta misión y regenerando los JSON. **No volver a aplicar si el integrador ya tiene `8a8f8a0`.** |
| `b123c7d537e24ef1f62c14aca6077d9255dc19cd` | Contrato parametrizado, reserva/confirmación del retorno, pruebas y guía de operación/reversa. Código de la puerta. |
| Cierre documental | El commit que incorpora este informe y actualiza `docs/ESTADO.md`; no cambia el código probado. |

Se preservaron los documentos de encargo sin seguimiento: `faltantes-total.md`,
`docs/misiones/_comun.md`, `total-m01.md` y `AVISO-cooper-total.md`.

## Cerrado

- Origen HTTPS estable parametrizado por `FABRICA_ORIGEN_PUBLICO`, coherencia
  `baseUrl`/`retornoUrl`, rechazo de ngrok y transporte fuera de `datos` mediante
  `retorno_version: 1`/`retorno_url`. Skill versionada con destino autorizado,
  autenticación externa, rechazo de redirecciones y respuestas/reintentos.
- Webhook con Header Auth existente; valida modo/prefijo, estructura, tamaño y
  trabajo único. Dueño/canal/video salen de la tabla, no del callback.
- Reserva condicional persistente, huella canónica y exclusión de callbacks
  simultáneos. Confirmados repetidos: `200` sin otro despacho; resultado
  alterado: `409`; reserva en curso o incierta: `202`, sin redespacho automático.
- El receptor espera al Orquestador antes de confirmar. Se reprodujo en n8n
  2.47.4 que cerrar el HTTP con el hijo desacoplado podía dejar una ejecución
  `success` sin nodos ejecutados. El ensayo ahora exige el evento persistido y
  su ruta, no solo ese estado. Se cubren errores y la salida vacía del hijo.
- Timeout de envío: `envio_incierto`, mensaje sin detalles privados y
  actualización condicionada para no sobrescribir un callback previo. El
  resultado tardío resuelve el mismo trabajo.

Implementación, contrato, estados y conciliación:
[guía del retorno](../cooper-retorno-claude.md). Se reutilizaron Data Tables,
Header Auth, `N8nApi` y `ensayo-infra.mjs`; no se creó otra cola/base ni se
añadieron dependencias o columnas.

## Pruebas y evidencia

Regresión roja inicial: dos fallos de parametrización/validación reproducidos
en [rojo.log](../../.cache/total-m01/rojo.log), SHA-256
`1beea9246632b69cfee39255cd29cbd0593b20c03174e5b71d2f577dc74b9e60`.
Los fallos de los ensayos intermedios se conservaron; no se presentan como
ejecuciones limpias. Se corrigieron la espera de registro del webhook, el
tratamiento del rechazo HTTP y los defectos del despacho antes del cierre.

Ensayo específico: `cd cooper && node --test ../tests/retorno_n8n.test.mjs`,
**13/13 PASS (12 subcasos y prueba contenedora), rc 0**, sin omisiones. n8n
2.47.4 real en Podman aislado; credencial efímera, puerto loopback y red interna
sin Internet. [Log final](../../.cache/total-m01/retorno-n8n-final-2.log), SHA-256
`670e964dca8f8ad3e50df87fb1b0d1959d27b240220365829b684fce9f30b29a`.

Cubre clave ausente/incorrecta, propietario persistido, callback auténtico,
duplicado idéntico/reordenado/alterado, modo discordante, trabajo desconocido o
bloqueado, ocho callbacks concurrentes con un despacho, error de routine,
resultado tardío, caída tras reserva y reinicio, fallo de invocación, hijo sin
ítems, URL antigua y reversa. El receptor es la exportación completa; el
Orquestador ejecuta sus nodos Inicio/Ruta y un sumidero ficticio. La routine se
simula ejecutando el preparador original y enviando el resultado por HTTP;
no se contacta Anthropic ni se prueban medios reales.

Puerta obligatoria, secuencial, sobre `b123c7d`:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
```

**PASS: siete códigos 0, cero errores y cero advertencias.** Ejecutada el
21-11-2026 de **11:56:22 a 12:03:46 Lima**. Node **24.22.3**, npm **12.2.2**.

| Paso | Resultado | rc | Duración | Registro / SHA-256 |
| --- | --- | --- | --- | --- |
| `npm ci` | PASS; 0 vulnerabilidades | 0 | 6.43 s | [ci.log](../../.cache/total-m01/puerta-final/ci.log) · `d04add36db043c4bed56cf286b0870aa98f0eb3f46e90ae167c9bcbbc3456944` |
| `npm run lint` | PASS; 0 errores/advertencias | 0 | 4.42 s | [lint.log](../../.cache/total-m01/puerta-final/lint.log) · `82ef02fe294108ee62820c4aac466a1c844a5d882fc917b8239cd96439fed007` |
| `npm run typecheck` | PASS | 0 | 5.28 s | [tipos.log](../../.cache/total-m01/puerta-final/tipos.log) · `0781fae003f31f2e4c5d3eaff30c5369a49d8b236b5cfb6c916d9d89daef524f` |
| `npm test` | 284/284, 30 archivos | 0 | 23.1 s | [unitarias.log](../../.cache/total-m01/puerta-final/unitarias.log) · `d811e722363acc8c02c7a3305d32ba614a3183112c729b938f036e8d554da16c` |
| `npm run test:e2e` | 43/43, incluido Sentinel; sin omisiones/reintentos | 0 | 400.33 s | [e2e.log](../../.cache/total-m01/puerta-final/e2e.log) · `ed8daab8bdb21e252836de6b873aae4511e56cc521ac8368822d0bee4612eb2b` |
| `npm run build` | PASS | 0 | 3.86 s | [build.log](../../.cache/total-m01/puerta-final/build.log) · `7c2b5aabcd0929e0380a791f07c786c08ac87e78fb4e20b6f43e4126ac4691f3` |
| `node --test tests/flujos_v2.test.cjs` | 153/153; sin omisiones | 0 | 1.07 s | [flujos.log](../../.cache/total-m01/puerta-final/flujos.log) · `1bbd38d830a48eb8f88edb53dd469fd4d4bedcbbe1e0fd158f095f0f0eade37b` |

[Resumen de la puerta](../../.cache/total-m01/puerta-final/resultado.json),
SHA-256 `463a333c8b25b66f17507eecd224375157691cb6a6089d097eca34fc1293d6ca`.
Las siete huellas se cotejaron contra sus registros. Navegadores de ensayo
ya instalados, sin descargas de fallback ni supresión de advertencias.
`git diff --check`: PASS. Ningún archivo de código cambió después de la puerta.

## Lote inactivo y reversa

[Lote local con manifiesto](../../.cache/total-m01/lote/manifest.json): tres
workflows con `active: false`, `skill/FABRICA.md`,
[diff n8n](../../.cache/total-m01/lote/delta-n8n.patch) y
[reversa versionada](../../.cache/total-m01/lote/reversa-versionada.patch).
Manifiesto SHA-256:
`c3c093f567070cd2aad434599053671e1ce16f449b7256df28f27c47c08f0308`.
Los parches se aplicaron a una copia temporal y recuperaron los bytes exactos
de los tres JSON de `de397f3`; regenerar los 32 flujos no produjo diferencias.
La prueba n8n además restauró el receptor anterior, conservó los trabajos y
dejó el webhook local despublicado. El contenedor terminó detenido.

Los artefactos están ignorados. El diff se reproduce con
`git diff de397f3 b123c7d -- workflows/v2/FabAjustes000001.json workflows/v2/FabLlamarClaude1.json workflows/v2/FabRetornoClaud1.json`;
invertir los dos commits produce la reversa. **No son respaldos del VPS.**
Integrar como delta, conservando Ajustes/credenciales/IDs y los cambios de los
otros frentes; no sobrescribir su versión del generador o de la skill.

## Limitaciones reales y Pendientes de Walter

1. Instalar esta versión de la skill en la routine externa, cotejar su destino
   y la asociación de Header Auth sin exponer la credencial. No se inspeccionó
   ni modificó la configuración externa; su aceptación sigue pendiente.
2. El orquestador debe integrar y revisar el lote combinado, respaldar las
   versiones/estados reales, aceptar un ensayo ficticio autorizado y decidir
   la reapertura del retorno separadamente. No se reactivó ninguna entrada.
3. Decidir con el orquestador qué trabajos históricos continúan. Una reserva
   incierta exige conciliar sus efectos; no hay reintento automático ni
   garantía transaccional de entrega exactamente una vez entre workflows.
4. El HTTP espera al tramo síncrono del Orquestador; una desconexión no prueba
   que haya fallado. Aprobaciones, subflujos posteriores y producción real no
   quedan aceptados por estas pruebas. Los recibos antiguos no se reconstruyen.

Las fuentes oficiales actuales consultadas están enlazadas en la guía. No se
usó una API nueva de Anthropic ni se disparó la routine real. No se convirtió
ninguna idea conversada en trabajo aprobado.
