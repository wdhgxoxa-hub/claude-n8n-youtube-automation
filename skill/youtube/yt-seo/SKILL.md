---
name: yt-seo
description: >-
  Descripción, etiquetas y las tres búsquedas que debe ganar un video (modo storyboard, campo
  publicacion.youtube). Úsala al escribir la descripción y los tags.
---

# yt-seo — que lo encuentre quien lo busca

Adaptada de `yt-seo` de Jakeschincariol/youtube-agent-skill (MIT). No preguntes nada; el resultado
sigue el JSON de `skill/FABRICA.md`. La búsqueda pesa menos que el empaque, pero mucho en videos que
se buscan durante años (los de «cuánto gana un…» lo son).

## La descripción

- **Las dos primeras líneas son las únicas que se leen**: salen antes de «…más» y son el fragmento de
  la búsqueda. Di qué le da el video, con las palabras que el espectador escribiría.
- Luego, las fuentes principales (las cifras del video, con su fecha).
- Luego, en videos largos, los capítulos (ver `yt-capitulos`).
- Los créditos de música y archivo los agrega la fábrica: no los escribas.

## Etiquetas, con honestidad

Las etiquetas pesan poco. Úsalas para desambiguar: variantes de escritura («grifo», «gasolinera»,
«estación de servicio»), nombres propios y siglas que la gente escribe. Máximo 15. Llenar con
etiquetas ajenas va contra las reglas de YouTube.

## La prueba de las búsquedas

Antes de entregar, escribe en `publicacion.youtube.consultas` las **tres búsquedas** que este video
debe ganar y comprueba que el título y las dos primeras líneas de la descripción contienen sus
palabras. Si no, el problema es el título, no la descripción.
