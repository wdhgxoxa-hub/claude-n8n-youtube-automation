---
name: yt-capitulos
description: >-
  Capítulos de un video largo que YouTube sí muestra (modo guion, campo capitulos, y la
  descripción): empiezan en 0:00, son tres o más y duran 10 s o más cada uno; se validan con capitulos.py.
---

# yt-capitulos — capítulos que se ven

Adaptada de `yt-chapters` de Jakeschincariol/youtube-agent-skill (MIT). No preguntes nada. Solo en
videos largos; en Shorts, `capitulos` va vacío.

```bash
python3 skill/youtube/yt-capitulos/capitulos.py capitulos.json --duracion 600
```

## Reglas que no son opcionales

Una lista que rompe alguna no se convierte en capítulos: el bloque queda en la descripción sin hacer nada.

- El primero es **0:00**.
- Hay **al menos tres**.
- Cada uno dura **10 segundos o más**.

## Titula cada uno como una promesa

Cada título es la promesa de esa sección, en la voz del canal, de 3 a 5 palabras («Lo que se lleva el
Estado», no «Impuestos»). Si una sección no se puede nombrar en cinco palabras, son dos secciones o es
relleno: corrige el guion.
