# ESTADO — Fábrica de videos + Cooper

Última actualización: 2026-11-21 09:55 (Lima).

## Qué es

- Fábrica de videos en n8n (canal de pruebas: Margen Real) + Cooper (web y chat en `cooper/`) para Walter y su equipo de 3–4 personas. Marcas y cuentas propias, sin clientes externos.
- Claude dirige y revisa; Codex realiza misiones en ramas/worktrees propios, con informes en `docs/informes/`.

## Hecho

- Fases 1–6: web, chat por los planes de Claude/Codex, puente firmado con n8n, avatares/voces, WhatsApp, preparación VPS y modo noticia. Proveedores con gasto y modo noticia requieren su activación correspondiente.
- **Integración 3:** Pulido, Memoria, Cobertura, Marcas y Animación fusionados en orden; `version-chatgpt` y `main` publicados en el remoto propio `mio`, por excepción expresa de Walter. [Informe y evidencia](informes/cooper-integracion3.md).
- **Cooper actualizado en la PC:** <http://localhost:3000>, unidad `cooper.service` activa, respaldo previo protegido y SQLite migrado de ocho a once entradas. Arranque automático deshabilitado, conservando el estado establecido por la migración al VPS. Solo se reanudó la web local; n8n local no se reactivó. Administrador: wdhg.xoxa@gmail.com.
- Puerta integrada: 284 unitarias, 43 E2E, 147 pruebas de flujos, lint, tipos, instalación y build; cero errores/advertencias. Dos rondas conjuntas Sentinel + Playwright de 58/58, 176 muestras de pantallas y 188 videos, incluidos recorridos completos a 1440/390 px. Lighthouse: 88 mediciones, rendimiento 97–100 y accesibilidad/buenas prácticas 100, sin advertencias. [Índice local](../cooper/.cache/videos-integracion3/index.html).
- Pulido: medios reales, Publicados y Aprendizaje, chat breve. Memoria: recuerdos privados por usuario/canal, recuperación más allá de 30 mensajes, tarjeta de regreso, consulta administrativa y borrado. Cobertura: pantallas de operación e inventario integrado de 32 flujos/1.211 nodos, 121 decisiones/esperas, 58 ajustes y nueve Data Tables. Informes históricos: [memoria](informes/cooper-memoria.md), [cobertura](informes/cooper-cobertura.md).
- Animación: ilustraciones originales, fábrica animada, bienvenida, celebración y pausa/movimiento reducido. Corregidos el solapamiento de la galería y las etiquetas repetidas de canales; regresiones y accesibilidad verificadas. [Informe de movimiento](informes/cooper-animacion-fuerte.md).
- Marcas: espacio privado con cuentas, diseños, revisiones, calendario, Publicados y Aprendizaje propios; proveedores simulados y migración integrada `0010_marcas`. [Informe](informes/cooper-marcas.md). No hay publicación real activada.
- **VPS migrado por la misión concurrente `cooper-vps-real`** (`1883fb3`, conservado en la integración): servicios y datos instalados, HTTPS y copias comprobados. El servidor mantiene el código anterior; integración 3 no lo despliega. Su aceptación real sigue pendiente. [Informe del VPS](informes/cooper-vps-real.md).
- Google OAuth: cliente «Cooper web» del proyecto n8n-videos; revisar callbacks localhost y dominio definitivo al aceptar el VPS. No se hicieron logins durante integración 3.
- Meta: portafolio «Cooper Estudio», app «Cooper», usuario cooper-bot y número +51 939 484 675. Configuración de firmas, plantillas y pago pendientes según el cierre del VPS; no se realizaron pagos ni envíos en esta misión.
- Contabo Cloud VPS 4, pedido 15717272; dominio cooperestudio.com en Cloudflare. IP/SSH/DNS ya resueltos por la misión VPS, sin revalidación remota en integración 3.
- Regla permanente: actualizar este ESTADO al terminar cada misión, conservando hechos, trabajo en curso, pendientes e ideas.

## En curso

- Claude: revisar e instalar el lote n8n de integración 3 en el destino elegido, con respaldo real previo, mapa de IDs y reversa. Contiene 32 exportaciones inactivas; **no se aplicó en vivo**. [Procedimiento](cooper-cobertura-despliegue.md).
- Aceptación del VPS: sesión Google real, datos/SSE/adjuntos, Meta, entradas pausadas, repositorio de copias fuera del VPS y conexión del chat con los planes de la PC.
- La PC conserva la base del corte; no sincroniza escrituras posteriores del VPS. Elegir el destino de producción y conciliar los datos antes de cualquier reversa o actualización del servidor. [Instalación y reversa local](cooper-integracion3-despliegue.md).

## Pendientes de Walter

1. Resolver pago de Meta, configurar firma y plantillas WhatsApp con Claude; mantener mensajería pausada hasta aceptar la configuración.
2. Probar Google, SSE y adjuntos en el VPS y revisar Cooper local en Chrome. IP/SSH/DNS ya no son un pendiente de alta; no repetir el acceso root antiguo.
3. Revisar con Claude las dos esperas históricas y las diez entradas pausadas del VPS; elegir cuáles reabrir. El guion del Short `v-mwp2bjgj-7fvq` sigue como pendiente histórico, sin reanudación ni aprobación en esta misión.
4. Validar memoria con conversaciones ficticias usando el proveedor del plan: las pruebas locales no miden calidad semántica real. La síntesis añade una llamada por turno y hasta 12 segundos.
5. Fijar presupuestos, modelos, interruptores, perfiles de publicación y permisos OAuth; autorizar por separado un ensayo real de producción, medios y celebración. Operación puede mostrar indisponibilidad hasta instalar el nuevo puente.
6. Revisar los videos y probar un teléfono físico de gama media y Safari si se utiliza. La emulación local no sustituye esa aceptación.
7. Marcas: definir identidad/dueños, asignar activos y permisos, cotejar corpus bíblico y guía pastoral, aprobar plantilla WhatsApp y decidir retención/conciliación de medios y primer ensayo real.
8. Elegir repositorio de copias remoto, custodiar las claves offline y probar recuperación fuera del VPS. Si se requiere IA de los planes allí, completar el túnel restringido a los puentes de la PC y validar desde los contenedores.

## Ideas conversadas

- Gestión de redes de sus marcas (iglesia, futura tienda de ropa y equipo): primera implementación disponible en modo simulado. La activación real multirred, permisos, calendario editorial y especialistas por rubro siguen pendientes de las decisiones anteriores.
- Microserie con IA: aplazada.
