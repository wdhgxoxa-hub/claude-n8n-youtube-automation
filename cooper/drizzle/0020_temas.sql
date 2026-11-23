-- Temas de apariencia por persona: feria (alegre), sala (sobria) y dia (clara).
-- Los valores anteriores (oscuro, claro, sistema) nunca tuvieron selector: todos
-- veían el mismo tema. Pasan a «feria», el tema por defecto.
UPDATE users SET theme = 'feria' WHERE theme NOT IN ('feria', 'sala', 'dia');
