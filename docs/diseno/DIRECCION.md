# Cooper — Dirección de diseño «Sala de proyección» (v1, autor: Claude/Fable, director)

Regla madre: el contenido da la luz y el color; la interfaz se aparta. Calma en la base, emoción en los momentos. Todo responde al tacto. Nunca saltas de página: te mueves dentro de un espacio. Original: no copiar composiciones de Apple, Linear, Stripe ni Frame.io; solo su nivel de rigor.
Esta especificación es OBLIGATORIA y exacta. Cualquier desviación se justifica por escrito en el informe. Prohibido: valores mágicos fuera de tokens, texto <12px, ilustraciones genéricas repetidas, miniaturas de relleno en videos reales, formularios antes que contenido, copys técnicos.

## 1. Tokens (CSS variables, única fuente de verdad; borrar los antiguos)
Color base (tema oscuro, único tema de esta versión; el claro se retira):
- --lienzo #000000 · --sup-1 #0A0A0C · --sup-2 #111114 · --sup-3 #18181C · --linea rgba(255,255,255,.08) · --linea-fuerte rgba(255,255,255,.14)
- --texto #F5F5F7 · --texto-2 #A1A1AA · --texto-3 #71717A (solo ≥13px; contraste AA verificado)
- Acento único «Tally» (luz de grabación): --tally #FF4D2E · --tally-suave rgba(255,77,46,.14) · texto sobre tally #0A0A0C. Se usa para la acción primaria, lo que está «en vivo» y el foco. Nada más.
- Semánticos: --sube #3DDC97 · --baja #FF6B6B · --aviso #FFC53D · --info #7CC4FF.
- Tinte dinámico: cada pantalla con medio protagonista define --tinte (color dominante de la miniatura, extraído en servidor y guardado; saturación limitada, L 45–60%). Uso: halo ambiental radial detrás del medio (opacidad ≤.22, blur 120px) y borde 1px al 20%. Cada marca define su --tinte-marca. Transición de tinte 640ms.
Tipografía (autoalojada, licencia libre, font-display swap, preload de las 2 críticas):
- Display: «Clash Display» 500/600 (Fontshare). Texto: «Geist» 400/500/600. Cifras y datos: «Geist Mono» con tabular-nums.
- Escala (px): 12 · 13 · 15 (cuerpo) · 17 · 20 · 28 · 40 · 56 · 72. Display usa 28–72 con clamp(); interlineado display 1.02–1.1, tracking −0.02em; cuerpo 1.5. Mínimo absoluto 12px. Títulos de pantalla: 56 escritorio / 40 móvil. Cifras héroe: 72 / 48.
Espaciado base 4: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96. Radios: 8 (controles) · 14 (tarjetas y medios) · 22 (paneles y hojas) · 999 (botones y chips: SIEMPRE píldora). Ningún otro radio.
Retícula: escritorio 12 col, contenedor máx 1440, gutter 24, margen 32 (≥1024) ; tablet 8 col margen 24; móvil 4 col, gutter 16, margen 16. Alturas de fila y medios alineados a múltiplos de 8.
Profundidad: 3 niveles. Vidrio (solo capas flotantes: barra, hojas, Cooper, menús): fondo rgba(17,17,20,.72), backdrop-filter blur(24px) saturate(160%), borde --linea, brillo interior superior 1px rgba(255,255,255,.06), sombra 0 24px 64px rgba(0,0,0,.6). Tarjetas: sin sombra, elevan con translateY(-2px)+borde fuerte al hover.

## 2. Partitura de movimiento (Motion para React o WAAPI; una sola librería)
Duraciones: 120 (presión) · 240 (hover/estado) · 420 (entrada) · 640 (ruta / elemento compartido). Curvas: salida cubic-bezier(.16,1,.3,1); entrada-salida cubic-bezier(.65,0,.35,1); hojas con muelle (stiffness 380, damping 34).
- Rutas: View Transitions API. Elemento compartido: la miniatura de un video se convierte en el reproductor del detalle (view-transition-name por id). El resto hace fundido + desplazamiento 12px, 420ms. Fallback sin API: fundido 240ms.
- Entradas: escalonado 40ms, máx 8 elementos, opacidad 0→1 + y 12→0, 420ms, una sola vez por visita de pantalla.
- Tacto: todo interactivo responde: hover 240ms (elevación/borde/brillo), presión scale .98 120ms, foco visible anillo 2px tally offset 2.
- Medios: hover (o en vista en móvil) reproduce vista previa silenciosa tras 180ms con fundido 240ms; al salir vuelve al póster.
- Cifras: contador que sube 640–900ms con easing de salida al entrar en vista y cuando cambia el dato; minigráficas se dibujan (stroke-dashoffset) 640ms.
- Momentos: video terminado / aprobado / récord → destello de tinte + insignia con muelle, una vez, ≤900ms.
- prefers-reduced-motion: sin desplazamientos ni autoplay; fundidos ≤120ms; todo funcional. El control «Pausar movimiento» se muda a Perfil.
Solo transform/opacity. Presupuesto: 60fps en móvil medio (medir con traza), sin CLS.

