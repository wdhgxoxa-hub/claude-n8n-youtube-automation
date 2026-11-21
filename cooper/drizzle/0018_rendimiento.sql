-- Últimos mensajes sin ordenar todo el historial de cada dueño.
CREATE INDEX messages_owner_created ON messages(owner_id, created_at);
--> statement-breakpoint
DROP INDEX messages_owner_idx;
--> statement-breakpoint
-- SSE y Operación: tipo, permiso y orden se resuelven en el índice.
CREATE INDEX events_type_owner_created ON events(type, owner_id, created_at, id);
--> statement-breakpoint
CREATE INDEX events_type_created ON events(type, created_at, id);
--> statement-breakpoint
-- Solo se agregan gastos de los periodos visibles; índice de cobertura.
CREATE INDEX expenses_created_owner_amount ON expenses(created_at, owner_id, amount);
--> statement-breakpoint
CREATE INDEX cuentas_marca_marca ON cuentas_marca(marca_id);
--> statement-breakpoint
CREATE INDEX piezas_marca_programada ON piezas_marca(marca_id, programada);
