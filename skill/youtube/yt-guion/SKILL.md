---
name: yt-guion
description: >-
  Ganchos y guion de un video de la fábrica (modos guion y corregir_guion): 21 fórmulas de gancho
  en español, cinco candidatos puntuados con ganchos.py y la estructura de los primeros 15 segundos.
  Úsala siempre que escribas o corrijas un guion, un gancho o el primer plano de un corte.
---

# yt-guion — ganchos que retienen

Adaptada de `yt-script` de Jakeschincariol/youtube-agent-skill (MIT). En la fábrica no hay nadie
a quien preguntar: **no preguntes nada**, y el resultado sigue el JSON de `skill/FABRICA.md`.
La voz del canal es `biblia.voz` (no busques `voice.md`). Las reglas de `skill/roles/guionista.md`
(cuenta corrida, cierre honesto, exactitud) mandan sobre esta skill si chocan.

## Herramienta (úsala, no adivines el puntaje)

```bash
python3 skill/youtube/yt-guion/ganchos.py ganchos.txt     # uno por línea, ordenados
python3 skill/youtube/yt-guion/ganchos.py --gancho "una frase"
```

Es una **alerta**, no un juez: un puntaje bajo es motivo para reescribir; uno alto no promete nada.

## Los primeros 15 segundos son todo el trabajo

Hacen tres cosas o el video se escapa: confirman lo que prometió el título, abren una pregunta que el
espectador no puede cerrar solo y prueban que la respuesta existe.

1. **Gancho.** Escribe CINCO candidatos con fórmulas distintas de [`ganchos.json`](ganchos.json),
   pásalos por `ganchos.py` y entrega en `ganchos` los **tres mejores** (el elegido primero si
   puede). En `motivo_gancho` nombra la fórmula del elegido, su puntaje y por qué encaja con el tema.
   Si el mejor sale DÉBIL (< 55), arregla su propiedad más débil y vuelve a puntuar una vez.
2. **El giro (0:15–0:45 en largos; 3–8 s en Shorts).** Di en una frase qué va a hacer el video y empieza a hacerlo.
   Nada de presentación del canal ni «antes de empezar» ni pedir suscripción: son la causa más común
   de la caída a los 30 segundos.
3. **El cuerpo.** Una idea por tramo. Piensa cada tramo con lo que se VE (el storyboard lo convierte
   en planos y `texto_pantalla`); una voz sin nada que mirar es un podcast.
4. **La recompensa.** Entrega lo que prometió el gancho, explícito («esto es lo que queda: …»).
5. **El cierre.** Un solo pedido, nunca tres (y honesto: ver `guionista.md`).

## Reglas de las fórmulas

- Cada fórmula tiene su `falla`: léela antes de usarla. «El dato» sin fuente, «La fecha» sin fecha
  real o «La advertencia» con un costo chico destruyen la confianza del canal.
- No repitas la fórmula del gancho de los `temas_recientes` del canal.
- Nunca inventes un número para que el gancho suene mejor.
