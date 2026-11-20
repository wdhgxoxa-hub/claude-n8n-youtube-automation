# Avatares, voces e identidad — fase 3

Implementación en `src/servicios/proveedores/`: interfaces `ProveedorAvatar`, `ProveedorVoz`, `ProveedorTranscripcion`; adaptadores HeyGen v3, Gemini Interactions, ElevenLabs IVC y simulados. `Transporte` es `typeof fetch` inyectable. Ninguna prueba usa llamadas pagas; Vitest bloquea la red por defecto y E2E fija todos los selectores a `simulada` en una base separada.

## Configuración

En servidor: `COOPER_AVATAR=heygen`, `COOPER_VOZ_CLONADA=heygen`, `COOPER_VOZ_CATALOGO=gemini`, `COOPER_TRANSCRIPCION=gemini`. Cada selector admite `simulada`; voz clonada admite también `elevenlabs`. No hay fallback silencioso ni activación por presencia de una clave. Claves: `HEYGEN_API_KEY`, `GEMINI_API_KEY`, opcional `ELEVENLABS_API_KEY`; solo nombres en `.env.example`. Valores desconocidos o claves ausentes dan error recuperable, sin detalles del proveedor al usuario.

`COOPER_GEMINI_TTS_MODEL` usa por defecto `gemini-3.8-flash-tts`, igual que `Ajustes.modeloVoz` en el generador actual. `COOPER_GEMINI_TRANSCRIPCION_MODEL` usa `gemini-4-hydrogen`. El modelo se configura explícitamente, sin leer Python ni credenciales de la fábrica desde Cooper. No hay dependencia SDK nueva.

## Identidad y ciclo de vida

1. `POST /api/identidad` crea una frase aleatoria de seis palabras, ligada a dueño y tipo, válida 15 minutos y de un solo uso. El usuario sube 1–3 fotos para avatar y graba la frase. Primera foto: avatar de foto; restantes: evidencia auxiliar para revisión. Voz clonada exige audio; avatar permite audio o video corto. El grabador existente captura audio hasta 60 segundos; también acepta grabación externa.
2. `POST /api/activos` valida propiedad, MIME y consentimiento literal `true`. Guarda evidencia, texto/versionado/fecha del consentimiento, reto consumido y estado en la misma transacción. En real queda en `revision`, sin enviar datos ni entrenar todavía. La migración no convierte antiguas creaciones simuladas en reales ni les inventa consentimiento.
3. Walter abre Administración y compara cuenta, fotos y grabación con la persona conocida, incluida la frase exacta. Si solo hay voz y no la reconoce, requiere comprobación presencial antes de aprobar. La ruta de evidencia exige administrador y una revisión pendiente; no permite abrir otros adjuntos. Aprobar registra revisor/fecha e inicia el adaptador guardado; rechazar impide entrenamiento. La interfaz no afirma verificación biométrica ni detección automática de vida.
4. `iniciando → entrenando → listo` o `error`. ElevenLabs puede exigir `verificacion_proveedor`; no se elude. SSE consulta el estado remoto cada 10 s como mínimo por activo mientras el dueño mantiene abierta la aplicación; reserva en SQLite evita duplicados entre pestañas/procesos. Un fallo temporal deja el estado y señala falta de actualización; se vuelve a consultar. No hay porcentaje inventado: se muestran estado, barra indeterminada y resultado. No hay trabajador de fondo si nadie está conectado.
5. HeyGen recibe la misma `Idempotency-Key` al recuperar un envío incierto dentro de 23 h tras revisión; sin ID remoto ni nueva creación. No se reenvía después de ese plazo. ElevenLabs no ofrece esa garantía en IVC: una respuesta perdida exige conciliación manual de Walter. Nunca se cambia de proveedor automáticamente ni se repite una creación como parte del sondeo.

Las revisiones humanas permiten verificar material sin inventar un endpoint biométrico. La transcripción real del chat sí pasa los bytes a Gemini y devuelve texto editable; no ejecuta órdenes hasta que el usuario lo envía. `audio/mp4` del navegador se declara como `audio/m4a` ante Gemini. Silencio, respuesta incompleta, error HTTP y timeout no producen texto fijo.

## Biblioteca y privacidad

Privada incluso frente al administrador en la biblioteca ordinaria; compartida solo por decisión del dueño una vez lista. Compartir permite selección, foto principal y vista previa; nunca reto, grabaciones, fotos auxiliares ni identificadores remotos. Volver a privado bloquea también muestras previamente generadas: cada lectura vuelve a autorizar y usa `private, no-store`. El borrado pide eliminación remota antes de borrar la fila y retira acceso compartido primero; ante fallo conserva la referencia para reintentar. Un envío incierto sin ID requiere conciliación antes de borrar.

«Cargar presentadores del estudio» solicita exclusivamente `ownership=public`, hasta cuatro páginas de 50; solo incorpora looks completados con video de muestra. La interfaz recibe identificadores opacos de presentador y nombres locales de voz (`voz-charon`, por ejemplo); los IDs remotos se resuelven exclusivamente en servidor. El catálogo queda en SQLite y se refresca como máximo cada 15 minutos por proceso. Luz y Cooper mantienen sus ilustraciones animadas locales, etiquetadas; aún no son recursos HeyGen de producción. Las 30 voces predefinidas de Gemini tienen muestra hablada real bajo demanda. Las vistas previas propias se guardan en SQLite; las de catálogo se cachean en memoria (hasta 40). Reproducir una voz por primera vez genera una muestra y consume uso del proveedor.

