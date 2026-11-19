# Distribución en redes: reglas de la fábrica

Nivel de evidencia: **C** ciencia, **P** práctica profesional o documentación de la plataforma, **H** hipótesis que cada canal confirma con sus propios datos (modo `aprender`).

## Lo que hace la fábrica sola (M8 · Publicación en redes)

| Regla | Valor por defecto (Ajustes → `calendario`) | Nivel | Base |
| --- | --- | --- | --- |
| Videos largos por canal | 1 cada 2 días como máximo (2–4 por semana) | P | Metricool 2026: 2–4 videos largos por semana dan más vistas por video ([estudio](https://metricool.com/youtube-trends/)) |
| Shorts que acompañan al largo | 2–3 cortes del mismo tema por cada largo | P | Canales con ~5 Shorts al mes tienen ~46 % más vistas por video largo (Metricool 2026); vidIQ recomienda 2–3 Shorts del mismo tema por largo ([vidIQ](https://vidiq.com/blog/post/youtube-shorts-for-brands/)) |
| Cortes repartidos | días 1, 3 y 5 después del largo | H | Cada corte es una nueva puerta al largo; se mide con `aprender` |
| Hora del largo en YouTube | 11:00 hora local del público | P | Margen para que YouTube lo indexe antes de la hora punta |
| Hora de Shorts | 16:00 | P | Buffer 2026: Shorts rinden mejor por la tarde |
| Hora de TikTok | 19:00 | P | Metricool 2026 (2,3 M de posts): mejor franja 18:00–20:00 ([estudio](https://metricool.com/best-time-post-tiktok/)) |
| Hora de Reels (Instagram) | 20:00 | P | Reels rinden más al atardecer y de noche (Metricool, Sprout) |
| Hora de Facebook | 21:00 | H | Metricool: Reels de Facebook rinden de noche |
| Tope por canal, red y día | 2 | P | TikTok limita ~15 publicaciones por cuenta al día vía API; más de 2 diarias canibaliza el alcance |
| Mismo video en varias redes | Sí, sin marca de agua y con texto propio por red | P | No hay penalización por publicar en varias redes; sí por marcas de agua y textos copiados ([post-bridge](https://www.post-bridge.com/blog/does-cross-posting-hurt-engagement)) |
| Etiqueta de contenido de IA | Siempre (`is_ai_generated`, `containsSyntheticMedia`, `is_aigc`) | P | Exigida por YouTube, TikTok y Meta para contenido sintético realista |

Las horas son **del público**, no del servidor. Por defecto, `calendario.zona` (America/Lima). Para un canal con público en otro país, dile al agente de Telegram, por ejemplo: «configura las redes de mi-canal con el perfil mx en youtube y tiktok, zona America/Mexico_City». La fábrica valida la zona y agenda a esa hora local.

Además, cada mañana a las 8:10 la fábrica avisa los videos que llevan más de 24 h sin avanzar, y los lunes envía el reporte de la semana por canal.

## Lo que Claude debe cuidar al escribir (storyboard → `publicacion` y `cortes`)

1. **Cada corte se entiende solo** y abre con su propio gancho en el primer segundo; termina invitando al video completo (el texto lo pone la fábrica).
2. **Texto distinto por red**: TikTok e Instagram, 1–2 frases que abran curiosidad y 3–5 hashtags; YouTube, título con la palabra clave al inicio (≤ 70 caracteres) y descripción con fuentes; Facebook, algo más largo y explicativo.
3. **Nada de clickbait** que el video no cumpla: baja la retención y, en YouTube, la monetización.
4. **Originalidad entre videos del canal**: YouTube no monetiza contenido «repetitivo o de plantilla» ([política](https://support.google.com/youtube/answer/1311392)). Variar estructura, gancho y recursos visuales.

## Cómo aprende cada canal (2 y 7 días)

- YouTube: curva de retención del largo.
- TikTok, Reels, Shorts, Facebook: vistas, likes, comentarios, compartidos y guardados por envío (Upload-Post).
- Una regla nueva entra a la biblia del canal solo si se repite en 3 videos; las horas por defecto se ajustan cuando el canal tenga datos propios (cambiar `calendario.horas` con `ajustar_biblia` o en Ajustes).
