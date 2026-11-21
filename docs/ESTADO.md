# ESTADO — misión cooper-marcas

Actualización: 2026-11-21. Estado de esta rama; conciliar con el estado general que Claude mantiene al integrar otras misiones.

- Base: `version-chatgpt`, `16341ab`. Rama/worktree: `cooper-marcas`, `/home/david/Proyectos/cooper-marcas`.
- Construido: módulo Marcas con dueño privado/Walter, guía de marca, cuentas, estudio, calendario, diseños, especialistas, corpus bíblico cotejado, revisión web/WhatsApp y publicación con métricas.
- Meta usa Graph oficial y usuario de sistema; YouTube/TikTok usan Upload-Post. Adaptadores probados con transportes simulados. No se ha verificado ni activado ninguna cuenta real.
- Lote n8n: `CooperMarcasPub1` y `CooperMarcasMet1`, inactivos y bloqueados por configuración. Sin despliegue.
- Puerta final en `fab1ab8`: instalación, lint, tipos, 248 unitarias, 35 E2E (Sentinel), build y 131 pruebas de flujos; rc 0, cero errores/advertencias. Lighthouse: rendimiento 95–100, accesibilidad/buenas prácticas 100.
- Entrega: [informe y evidencia de la puerta](informes/cooper-marcas.md); [uso y configuración](cooper-marcas.md).
- Integración pendiente: revisión de Claude, conciliar migración local `0008_marcas` y archivos compartidos con las otras misiones. Publicados/Aprendizaje de marcas se encuentran dentro de Marcas. No se hizo merge ni push.

## Pendientes de Walter

Asignar activos/permisos de Meta, confirmar cuentas Business y perfiles Upload-Post, aprobar la nueva plantilla WhatsApp y el consentimiento para esos avisos, cotejar corpus bíblico y guía pastoral, aportar identidad/logos/horarios y elegir el primer ensayo real. Preparar HTTPS y compositor FFmpeg/FFprobe mediante el lote de integración; no se activó infraestructura en esta misión.
