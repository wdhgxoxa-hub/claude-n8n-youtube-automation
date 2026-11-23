"""Controles mutantes propios de Cooper que Sentinel no debe accionar.

Los filtros y la navegación permanecen disponibles. El guardián de red continúa
bloqueando cualquier escritura que escape de estas exclusiones de interfaz.
"""
TEXTOS = (
    'Cerrar sesión', 'Crear avatar', 'Crear voz',
    'Cargar presentadores del estudio', 'Confirmar solicitud',
    'Investigar competencia', 'Medición y aprendizaje automático',
    # Sincroniza revisiones aprobadas mediante POST; el recorrido autorizado de
    # e2e/montajes.spec.ts sí lo acciona y comprueba el cambio de revisión.
    'Actualizar montajes desde fábrica',
    # Estos controles ya se excluían en Marcas; también deben protegerse cuando
    # el recorrido general llega a esa pantalla. Sus escenarios dirigidos usan
    # datos ficticios y comprueban el resultado autorizado.
    'Añadir cuenta', 'Verificar conexión', 'Desconectar', 'Estudiar la cuenta',
    'Proponer texto con el especialista', 'Pedir cambios',
    # Altas y atestaciones de iglesia son escrituras; iglesia.spec.ts ejerce
    # ambas con sesión autorizada y comprueba permisos, datos y revisión.
    'Preparar Iglesia (por confirmar)', 'Registrar revisión doctrinal',
)
SELECTORES = (
    'iframe', 'a[href^="/api/archivos/"]', 'a[href^="/api/revision-archivo/"]',
    'button[aria-label^="Modo noticia:"]', '.team-row button',
    '.allowed-list button', '.asset-actions button',
    # El input no tiene texto propio: el texto de su label no basta para excluir
    # formFiller. Acotar al control administrativo evita excluir otros switches.
    'section[aria-label="Control del aprendizaje"] input[role="switch"]',
    # Elegir un tema lo guarda al instante (PATCH /api/perfil). El guardián lo
    # bloquea y Chromium anota ERR_BLOCKED_BY_CLIENT; e2e/temas.spec.ts ejerce
    # el selector con sesión autorizada, también con cambios seguidos.
    '.apariencia-opcion', '.apariencia-opcion input[type="radio"]',
)
