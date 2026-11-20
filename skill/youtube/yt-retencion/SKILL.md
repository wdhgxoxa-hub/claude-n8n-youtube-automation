---
name: yt-retencion
description: >-
  Leer la retención de los videos publicados (modo aprender): fuga del gancho, acantilados y
  deslizamiento, cruzados con la frase y el plano de ese momento; una sola corrección principal.
---

# yt-retencion — dónde se van, y qué cambiar

Adaptada de `yt-retention` de Jakeschincariol/youtube-agent-skill (MIT). No preguntes nada; el
resultado sigue el JSON de `aprender` en `skill/FABRICA.md`, con el rol `skill/roles/analista.md`
(una lección solo si el patrón aparece en 3 o más videos).

## Tres problemas distintos

- **Fuga del gancho**: lo que se pierde en los primeros 30 s (en Shorts, en los primeros 3 s). Por
  debajo del 25 % es sano. Siempre es lo primero que se arregla, y siempre es el guion de los primeros
  segundos, nunca el montaje. Crúzala con la fórmula del gancho de cada video (`motivo_gancho`).
- **Acantilados**: caídas bruscas en un momento. Son un momento: un cambio de tema sin aviso, una
  explicación larga, una cifra sin imagen. Di qué frase y qué plano había en ese segundo.
- **Deslizamiento**: la pérdida pareja en el medio. Es ritmo; se arregla cortando, no reescribiendo.

## Qué entregar

La fuga más grande y **una** corrección para ella, como regla aplicable. Si la fuga del gancho está
sana y el deslizamiento es plano, el video está bien y el problema es el empaque: dilo en `resumen`
(lo trabaja `yt-empaque`).