## 3. Armazón
- Escritorio: riel izquierdo de vidrio 72px (iconos + etiqueta 12px), se expande a 232px al hover/foco. 5 destinos: Inicio · Fábrica · Publicados · Aprendizaje · Marcas; debajo «Más» (Canales, Avatares y voces, Operación, Administración, Perfil). Cabecera: solo título de contexto y avatar; sin insignias técnicas.
- Móvil: barra inferior de vidrio fija con 5 pestañas (mismos destinos; «Más» abre hoja), safe-area, objetivo táctil ≥48px, indicador activo animado (layout animation). Nada de menú lateral oculto.
- Estado de conexión: invisible cuando todo va bien. Solo si hay corte real >5s: píldora discreta «Sin conexión, reintentando». Corregir de raíz el «Reconectando/Conectando» permanente (SSE/proxy). «Modo de prueba» no se muestra en producción salvo a admin dentro de Administración.
- Cooper: orbe flotante 56px abajo-derecha (móvil: sobre la barra). Usa la cara 3D del perro de Walter si el recurso está disponible con calidad (ver misión base); si no, logotipo vivo (anillo que respira 4s). Punto tally si tiene algo que decir. Al tocar: el orbe se transforma (elemento compartido) en panel de vidrio: escritorio hoja derecha 420px que NO tapa el contenido (el contenido se reajusta); móvil hoja inferior a 62% arrastrable a completa y a cerrar. Conoce el contexto de la pantalla (video/marca abiertos) y ofrece 2–3 acciones sugeridas como chips. El chat deja de ocupar el Inicio.
- Copys: español humano, frases cortas, sin jerga («registros de origen», «identidad de publicación» → prohibidos).

## 4. Pantallas con identidad propia
- Inicio «Hoy en el estudio»: (1) héroe a todo el ancho con el último video terminado/publicado: medio 16:9 o 9:16 centrado sobre halo de tinte, título display 56, canal, 3 cifras vivas; carrusel de los 5 últimos con arrastre e inercia. (2) «Te toca a ti»: pendientes de aprobar como tarjetas con acción primaria tally. (3) «En producción»: cada video como pista con sus 12 etapas y pulso en la etapa viva. (4) «Cómo vamos»: 4 cifras héroe (vistas 7d, seguidores, retención media, videos del mes) con minigráfica y variación.
- Fábrica «Línea de producción»: pista horizontal de 12 estaciones; cada video es una cápsula que avanza; feed lateral de eventos en vivo con hora relativa; al tocar una cápsula → detalle (elemento compartido).
- Video (detalle): reproductor protagonista con halo de tinte, título display, pista de etapas, acciones (aprobar/corregir/programar), pestañas Guion · Métricas · Lecciones.
- Publicados «La pared»: cuadrícula densa de medios reales (9:16 y 16:9 mezclados en retícula justificada), cifras superpuestas en vidrio (vistas, likes), insignia de red; orden por defecto «mejor rendimiento»; filtros en una fila de chips píldora plegada, nunca formulario arriba. Hover = vista previa.
- Aprendizaje «Lo que aprendimos»: línea de tiempo vertical; cada lección: video origen (miniatura) → métrica que falló (cifra) → causa → corrección aplicada → efecto en el siguiente video. Interruptor de medición automática arriba como control claro. Vacío con ejemplo explicativo.
- Marcas: tarjetas grandes teñidas con --tinte-marca, avatar, redes, próxima publicación; vacío con invitación única.
- Resto (Canales, Avatares y voces, Operación, Administración, Perfil, Entrar, errores, vacíos, cargas con esqueletos): heredan sistema completo; cero restos del diseño anterior.

## 5. Puerta de calidad de diseño (además de la puerta común)
Playwright en 360, 390, 768, 1024, 1440 y 1920: capturas de TODAS las pantallas y estados en `evidencias-diseno/<pantalla>-<ancho>.png` (carpeta en la raíz del worktree) + videos de transiciones de ruta, hover de medios, contadores, Cooper abrir/cerrar, barra móvil. axe 0 serias. Lighthouse móvil ≥90 en rendimiento y 100 en accesibilidad en Inicio y Publicados. Consola 0 errores/avisos. Sin desbordamiento horizontal. Test automático que falla si existe font-size <12px, radio fuera de tokens o color fuera de tokens. Autocrítica obligatoria: tras capturar, revisa cada captura como director de arte (jerarquía, alineación óptica, ritmo, recortes) y corrige antes de entregar; lista en el informe lo que aún no está a nivel.