Las URLs remotas no llegan al cliente. Proxy de medios con HTTPS, hosts CDN exactos, sin redirecciones ni cookies de proveedor, límite 20 MB y MIME de audio/video. Lista inicial: `files.heygen.ai`, `files2.heygen.ai`, `resource.heygen.ai`, `cdn.heygen.ai`. Un CDN diferente devuelve error hasta que sea validado; nunca aceptar hosts enviados por el navegador. Fotos/grabaciones se envían inline base64; no se crea un enlace público de los originales en Cooper.

Los originales y el consentimiento permanecen en SQLite después de borrar el activo, por el sistema existente de adjuntos. No hay purga de huérfanos, cifrado de base ni política de retención automática; Walter debe fijar retención, copias y eliminación en proveedor antes de operación con personas reales. Privado en Cooper no garantiza que un administrador de la cuenta del proveedor no pueda ver sus recursos.

## Documentación oficial consultada el 20-11-2026

- [HeyGen: avatar de foto](https://developers.heygen.com/docs/avatar-from-photo): `POST /v3/avatars`, `type: photo`, `file` base64; respuesta `data.avatar_item.id`.
- [HeyGen: look y entrenamiento](https://developers.heygen.com/reference/get-avatar-look): `GET /v3/avatars/looks/{id}`, `processing/completed/failed`.
- [HeyGen: catálogo](https://developers.heygen.com/reference/list-avatar-looks): propiedad pública, paginación, `preview_video_url`.
- [HeyGen: clonación](https://developers.heygen.com/reference/create-or-retrain-an-audio-voice) y [esquema oficial del CLI](https://github.com/heygen-com/heygen-cli/blob/main/gen/model.go): `POST /v3/models/audio/voices`, `mode: instant`, **array** de un audio base64 con `media_type`, `similarity: max`. La página no mostraba la pestaña del esquema instantáneo; se contrastó el esquema generado por HeyGen.
- [HeyGen: estado de voz](https://developers.heygen.com/reference/get-an-audio-voice), [síntesis](https://developers.heygen.com/reference/generate-model-speech), [borrar voz](https://developers.heygen.com/reference/delete-an-audio-voice), [borrar look](https://developers.heygen.com/reference/delete-avatar-look).
- [Gemini TTS](https://aistudio.google.com/docs/speech-generation), [audio/transcripción](https://aistudio.google.com/docs/audio), [Interactions REST](https://aistudio.google.com/api-reference/interactions-api): `POST /v1beta/interactions`, `store: false`; respuesta REST en `steps[].content[]`, no los accesores de SDK `output_audio`/`output_text`.
- [ElevenLabs IVC](https://elevenlabs.io/docs/api-reference/voices/ivc/create), [estado/verificación](https://elevenlabs.io/docs/api-reference/voices/get), [síntesis](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), [borrado](https://elevenlabs.io/docs/api-reference/voices/delete).

HeyGen queda como primera opción por reutilización. No se ha medido fidelidad de voz: no sería honesto declarar que clona mejor o peor. ElevenLabs queda detrás de la misma interfaz como alternativa explícita para la comparación de Walter, sin cambio automático y respetando `requires_verification`.

## Prueba manual para Walter (no ejecutada)

Usar una instancia de ensayo aislada, con base nueva y un adulto voluntario que sea titular de la cuenta. Configurar los cuatro selectores reales y credenciales en el servidor. Este ensayo consume API; decidirlo antes de ejecutarlo. No usar D&S Factory ni n8n en vivo.

1. Cargar catálogo: abrir un presentador realista en movimiento; abrir Luz y Cooper; escuchar dos voces Gemini y comprobar diferencias. Recargar sin repetir generación de muestras propias.
2. Crear avatar con fotos propias, grabar la frase exacta y aceptar consentimiento. Recargar: sigue en revisión y privado. Con otra cuenta y con admin, la biblioteca no debe mostrarlo; intentar descargar el ID de evidencia desde la ruta ordinaria debe dar 404.
3. Como Walter, abrir Administración: comprobar el consentimiento fechado, la frase y la identidad. Rechazar una muestra dudosa y constatar que no crea recurso remoto. Aprobar una correcta y comprobar que aparecen entrenamiento y luego listo. Cerrar/reabrir durante entrenamiento para comprobar persistencia y reanudación.
4. Crear voz con 30–60 s de audio limpio: frase aleatoria al comienzo y lectura natural adicional. Aprobar y escuchar el resultado. Compartir con la otra cuenta, usar muestra y selección; retirar compartir y comprobar 404/ausencia también al recargar.
5. Comparar voluntariamente una segunda creación con `COOPER_VOZ_CLONADA=elevenlabs`: misma lectura, pronunciación de nombres/números, acento y similitud. Si exige verificación adicional, completarla con el proveedor; nunca marcar lista manualmente en SQLite. Registrar evaluación sin adjuntar grabaciones personales al repo.
6. Grabar en chat dos frases diferentes. Verificar que no reaparece la frase fija y que se puede editar antes de enviar; probar silencio, micrófono denegado y fallo de red.
7. Con un puente **de ensayo** que implemente [el contrato](../docs/cooper-especificacion.md), solicitar video con avatar y voz propios; probar presencia completa y por partes. Capturar solo nombres de campos/IDs ficticios para revisar el sobre. La integración actual rechaza con 422 cualquier avatar o voz seleccionados: el montaje aún no consume `presentacion`. Este paso solo puede completarse después de implementar y revisar ese consumo; configurar claves no elimina este límite.
8. Simular desconexión tras envío HeyGen y recuperar con el mismo ID; revisar que solo existe un recurso remoto. Borrar el activo y confirmar su eliminación en proveedor. Decidir política de purga de originales y verificarla aparte.

Con `COOPER_DEMO=1`, todos los selectores de medios se fuerzan a simulación, incluidas consultas y muestras. La identidad pendiente de las capturas finales es una fixture ficticia del ejecutor E2E, no una persona real.
