# Misiones de Cooper

- Leer antes de trabajar `docs/cooper-especificacion.md`, `cooper/ENTREGA.md`, `cooper/README.md`, `docs/ESTADO.md` y las guías disponibles en `docs/diseno/`.
- Usar rama y worktree propios. Preservar el trabajo de otras misiones y hacer commits atómicos en español. La integración y el push requieren las condiciones expresas de la misión.
- No leer, imprimir ni copiar valores de credenciales o archivos `.env` reales. Consultar solo nombres de variables y `.env.example`. No desplegar en n8n vivo, tocar D&S Factory, iniciar OAuth ni hacer pagos salvo autorización expresa de la misión correspondiente.
- Consultar la documentación oficial actual antes de usar APIs. Reutilizar los adaptadores y controles de acceso existentes.
- Ejecutar la puerta completa desde `cooper/`: `npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`; desde la raíz: `node --test tests/flujos_v2.test.cjs`. Corregir fallos y repetir hasta obtener cero errores y cero advertencias.
- **Al terminar cada misión, actualizar `docs/ESTADO.md`** respetando sus secciones: Hecho, En curso, Pendiente de Walter e Ideas conversadas. Fechar la actualización en Lima; distinguir implementado, probado, integrado y desplegado. No eliminar pendientes ajenos ni convertir ideas en trabajo aprobado.
- Escribir `docs/informes/<mision>.md` con commits, cambios, evidencia de la puerta, limitaciones reales y «Pendientes de Walter». Las decisiones pendientes se documentan allí sin detener el trabajo independiente.
