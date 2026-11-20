---
name: yt-empaque
description: >-
  Título y miniatura como UNA pareja (modo storyboard, campo publicacion y miniatura): diez
  títulos, revisados con titulo.py por corte de celular y escritorio, mayúsculas, vaguedad y
  repetición con la miniatura; se entregan los tres mejores.
---

# yt-empaque — título y miniatura juntos

Adaptada de `yt-package` de Jakeschincariol/youtube-agent-skill (MIT). No preguntes nada; el
resultado sigue el JSON de `skill/FABRICA.md`. Manda `skill/roles/editor-publicacion.md` si chocan.

```bash
python3 skill/youtube/yt-empaque/titulo.py titulos.txt --miniatura "TEXTO MINIATURA"
python3 skill/youtube/yt-empaque/titulo.py --titulo "..." --miniatura "..."
```

## Lo que revisa la herramienta, y por qué

- **40 caracteres** es lo que muestra el inicio del celular; **60**, la búsqueda de escritorio. El
  tema y la cifra tienen que caber en los primeros 40.
- **La miniatura no repite el título**: palabras distintas, misma promesa.
- **Máximo 3 palabras en la miniatura**: a tamaño de feed, la cuarta es una mancha gris.
- **Un número, un nombre o una fecha** gana a cualquier adjetivo.
- **Máximo dos palabras en mayúsculas** en el título.

## Escribe diez, entrega tres

Escribe diez títulos, pásalos por `titulo.py` y pon en `publicacion.youtube.titulos` los **tres
mejores** (la fábrica los puntúa además con vidIQ). En videos largos, escribe la miniatura para el
ganador: idea visual, encuadre, las 3 palabras (`miniatura.texto`) y qué hace el fondo para tener
contraste a tamaño de feed (en `miniatura.concepto`). En Shorts la miniatura es `null`.
