---
name: yt-cortes
description: >-
  Los cortes verticales que viven dentro de un video largo (modo storyboard, campo cortes):
  momentos que se entienden solos, con un primer plano nuevo y punto de bucle.
---

# yt-cortes — Shorts que se sostienen solos

Adaptada de `yt-shorts` de Jakeschincariol/youtube-agent-skill (MIT). No preguntes nada; el
resultado sigue el JSON de `skill/FABRICA.md` (`cortes`, solo en videos largos).

Un corte no es «el mejor momento»: es un momento que **sobrevive sin el video alrededor**, que es un
conjunto mucho más chico.

## Elegir

Busca tramos de planos consecutivos de 20 a 55 s de voz donde se cumplan las tres:

1. Empieza con una idea completa. Si la primera frase necesita el minuto anterior, no es un corte.
2. Tiene un giro: una afirmación y luego algo que la complica o la prueba.
3. Termina en una frase, no en un «y entonces…».

## Escribir cada uno

- **Un gancho nuevo** en `cortes[].titulo` y, si hace falta, en el primer plano del corte: la frase
  del video largo supone un contexto que este espectador no tiene. Puntúalo con
  `python3 skill/youtube/yt-guion/ganchos.py --gancho "..."`.
- **Texto en pantalla para los 2 primeros segundos** con palabras distintas de la voz (`texto_pantalla`
  de ese primer plano).
- **Punto de bucle**: que la última frase deje algo que la primera responde.
