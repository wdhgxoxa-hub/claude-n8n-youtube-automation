# Skills de YouTube de la fábrica

Seis skills que Claude usa por sí solo según el modo que le encarga n8n (`skill/FABRICA.md`, regla 8). Viven aquí y no en `.claude/skills` para que el contrato las nombre de forma explícita en cada modo.
Adaptadas al español y al trabajo sin preguntas de la fábrica desde
[Jakeschincariol/youtube-agent-skill](https://github.com/Jakeschincariol/youtube-agent-skill)
(MIT, commit `a2feb21`; licencia en `LICENSE-youtube-agent-skill`).

| skill | modo | herramienta |
| --- | --- | --- |
| `yt-guion` | guion, corregir_guion | `ganchos.py` (21 fórmulas en español; también corre en n8n) |
| `yt-empaque` | storyboard → títulos y miniatura | `titulo.py` (también corre en n8n) |
| `yt-seo` | storyboard → descripción, tags, consultas | — |
| `yt-cortes` | storyboard → cortes de videos largos | usa `ganchos.py` |
| `yt-capitulos` | guion → capítulos de videos largos | `capitulos.py` |
| `yt-retencion` | aprender | — |

Descartadas por no aplicar a una fábrica sin cámara: `yt-edit`, `yt-plan` (ya hay calendario),
`yt-viral` (lo hace vidIQ), `yt-comment` y `yt-audit` (más adelante).

Los modelos GPT de n8n (crítico, revisor) no leen skills: las reglas que necesitan van incrustadas
en `skill/roles/*.md`. El puntaje de ganchos y la revisión de títulos los calcula n8n con estos mismos
`ganchos.json` y `titulo.json`, como alerta (nunca deciden solos).
