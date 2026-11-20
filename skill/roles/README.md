# Banco de roles de la fábrica

Cada modelo trabaja con **un rol** y lee solo su archivo. Una sola fuente de verdad:

| Rol | Archivo | Quién lo usa | En qué paso |
|---|---|---|---|
| Investigador de nichos | `investigador.md` | Claude | `investigar_nichos`, `crear_biblia` |
| Guionista | `guionista.md` | Claude | `guion`, `corregir_guion` |
| Director visual | `director-visual.md` | Claude | `storyboard` |
| Verificador de cifras | `verificador.md` | GPT con búsqueda web (n8n lo incrusta en «Verificar cifras») | cada versión del guion, antes del crítico |
| Crítico de guion | `critico.md` | GPT (n8n lo incrusta en el nodo «Crítico del guion») | antes de tu aprobación del guion |
| Revisor visual | `revisor-visual.md` | GPT con visión (n8n lo incrusta en «Revisar plano» y «Revisar archivo») | cada imagen y cada clip de archivo |
| Editor de publicación | `editor-publicacion.md` | Claude (dentro del storyboard) | títulos, descripciones y textos por red |
| Analista | `analista.md` | Claude | `aprender` |

Para cambiar cómo trabaja un rol: edita su archivo. Claude lo lee en cada encargo; los roles de GPT se aplican al regenerar los flujos (`python3 tools/generar_flujos_v2.py`) e importarlos.
