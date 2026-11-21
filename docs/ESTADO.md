# ESTADO — Fábrica de videos + Cooper (se actualiza en cada conversación)
Última actualización: 2026-11-21 07:30 (Lima)

## Qué es
- Fábrica de videos en n8n (canal de pruebas: Margen Real) + Cooper (web y chat en cooper/) para Walter y su equipo (3–4 personas). Todo es de Walter: sus marcas y cuentas. Sin clientes externos.
- Claude dirige y revisa; Codex (gpt-6-astra, razonamiento xhigh) hace el trabajo pesado en misiones (docs/misiones/), con informes en docs/informes/.

## Hecho
- Fases 1–6 de Cooper programadas y en GitHub (main/version-chatgpt): web con animaciones, chat con suscripción de Claude (respaldo Codex), puente firmado con n8n, avatares/voces (simulados hasta autorizar gasto), WhatsApp, VPS, modo noticia (apagado), GPT por plan ChatGPT vía Codex.
- Cooper corre en la PC: http://localhost:3000 (cooper.service). Admin: wdhg.xoxa@gmail.com.
- Google OAuth: cliente «Cooper web» (proyecto n8n-videos), callbacks localhost y cooper.cooperestudio.com.
- Meta: portafolio «Cooper Estudio», app «Cooper», usuario de sistema cooper-bot con token permanente (~/.config/cooper/whatsapp-token), número +51 939 484 675 registrado, 4 plantillas en revisión.
- Contabo: Cloud VPS 4 (UE, mensual €5.50), pedido 15717272, esperando IP. Dominio cooperestudio.com (Cloudflare).
- cooper-memoria: memoria privada por usuario/canal, recuperación más allá de 30 mensajes, tarjeta «Donde lo dejamos», consulta administrativa y borrado sin reutilizar mensajes anteriores implementados en la rama aislada `cooper-memoria`. Código: `fb1a25c`, interfaz: `612ea85`, cierre probado: `56d864f`. Puerta completa: 247 unitarias, 34 E2E y 130 pruebas de flujos, sin errores ni advertencias. Validación y condiciones de integración en [informe](informes/cooper-memoria.md); no desplegado.
- cooper-cobertura: pulido y memoria reunidos en el worktree/rama propios `cooper-cobertura`; once pantallas de operación, 30 flujos/1.203 nodos auditados, 121 decisiones/esperas, 58 ajustes y nueve tablas cubiertos. Chat breve conservado. Puerta conjunta: 259 unitarias, 40 E2E y 146 pruebas de flujos; dos rondas finales de Sentinel/Playwright limpias (17/17 cada una), 44 mediciones Lighthouse sin advertencias. Código `5381a01`, ensayo `e7c160e`; [informe y tabla de cobertura](informes/cooper-cobertura.md), [lote con respaldo/reversa para Claude](cooper-cobertura-despliegue.md). Sin despliegue, fusión a `version-chatgpt` ni push de esta misión.
- cooper-animacion2: dirección propia de movimiento en todas las pantallas, cuatro ilustraciones Lottie originales, fábrica animada, bienvenida, celebración y pausa/reducido completos. Código `f852849` sobre cobertura `d98d497`; puerta: 263 unitarias, 40 E2E y 146 pruebas de flujos, cero errores/advertencias. Dos rondas completas limpias (10/10 cada una), 168 muestras cerca de 60 fps, móvil con CPU 4×; Sentinel: 32.939 acciones sin errores ni advertencias. Lighthouse: 84 mediciones, rendimiento 96–100 y accesibilidad/buenas prácticas 100. 176 videos a 1440/390 px decodificados y con índice en el worktree propio. [Informe, métricas y videos](informes/cooper-animacion-fuerte.md). Implementado y probado; sin integración, push ni despliegue. La prueba en teléfono físico sigue pendiente.
- Regla permanente en `AGENTS.md`: cada misión de Codex actualiza este ESTADO al terminar, preservando hecho, en curso, pendientes de Walter e ideas.

## En curso (Codex)
- cooper-vps-real: espera IP → instala n8n+Cooper+Caddy+copias → migra desde la PC.
- Revisión e integración de `cooper-cobertura` en `version-chatgpt`: incluye pulido y memoria y ya pasó la puerta conjunta. Sigue pendiente terminar la misión VPS; `cooper-vps-real` y `version-chatgpt` permanecen en `16341ab` al cierre. Conservar las migraciones 0008 observabilidad / 0009 memoria y el respaldo real del destino antes de instalar el lote.
- Revisión de movimiento e integración de `cooper-animacion2`: incluye cobertura, memoria y pulido. Lista para Claude; la fase B del VPS continúa pendiente de IP, SSH y DNS, de modo que todavía no se cumple la condición para fusionar a `version-chatgpt`.

## Pendiente de Walter
1. Método de pago en Meta (Cooper Estudio > Facturación y pagos).
2. Cuando llegue la IP: ejecutar el comando ssh-copy-id (~/.config/cooper/ssh-copy-id.txt) con la contraseña del servidor.
3. Probar Cooper en su Chrome (localhost:3000) y entrar con Google.
4. Aprobar en Telegram el guion del Short v-mwp2bjgj-7fvq.
5. Tras integrar memoria, revisar los recuerdos con conversaciones ficticias usando el proveedor del plan. Las evaluaciones locales no miden la calidad semántica del modelo real; la síntesis añade una llamada por turno y hasta 12 segundos.
6. Tras la revisión e integración de cobertura, fijar presupuestos/modelos/interruptores y perfiles de publicación, conceder permisos OAuth cuando corresponda y autorizar una producción real de validación. El ensayo local no valida la calidad editorial ni la entrega real de avisos.
7. Revisar con Claude los videos de movimiento y probar la experiencia en un teléfono físico de gama media (y Safari si se utiliza). Tras la integración y autorización de producción, validar la celebración con una publicación real y medir rendimiento en el destino.

## Ideas conversadas (aún no construidas)
- Manejo de redes de sus marcas (iglesia a la que asiste, futura tienda de ropa, cuentas de su equipo) en cualquier red: estudiar la cuenta, calendario, avisos (domingos, grupos en casa, eventos), fotos/videos/avatares, especialista por rubro (p. ej. reformado), aprobación de Walter y publicación automática por n8n.
- Microserie con IA (aplazada).
