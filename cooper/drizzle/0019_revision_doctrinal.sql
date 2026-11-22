ALTER TABLE piezas_marca ADD COLUMN revision_doctrinal TEXT;
--> statement-breakpoint
UPDATE piezas_marca
SET datos = json_set(datos, '$.requiereRevisionDoctrinal', json('true'))
WHERE marca_id IN (SELECT id FROM marcas WHERE rubro = 'iglesia-reformada');
