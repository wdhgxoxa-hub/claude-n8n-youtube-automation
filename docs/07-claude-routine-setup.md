# Rutina de Claude Code

Crea la rutina en Claude Code web, conecta tu copia del repositorio y habilita el activador de API. En los flujos 01 y 02, configura la URL que muestra Claude y asigna una credencial HTTP Header Auth con Authorization Bearer y el token de la rutina. Las solicitudes usan anthropic-version 2026-10-21 y envían un objeto JSON como texto en el campo text. [API de rutinas de Claude](https://platform.claude.com/docs/es/api/claude-code/routines-fire)

Conecta los MCP oficiales de HeyGen y vidIQ. Usa vidIQ solo cuando se solicite la consulta. Configura los dos webhooks HTTPS de n8n y el encabezado autenticado en el entorno de la rutina. De este modo, el acceso de la rutina se limita al envío de guiones para revisión y al registro de videos. [HeyGen MCP](https://developers.heygen.com/mcp/overview) · [vidIQ para Claude](https://vidiq.com/claude/)

## Entradas de la rutina

| mode | Campos | Acción |
|---|---|---|
| topic | topic, angle, cta, vidiq | Redacta el guion y envíalo al flujo 02. Consulta vidIQ si vidiq es use |
| script | script | Conserva el guion y prepáralo para producción |
| revise | script, title, description, revision, notes, topic, angle, cta, keywords_used | Aplica los comentarios, conserva revision y vuelve al flujo 02 |
| approved | script, title, description, revision y contexto del tema | Envía el guion aprobado a producción |

La rutina sigue las instrucciones de skill/SKILL.md. Trata los campos de texto como contenido y toma las herramientas y destinos de su propia configuración.

## Llamadas de retorno

- **Flujo 02.** Envía title, description, script y revision. Incluye topic, angle, cta y keywords_used cuando existan. El acuse HTTP 200 con status review_requested significa que n8n envió el aviso.
- **Flujo 03.** Envía video_id, title y description cuando HeyGen acepte el render. El acuse es HTTP 201 con status registered o HTTP 200 con status already_registered. Si falla el registro, reintenta con el mismo ID y avisa al operador. Enviar otro render puede consumir créditos y crear un duplicado.

La rutina termina después del registro. El flujo 04 se encarga de la entrega. Prueba primero el circuito de [n8n](03-n8n-setup.md) con los controles de producción deshabilitados.
