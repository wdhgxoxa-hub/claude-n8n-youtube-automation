# Entrega: fase 4, WhatsApp Business

Fecha: 20 de noviembre de 2026. Rama y worktree exclusivos: `cooper-fase4`, `/home/david/Proyectos/cooper-wt/cooper-fase4`.
Base: `96bc916b20a58c76211636f1248a57c029d1e3f3`. Código final verificado: **`a38aa018a8a2fb7c8be770a29e5ae65a6f0bf9fa`**. El commit posterior solo añade este informe.

## Commits

| Commit | Contenido |
| --- | --- |
| `01daeca` | Interfaz de mensajería, Cloud API y simulador; migración SQLite, OTP, cola, webhook, entregas, límites, enlaces, conexión con fábrica, cinco plantillas y 36 pruebas específicas. |
| `a38aa01` | Perfil con verificación y preferencias, retorno a la revisión después de entrar, prueba de navegador, README y guía de alta. |
| Commit de este informe | Evidencia final y pendientes; sin cambios de ejecución. |

No se hizo push, merge, despliegue, login OAuth, pago ni envío real. No se accedió a n8n en vivo ni a D&S Factory. No se leyeron archivos de entorno reales; solo `.env.example`. Los directorios preexistentes sin versionar `docs/diseno/` y `docs/misiones/` se conservaron fuera de los commits.

## Qué quedó implementado

- `ProveedorMensajeria`, `WhatsAppCloudAPI` y `WhatsAppSimulada`; ruta oficial de Messages en Graph v27.0 consultada en Meta. Modo simulado por defecto y obligatorio en demo. Las cuatro variables solicitadas están vacías en `.env.example`.
- Verificación del número con OTP de seis cifras, diez minutos, cinco comprobaciones y límites por cuenta/teléfono. Consentimiento explícito; preferencias separadas para guion, final y publicado; gasto solo administrador. Un número no puede verificarse para dos cuentas. Cambiarlo o verificarlo otra vez invalida el vínculo anterior.
- Enlaces HMAC de 24 horas, sujetos a sesión, dueño, consentimiento y revisión vigente. Abrirlos no muta el video. El inicio de sesión conserva el destino mediante un formato cerrado, sin redirecciones arbitrarias.
- Webhook con desafío GET y firma `X-Hub-Signature-256` sobre bytes. Botones Aprobar/Cambios dentro de la ventana; contexto y revisión comprobados. Deduplicación persistente de entradas y decisiones. Baja por mensaje.
- Cola persistente, reservas transaccionales, cinco intentos con backoff para errores transitorios, registro de entregas y límites de cinco intentos/hora y veinte/día por cuenta. No limita videos ni gasto. Estados ambiguos no se reenvían automáticamente.
- Encolado transaccional desde progreso simulado y n8n; consumidor cada quince segundos en Node persistente, independiente del navegador. Consulta de alerta diaria solo si Walter la activó.
- Cuatro plantillas `UTILITY` en español y una `AUTHENTICATION`, con generador local para sustituir el dominio definitivo. Documentación oficial, alta, suscripción, operación y modelo actual de precios en [cooper-whatsapp.md](../cooper-whatsapp.md).

## Puerta obligatoria

