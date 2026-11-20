# Cooper — especificación de la web y del chat de la fábrica (20-11-2026)

Fuente única para las misiones del capataz. Codex redacta el plan detallado de cada fase a partir de este archivo.

## Qué es
Web del equipo para pedir, seguir y aprobar videos de la fábrica (n8n, `workflows/v2/`), con un chat que conversa y la maneja. Muestra cómo trabaja la fábrica; nunca costos, claves, proveedores ni flujos internos a usuarios normales. Solo español. Celular y computadora por igual.

- Inicio: escritorio = chat a la izquierda + fábrica en vivo a la derecha; celular = chat con pestaña «Fábrica». Cada usuario elige qué abre primero.
- Fábrica en vivo: cada video avanza por etapas (Radar, Guion, Verificación, Aprobación de guion, Storyboard, Imágenes y clips, Voz y música, Montaje, Control de calidad, Aprobación final, Programado, Publicado) con animaciones sobrias.
- Estilo: producto serio hecho por ingenieros senior, nada que parezca hecho por IA ni colores llamativos. Fondo casi negro, superficies grafito, texto marfil; acento celeste (ojo de Cooper) para lo activo y tostado/fuego (pelaje) para lo terminado; un acento por pantalla; tema claro equivalente; accesible AA.
- Logo: una «C» con una patita de perro. La web no usa al perro; el chat sí.

## Usuarios
- Hasta 10 cuentas (en la práctica 3–4 del equipo). Walter paga todo y es el único administrador.
- Entrada con Google, solo correos de una lista permitida que controla el administrador.
- Usuario: crea canales o conecta los suyos; pide, aprueba y publica videos; borra sus videos y canales; personaliza su espacio (foto, nombre, tema, pantalla de inicio, WhatsApp). No ve nada de otros usuarios ni costos.
- Administrador: todo, ve lo de todos, gasto por usuario (día/semana/mes) y alerta de gasto diario alto (sin bloquear). Sin topes por usuario.

## Chat Cooper
- Como un chat moderno: texto, audio grabado (con transcripción) y adjuntos de fotos y archivos; responde por escrito.
- Cara de Cooper ilustrada (American Bully negro con fuego, un ojo celeste y el otro verde con marrón), animada con sutileza: parpadeo, boca al responder, leve giro al escuchar.
- Entiende y ejecuta: herramientas 1:1 con los eventos del Orquestador (nuevo_canal, nuevo_video, corregir, ajustar_biblia, programar, referencias, configurar_redes, metas, adoptar_cuenta) y consultas (estado, reporte, pendientes, tendencias), siempre limitadas al usuario autenticado. Elige solo al especialista; sin comandos «/».

## Avatares y voces
- Galería general variada (realistas e ilustrados, Cooper como presentador) para todos, con vista previa en movimiento.
- Avatar propio con fotos de la persona y verificación de identidad (video corto o su voz diciendo una frase). Privado del dueño salvo que lo comparta con el equipo.
- Voces: clonada de quien la grabó o de catálogo; misma regla de privacidad.
- El avatar va en todo el video o solo en partes, según la ocasión.

## Avisos e infraestructura
- Avisos de aprobación en la web y por WhatsApp: Cooper tiene su número (WhatsApp Business oficial de Meta); cada usuario registra su WhatsApp normal y recibe solo lo suyo, con enlace para revisar y aprobar.
- Fábrica y web pasan de la PC (ngrok) a un VPS con dominio, HTTPS y copias de seguridad.
- Modelos: Claude con el plan de Walter (guiones, storyboards, especialistas). Tareas de texto de GPT (crítico, verificador, radar) por Codex con el plan de ChatGPT, con la API como respaldo automático. Imágenes, clips y voz siguen por API.

## Modo noticia
El radar detecta la noticia del día del nicho; el verificador confirma datos con fuentes; el guion la cuenta con imágenes didácticas propias (mapas, cifras, esquemas); sale en horas. Nunca imágenes de medios; sin datos verificados no se publica.

