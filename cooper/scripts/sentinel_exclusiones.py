"""Controles mutantes propios de Cooper que Sentinel no debe accionar.

Los filtros y la navegación permanecen disponibles. El guardián de red continúa
bloqueando cualquier escritura que escape de estas exclusiones de interfaz.
"""
TEXTOS = (
    'Cerrar sesión', 'Crear avatar', 'Crear voz',
    'Cargar presentadores del estudio', 'Confirmar solicitud',
    'Investigar competencia', 'Medición y aprendizaje automático',
)
SELECTORES = (
    'iframe', 'a[href^="/api/archivos/"]', 'a[href^="/api/revision-archivo/"]',
    'button[aria-label^="Modo noticia:"]', '.team-row button',
    '.allowed-list button', '.asset-actions button',
    # El input no tiene texto propio: el texto de su label no basta para excluir
    # formFiller. Acotar al control administrativo evita excluir otros switches.
    'section[aria-label="Control del aprendizaje"] input[role="switch"]',
)