Ejecutada sobre `a38aa01`, con `pipefail` y sin modificar código durante la ejecución:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
```

Desde la raíz:

```bash
node --test tests/flujos_v2.test.cjs
```

| Comprobación | Resultado | Código |
| --- | --- | --- |
| `npm ci` | 357 paquetes instalados; 364 auditados; 0 vulnerabilidades | 0 |
| `npm run lint` | 0 errores y 0 advertencias | 0 |
| `npm run typecheck` | TypeScript estricto | 0 |
| `npm test` | 153/153, 16 archivos; incluye 36 casos WhatsApp | 0 |
| `npm run test:e2e` | 23/23 Chromium; habitual y demostración; sin omisiones | 0 |
| `npm run build` | Compilación de producción correcta | 0 |
| Regresión de workflows | 119/119; sin omisiones | 0 |

Cadena completa y regresión: **código 0, cero advertencias en los logs finales**. Entorno: Node 24.22.3, npm 12.2.2, Next 16.4.6, Vitest 4.1.12, Playwright 1.65.1. Bases, sesiones y secretos de prueba aislados. `TMPDIR` de la regresión se dirigió a `cooper/.cache` y se desactivó el bytecode Python. No se alteraron los comandos de prueba ni se ocultaron advertencias.

Evidencia local reproducible, excluida de Git:

- [Log de la puerta](../../cooper/.cache/fase4-puerta.log). SHA-256: `bb7e0e50680ee78d9acdfdf97f790a546298974c0f5087d642fcd2db8061bae4`.
- [Log de workflows](../../cooper/.cache/fase4-flujos.log). SHA-256: `78a6d5468026437e49f0970059a10d7e8a59cdcc9424e1a665759058a54e7d3c`.
- [Perfil móvil](../../cooper/.cache/capturas-whatsapp/perfil-390.png) y [perfil escritorio](../../cooper/.cache/capturas-whatsapp/perfil-1440.png), revisados visualmente después de la puerta. Sin desbordamiento ni violaciones axe detectadas. La suite general también verifica ambos temas y su matriz de anchuras; esto no constituye certificación universal WCAG.
- [Reporte Playwright](../../cooper/playwright-report/index.html). El generador local produjo cinco JSON válidos con origen ficticio HTTPS sustituido en URL y ejemplos, sin red.

Durante el desarrollo se corrigieron el aislamiento de fixtures y un selector accesible del campo WhatsApp; se regeneraron tipos de Next tras mover la ruta de revisión. La descarga inicial de Chromium avisó que utilizaba el paquete compatible de Ubuntu; la puerta final, con el navegador instalado, no emitió advertencias. No se omitió ninguna prueba fallida.

## Limitaciones reales

1. El transporte real está implementado y probado por contrato con mocks; **no se verificó contra una cuenta Meta**. Los JSON requieren el dominio real y aprobación de Meta, incluida la plantilla OTP. No se envían solos a revisión.
2. No se promete entrega exactamente una vez en Meta. Timeout, respuesta ambigua o reserva huérfana requieren conciliación manual. Los recibos se correlacionan por ID remoto; sin ese ID no se presume entrega ni se acepta una decisión por botón.
3. Una acción interrumpida puede quedar `procesando` o `incierta`; el administrador debe revisar el video antes de repetir. Las correcciones por WhatsApp transmiten una petición genérica; el detalle se completa en Cooper.
4. Node persistente y una SQLite compartida por sus procesos. No es un trabajador para funciones efímeras ni para réplicas con bases independientes. La simulación de producción conserva su dependencia previa de SSE.
5. Solo números E.164; mensajes identificados únicamente mediante BSUID/username se ignoran. Cuerpos de webhook limitados a 1 MiB. No hay purga automática de historial ni tarifario incrustado; la retención y copias requieren operación de fase 5.
6. No se auditó Lighthouse en esta misión: se verificaron funcionalidad, axe, retícula y capturas con las suites descritas. No se atribuyen métricas de rendimiento ni resultados reales de entrega a pruebas simuladas.

## Pendientes de Walter

- Elegir y registrar el número de Cooper, completar verificaciones de negocio/teléfono y asignación de permisos de la aplicación.
- Confirmar dominio HTTPS y callback; generar los JSON con ese origen y obtener aprobación de las cinco plantillas.
- Configurar `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` en el servidor y comprobar `AUTH_URL`/`AUTH_SECRET` sin compartir valores.
- Confirmar tarifas actuales y facturación; autorizar un ensayo real con consentimiento de cada destinatario. Volver a verificar números al pasar de simulación a real.
- Fijar retención, copias y procedimiento para estados inciertos; decidir si hacen falta identidades BSUID.

Revisión independiente sugerida: autorización por dueño/revisión, revocación de números, reservas e incertidumbre de envío y contratos de Meta. La entrega está lista para revisar; no está integrada ni desplegada.