## Fases (una misión cada una)
1. Web y chat Cooper en `cooper/` (Next.js + TypeScript estricto + Tailwind + Framer Motion + Auth.js Google + SQLite/Drizzle), con adaptador de fábrica simulado y otro de n8n por variable; pruebas unitarias y e2e (Playwright).
2. Puente real con n8n: flujo «FX · API de Cooper» en `tools/generar_flujos_v2.py`, dueño por canal (`dueno_email`), gasto por usuario; pruebas en `tests/flujos_v2.test.cjs`.
3. Avatares y voces reales tras interfaces `ProveedorAvatar` y `ProveedorVoz`, con verificación de identidad.
4. WhatsApp Business: plantillas, avisos por usuario, número de Cooper.
5. VPS: despliegue de n8n y Cooper (contenedores, proxy con HTTPS, copias de seguridad, guía de migración de datos).
6. Modo noticia en la fábrica y tareas de texto de GPT vía Codex con respaldo por API.

Reglas para todas: no tocar fuera de su alcance; las pruebas existentes (`node --test tests/flujos_v2.test.cjs`) siguen pasando; sin secretos en el código (`.env.example`); commits en español.

## Contrato aditivo de presentación — fase 3

`nuevo_video` mantiene `datos.avatarId`, `datos.voiceId` y `datos.avatarPlacement` de la fase 1. Cooper valida dueño, permiso compartido, revisión y entrenamiento antes de enviar. Los IDs remotos se resuelven en el servidor; nunca se aceptan desde el navegador.

Añade `datos.presentacion` opcional, versión 1:

```json
{
  "version": 1,
  "presencia": "partes",
  "avatar": { "recurso_id": "uuid-local", "proveedor": "heygen", "id": "look-del-proveedor", "tipo": "propio" },
  "voz": { "recurso_id": "voz-charon", "proveedor": "gemini", "id": "Charon", "tipo": "catalogo" }
}
```

- `avatar` y `voz` admiten `null`: sin presentador / voz según guion. `presencia` admite `completo` o `partes`; en `partes` el storyboard determina las escenas. No se inventan tiempos antes de tener storyboard.
- `tipo` admite `propio` y `catalogo`. Proveedores de avatar: `heygen`, `simulada`; de voz: `heygen`, `gemini`, `elevenlabs`, `simulada`.
- Sin `presentacion`, el puente conserva su comportamiento anterior. Si está presente, debe persistirla junto al video y transmitirla a storyboard, planos y sonido. `completo` exige presentador en todas las escenas narradas; `partes` solo en las elegidas por el storyboard. Voz elegida: todas las escenas narradas.
- Una selección con `proveedor: simulada` es demostrativa y no debe enviarse a un generador real. Las ilustraciones locales Luz y Cooper se conservan como vista previa; requieren un recurso de producción aprobado para render real.
- Las voces Gemini se sintetizan con `Ajustes.modeloVoz`. Las voces clonadas HeyGen/ElevenLabs requieren su adaptador de síntesis; no se deben reinterpretar sus IDs como nombres Gemini. Para HeyGen avatar usar el ID de **look**, no el de grupo.
- La presentación contiene referencias técnicas, nunca evidencia, fotos, grabaciones, URLs privadas ni consentimiento. Solo circula por el puente autenticado; no forma parte del estado público del navegador.
- La retirada de compartir bloquea nuevas selecciones y vistas previas en Cooper. No cancela encargos ya aceptados. La acción explícita de revocar consentimiento cancela la producción en cola y se revalida con callback firmado antes del siguiente paso. Las llamadas ya enviadas necesitan conciliación.

Estado implementado: la fábrica persiste y consume `presentacion`, sintetiza la voz elegida, renderiza HeyGen por look y monta con Creatomate. FX mantiene 422 para recursos simulados o selecciones sin referencias resueltas. Los pedidos sin selección conservan la ruta anterior. Validado localmente con transportes ficticios; no desplegado ni probado con medios pagos. Contratos, frenos, revocación y límites: [guía del puente](cooper-puente-n8n.md#presentación-real-implementada-ensayo-local-sin-gasto).
