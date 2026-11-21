# ESTADO — Fábrica de videos + Cooper (se actualiza en cada conversación)
Última actualización: 2026-11-21 03:27 (Lima)

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
- Regla permanente en `AGENTS.md`: cada misión de Codex actualiza este ESTADO al terminar, preservando hecho, en curso, pendientes de Walter e ideas.

## En curso (Codex)
- cooper-vps-real: espera IP → instala n8n+Cooper+Caddy+copias → migra desde la PC.
- cooper-pulido: videos reales, sección Publicados (métricas), sección Aprendizaje (fallos y correcciones), chat ultra corto, pruebas masivas con Sistema Sentinel.
- Integración de cooper-memoria: preparada desde `16341ab`, pendiente de finalizar cooper-pulido y la misión VPS; conservar ambas migraciones (0008 observabilidad / 0009 memoria) y repetir la puerta sobre la combinación antes de fusionar.

## Pendiente de Walter
1. Método de pago en Meta (Cooper Estudio > Facturación y pagos).
2. Cuando llegue la IP: ejecutar el comando ssh-copy-id (~/.config/cooper/ssh-copy-id.txt) con la contraseña del servidor.
3. Probar Cooper en su Chrome (localhost:3000) y entrar con Google.
4. Aprobar en Telegram el guion del Short v-mwp2bjgj-7fvq.
5. Tras integrar memoria, revisar los recuerdos con conversaciones ficticias usando el proveedor del plan. Las evaluaciones locales no miden la calidad semántica del modelo real; la síntesis añade una llamada por turno y hasta 12 segundos.

## Ideas conversadas (aún no construidas)
- Manejo de redes de sus marcas (iglesia a la que asiste, futura tienda de ropa, cuentas de su equipo) en cualquier red: estudiar la cuenta, calendario, avisos (domingos, grupos en casa, eventos), fotos/videos/avatares, especialista por rubro (p. ej. reformado), aprobación de Walter y publicación automática por n8n.
- Microserie con IA (aplazada).
