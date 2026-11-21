# Total Margen Real — estrategia de crecimiento

**21-11-2026, Lima.** Rama/worktree `total-margen-estrategia`, base `version-chatgpt` **`de397f3195856c10b6a9959171ff42da4328d9ec`**. Investigación y datos preparados en el repositorio; no integrados, desplegados ni publicados. No se accedió al VPS, n8n vivo, D&S Factory ni cuentas privadas.

La oportunidad editorial es **explicar cuánto queda en un negocio peruano mediante una cuenta comprobable**, con ciudad, fecha y soles visibles. La descripción pública de Margen Real ya promete costos y márgenes; conviene concretarla en series reconocibles y fortalecer su identificación geográfica. No hay base para prometer seguidores o vistas: el canal propio solo aporta dos Shorts de uno/dos días en esta consulta.

## Entrega y recorrido hasta la fábrica

- [Biblia parcial](../../canales/margen-real/biblia.json): público, promesa, reglas contables/editoriales, fuentes resumidas dentro de `notas` y propuesta de presentación por red.
- [Competidores](../../canales/margen-real/competidores.json): ocho referentes, **60 videos de muestra**, selección por referente, contador/precisión, edad/fecha, segundos, media, mediana, ranking y límites. Los 90 candidatos de tres canales conservan metadatos mínimos adicionales para auditar el filtro; no son 90 videos extra en los denominadores.
- [Identidad](../../canales/margen-real/identidad.json): cuenta objetivo, IDs de homónimos, evidencia pública y vínculo TikTok sin confirmar.
- [Lecciones](../../canales/margen-real/lecciones.json): cinco hipótesis externas; `confirmadas: []`. Piloto expresamente no programado.
- [Guía de aplicación posterior](../../canales/margen-real/README.md) y [seis pruebas sin red](../../tests/margen_estrategia.test.cjs).

**La carpeta no se carga sola en n8n.** La biblia activa reside en `fab_trabajos.resultado.resultado`; `Nuevo video` la incluye en `datos.biblia`. El parche usa únicamente campos ya permitidos por Cooper, cada uno por debajo de 6.000 caracteres. El resumen y sus enlaces están dentro de `notas`, por lo que no dependen de que el guionista abra archivos locales. La prueba ejecuta `Aplicar ajuste` y `Nuevo video` existentes sobre filas ficticias y comprueba ese recorrido, preservando nombre, voz, activos, presupuesto, calendario, otras redes y lecciones previas.

En una integración posterior autorizada se debe identificar el `canal_id` interno del dueño, contrastar el ID público de YouTube, conciliar las notas existentes y usar Operación → Biblia y el puente/confirmaciones existentes. No reemplazar la biblia completa ni importar las hipótesis como aprendizajes confirmados. No se implementó otro adaptador, API, importador o scheduler.

## Cómo se investigó

Tres subagentes trabajaron en paralelo: Perú; referentes hispanos; identidad y referencias complementarias. Lectura previa de especificación, ENTREGA, README, ESTADO y diseño; skill `ecosistema-constructor` aplicada a aislamiento/verificación, con prioridad de las instrucciones expresas de esta misión para actualizar ESTADO e informe. Un subagente hizo además revisión independiente de las proyecciones finales.

La búsqueda web sirvió para descubrir fuentes. El lector web limitó algunos accesos a YouTube y el navegador integrado no estuvo disponible; GET ordinarios a **HTML público** permitieron contrastar tarjetas, metadatos de `watch` y `/about`, sin cookies, credenciales ni API de YouTube. Solo se versionó una proyección mínima, no HTML, sesiones, parámetros internos ni descripciones completas.

Consulta principal: **21-11-2026, aproximadamente 13:14–13:19 Lima**; cada observación conserva fecha o instante disponible. Las fechas originales de publicación mantienen su zona horaria. Tres canales muestran vistas redondeadas en tarjetas; los otros cinco usan contadores enteros de `watch`. No combinar una tarjeta y un contador de otra hora como si fueran la misma medición.

Promedio = suma de vistas observadas / número de videos con dato. Razón = vistas del video / promedio de **su muestra**, incluyéndolo. La mediana muestra la concentración. 2× es un criterio exploratorio interno, no una prueba estadística. No afirmamos haber encontrado el máximo histórico de cada canal ni su promedio global.

Se separaron Shorts de Videos; las muestras históricas y las heterogéneas se identifican. No hay vistas a igual edad, CTR, retención, ingresos ni observación audiovisual de las aperturas de competidores. Los ganchos analizados se **infieren de títulos y metadatos públicos**. YouTube recomienda comparar el mismo tipo de contenido; sus métricas de atracción y permanencia no se sustituyen por vistas. [Ayuda oficial](https://support.google.com/youtube/answer/12942217).

## Qué videos superan la media observada

Las cifras con ≈ proceden de tarjetas redondeadas. Cada enlace de ejemplo lleva a la fuente primaria; el JSON contiene todos los videos que forman cada denominador, con su duración y fecha.

| Referente / mercado | Muestra y vigencia | Media / mediana de vistas | Máximo observado y duración | × media |
| --- | --- | --- | --- | ---: |
| [Infomercado](https://www.youtube.com/@infomercadoperu/shorts), Perú | 8 Shorts de la serie de emprendimiento, ≥7 días; 20 oct–12 nov 2026 | 3.924 / 2.877,5 | [SV Tuning](https://www.youtube.com/watch?v=EJiXBBaIpls): 10.041; **2:41** | **2,56** |
| [PQS](https://www.youtube.com/@PQSpe/videos), Perú | 8 entrevistas de 15–30 min; **archivo de 2022** | 395,25 / 371,5 | [Indecopi](https://www.youtube.com/watch?v=i_hSjiUkqzQ): 649; **29:30**, empatado con [Fintech](https://www.youtube.com/watch?v=_9fyXeeGwls): 649; **21:46** | 1,64 |
| [Emprende Trome](https://trome.com/emprende-trome/), Perú | 4 reportajes <5 min encontrados por búsqueda; **conveniencia, 2016–2019** | 33.765 / 3.351,5 | [Caja China](https://www.youtube.com/watch?v=xl8i0nzgPz8): 127.102; **3:42** | **3,76** |
| [Adrián Sáenz](https://www.youtube.com/@AdrianSaenz/videos), España | Primeros 8 elegibles entre 30: edad visible 1–12 meses, 4–60 min; aquí todos «hace 1 mes» | ≈423.500 / 453.000 | [Higgsfield](https://www.youtube.com/watch?v=fJzUnSEnKNs): ≈940.000; **20:57** | **2,22** |
| [Eduardo Rosas](https://www.youtube.com/@EduardoRosas/videos), México | Mismo filtro; piezas de 5–8 meses. No acredita cadencia reciente | ≈31.875 / 33.000 | [Declaración SAT](https://www.youtube.com/watch?v=UWCZSdXzZuo): ≈46.000; **21:13** | 1,44 |
| [Luis Mi Negocios](https://www.youtube.com/@luisminegocios/videos), México | Mismo filtro; edad visible 1–2 meses | ≈259.125 / 75.000 | [Buen Fin](https://www.youtube.com/watch?v=AOyXGvxi9Kk): ≈1.000.000; **9:53** | **3,86** |
| [Emprende Aprendiendo](https://www.youtube.com/@EmprendeAprendiendo/videos), hispano; país no expuesto | Primeros 8 Videos, todos ≥1 mes; 23 jun–20 oct 2026; mezcla casos/noticias/clase | 77.397,625 / 25.998,5 | [Agentes OpenAI/Meta](https://www.youtube.com/watch?v=AHc8XgXoZEQ): 403.565; **9:59** | **5,21** |
| [Detrás del Margen](https://www.youtube.com/@Detras_del_Margen/videos), México | Primeros 8 Videos; 23 ago–18 oct 2026; **solo 4–241 vistas por pieza** | 55,75 / 26 | [OXXO](https://www.youtube.com/watch?v=gJHGN6EcqLA): 241; **17:50** | **4,32** |

No todas las muestras tienen un destacado ≥2×: PQS y Eduardo no lo tienen. La razón de Detrás del Margen parece grande por su denominador pequeño; no acredita tracción consolidada. Caja China domina una selección antigua y sesgada: no permite predecir 2026. El dato peruano reciente más útil es Infomercado: además de SV Tuning, [GPC](https://www.youtube.com/watch?v=lsqC_JAqNz8) alcanza 6.746, **1,72×**, en 2:01. En Luis, [recesión](https://www.youtube.com/watch?v=uPva96daO-w) alcanza ≈710.000, **2,74×**, en 15:34. Estos resultados generan hipótesis, no causalidad.

### Formatos, duraciones y ganchos trasladables

| Referente | Duración observada en su muestra | Lectura del empaque y aplicación propia propuesta |
| --- | --- | --- |
| Infomercado | **1:52–2:52**, Shorts de historias locales | Negocio reconocible, origen y crecimiento. Ensayar oficio/producto concreto con una cuenta operativa en soles. La presencia de dos automotrices destacados no demuestra que ese rubro sea superior. |
| PQS | **17:54–29:55**, entrevistas | Pregunta práctica y experto identificable. Extraer una respuesta verificable por pieza; el archivo no justifica copiar su duración ni sus asuntos de 2022. |
| Trome | **2:11–3:50**, perfiles | Producto cotidiano y persona detrás del negocio. Añadir al relato la cuenta completa, sin tratar las vistas de un video de 2016 como tendencia vigente. |
| Adrián | **14:20–47:04**, tutorial/experimento | Primera persona, herramienta y restricción concreta. Reutilizar la estructura de prueba solo cuando haya experiencia documentada propia; evitar promesas de riqueza. |
| Eduardo | **8:55–21:45**, explicación práctica | Una tarea o decisión específica. Comparar opciones con iguales unidades; no trasladar SAT, AFORE o reglas mexicanas al Perú. |
| Luis | **4:47–25:06**, explicación financiera | Prevención de pérdida y ocasión reconocible. Probar costo omitido frente a resultado por unidad, sin fabricar alarma o urgencia. |
| Emprende Aprendiendo | **6:06–56:08**, muestra heterogénea | Conectar marcas/cambios con una consecuencia para emprender. Usar solo cambios que afecten una partida del caso peruano; la clase larga no demuestra mejor retención. |
| Detrás del Margen | **11:10–17:50**, cuentas de negocios | Contraste venta/resultado y marca conocida. Diferenciarse con expediente peruano comprobable, sin copiar cálculos mexicanos o tomar su escala pequeña como modelo de éxito. |

Los países públicos de Adrián, Eduardo, Luis y Detrás constan en sus `/about`, enlazados en el dataset. PQS se identifica además con [Fundación Romero](https://fundacionromero.org.pe/proyectos/pqs/); Infomercado con su [catálogo oficial](https://infomercado.pe/videos/). No se etiquetó Emprendedor Eficaz como peruano porque no se acreditó esa identidad.

## Identidad y homónimos

| Cuenta | Identificador público | Qué quedó demostrado |
| --- | --- | --- |
| [@MargenRealtv](https://www.youtube.com/@MargenRealtv/about) | `UCjG7RP3o2RGGju9YnH6lnFg` | URL objetivo y temática de costos/márgenes confirmadas. Perú procede del encargo; `/about` no expone país. El ID no verifica propiedad administrativa. |
| [@MARGENREAL](https://www.youtube.com/@MARGENREAL/about) | `UCsVmYzwaARnTo9_uJ8XBS7g` | Homónimo distinto; declara **España** y explica empresas. No llamarlo mexicano. |
| [@MargenReal-x5c](https://www.youtube.com/@MargenReal-x5c/about) | `UCBPNMfrXGxT7dqGvor_UYAg` | Homónimo de micronegocios; 4 videos públicos; país no expuesto. |
| [@EscueladeMargen](https://www.youtube.com/@EscueladeMargen/about) | `UC44g8kzJpbY6kSgGsOg6SqA` | Nombre mostrado «Margen real»; una pieza; país no expuesto. |
| [TikTok @margenreal](https://www.tiktok.com/@margenreal) | No se asignó un ID privado o supuesto | oEmbed devuelve autor **margen**. La URL existe, pero **no se probó el vínculo con el YouTube del encargo**. |

El supuesto **Margen Real mexicano exacto no quedó corroborado**. Detrás del Margen sí declara México, pero no es el mismo nombre. La ausencia de corroboración no demuestra inexistencia. Para TikTok se consultó antes la [documentación oficial de perfiles embebidos](https://developers.tiktok.com/docs/en/embed-creator-profiles); se usó únicamente su [oEmbed público](https://www.tiktok.com/oembed?url=https://www.tiktok.com/@margenreal), sin OAuth ni tokens. No se invocaron otras APIs.

Los dos Shorts propios observados son [grifo](https://www.youtube.com/shorts/XaNPu8nxWqM), **56 s**, 20 nov, contador `watch` 0, y [pollería](https://www.youtube.com/shorts/3sY1JsbPxMY), **67 s**, 19 nov, contador `watch` 301. La tarjeta de pollería mostraba 300 y un agregado anterior 295: instantáneas no sincronizadas, conservadas con procedencia, no una caída de vistas. Ninguna cifra sustenta un ranking propio de éxito a esta edad.

**Propuesta de identificación:** nombre visible «Margen Real | Negocios del Perú»; descriptor «Negocios peruanos, cuentas en soles y costos a la vista»; firma «¿Cuánto queda de verdad?». Conservar `@MargenRealtv`, sus activos y su voz. Añadir Perú/S/ al contexto editorial y enlazar redes solo tras confirmar sus IDs. Son propuestas, no cambios de perfil ejecutados ni una afirmación de exclusividad marcaria.

## Estrategia ejecutable como piloto

**Prioridad 1: expediente antes del guion.** Un negocio, una unidad de venta, ciudad y periodo. Clasificar cada dato como documento, declaración atribuida o estimación. Mostrar ventas, costos variables y contribución; después costos fijos del mismo periodo y remuneración del trabajo del dueño cuando no esté incluida. Separar caja, resultado operativo y utilidad neta. Si faltan impuestos, depreciación, financiamiento u otras partidas relevantes, decirlo y nombrar correctamente el subtotal. No llamar «real» a una cuenta simulada: usar «escenario ilustrativo» y supuestos explícitos.

**Prioridad 2: series que permitan volver.** «La cuenta completa» responde qué se vende, qué cuesta y qué queda; «El costo que faltaba» cambia una partida; «Dos decisiones, la misma caja» mantiene los supuestos al comparar. Presentar fuente y fecha en pantalla al usar una cifra y en descripción. Para el equilibrio, dividir costos fijos por contribución unitaria solo cuando esta sea positiva. Comprobar aritmética y evitar doble conteo.

**Prioridad 3: piloto de cuatro semanas**, condicionado a expedientes suficientes y capacidad aprobada: un documental semanal de **8–12 minutos** y dos cortes autónomos de **35–55 segundos**. Son rangos editoriales a probar, no óptimos inferidos de los rivales. La promesa pública ya anuncia un documental semanal; los cortes son una propuesta adicional. Cada corte debe resolver su pregunta, no quedarse en un anuncio del largo. Si la cuenta no cabe legible, ampliar o simplificar la pregunta sin esconder costos.

| Semana / expediente propuesto | Título provisional del documental | Dos cortes y contraste de gancho | Evidencia necesaria antes de producir |
| --- | --- | --- | --- |
| 1. Pollería de barrio | «Pollería en Perú: lo que queda por pollo» | A: «De cada S/10, ¿cuánto queda?» B: «El pollo que no se vende también cuesta» | Precio, unidades/día, insumos, merma, personal y costos fijos; no reutilizar cifras del Short anterior sin verificarlas. |
| 2. Bodega | «Bodega: vender más, ¿te deja menos?» | A: resultado por una compra; B: inventario/merma que no aparece al cobrar | Mezcla de productos, costos de compra, mermas, días de stock, alquiler y horas del dueño. |
| 3. Delivery | «Delivery propio o app: la misma venta, dos cuentas» | A: qué queda del pedido; B: comisión, empaque y devolución | Tarifas vigentes/documentadas del caso, reparto, empaque, devoluciones y mismo precio/base; no inventar porcentajes. |
| 4. Lavandería | «Lavandería: ¿cuántos kilos pagan el alquiler?» | A: aporte de un kilo; B: tiempo/equipo que cambia el equilibrio | Precio, capacidad, agua/energía, insumos, trabajo, mantenimiento y amortización; separar costo y salida de caja. |

Estos temas son **propuestas de investigación**, no casos ya verificados ni órdenes para gastar o publicar. No se usan importes nuevos como hechos. Antes de elegir cada tema, confirmar si existe evidencia suficiente; si no, cambiar el caso o plantear un escenario rotulado. Casos fuera de Lima son deseables cuando haya fuentes, sin fingir alcance nacional de una muestra local.

Largo propuesto: pregunta y cifra verificable al inicio → unidad económica → cuenta → costo omitido → escenario de menor demanda → conclusión que responde y señala límites. Corte propuesto: pregunta → cuenta legible → contraste → resultado condicionado. Miniatura con producto reconocible y una sola pregunta económica; título y miniatura se complementan. No se recomiendan videos de miedo macroeconómico porque destacaron en otro país.

## Medición y decisiones

1. **Conservar línea base por red y formato.** YouTube largo, Shorts y TikTok separados. Registrar métricas a 2/7 días mediante aprendizaje existente si está autorizado; revisión a 28 días propuesta. Esta misión no activó Analytics ni añadió tareas automáticas.
2. **Separar atracción y cumplimiento.** En largos, CTR por origen, permanencia a 30 s y duración media; en Shorts, engaged views/permanencia disponibles; en TikTok, tiempo medio, completados, compartidos/guardados si existen en la cuenta propia. Dato ausente = sin dato. No sumar vistas multirred como personas ni usar contadores públicos como retención. [Retención oficial](https://support.google.com/youtube/answer/9314415), [Shorts y engaged views](https://support.google.com/youtube/answer/10059070).
3. **Probar una diferencia por vez.** Tres pares de cortes de temas equivalentes, alternando gancho de resultado y costo omitido; mantener legibilidad y duración aproximada. Registrar diferencias de tema, distribución y fecha: no es un A/B aleatorio ni prueba causal. Para títulos/miniaturas de largos, comparar opciones sobre el mismo expediente con las herramientas disponibles; no atribuir a un cambio secuencial todo el crecimiento posterior.
4. **Regla interna propuesta, sin promesas:** cuando existan diez antecedentes comparables a la misma edad, ensayar 1,25× su mediana a siete días y permanencia sin deterioro repetido en tres piezas. Es un criterio editorial elegido, no un estándar de la plataforma. Con pocos antecedentes o vistas insuficientes, resultado inconcluso: seguir midiendo y no aumentar cadencia por un único pico.
5. **Convertir en lección solo lo repetido en el canal propio**, con fuente, ventana, tamaño y contraejemplos. El contrato local requiere al menos tres videos. Los cinco objetos entregados siguen como hipótesis, sin resultados propios de validación. Revisar definiciones al comparar capturas históricas: la [ayuda actual de vistas](https://support.google.com/youtube/answer/12220281) incluye cambios de cómputo; no empalmar métricas distintas ciegamente.

## Commits y verificación

| Commit | Contenido |
| --- | --- |
| `818f3e5` | Datos de ocho referentes, identidad, biblia parcial, hipótesis, guía y seis pruebas de integridad/compatibilidad. |
| Commit de cierre que contiene este informe | Informe y actualización de `docs/ESTADO.md`; sin cambios de ejecución. |

La revisión independiente comprobó cálculos, países, referencias y el límite de los campos. Se corrigieron dos etiquetas de vistas en candidatos, la distinción de formatos heterogéneos y la vigencia de Eduardo antes del commit de datos. Se preservaron los archivos de misión preexistentes sin seguimiento.

**Puerta final PASS sobre `818f3e58a483c7652f9d572b80a1db769ae9d1f4`, cerrada el 21-11-2026 a las 13:32 Lima: 0 errores y 0 advertencias.** El commit de cierre solo añade este informe y ESTADO. Node 24.22.3, npm 12.2.2; Next 16.4.6. La cadena completa se ejecutó en el orden exigido, con `NEXT_TELEMETRY_DISABLED=1` y sin cargar archivos de entorno reales:

```bash
cd cooper
npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
node --test tests/margen_estrategia.test.cjs
```

| Comprobación | Resultado final | RC |
| --- | --- | ---: |
| `npm ci` | 358 paquetes instalados; 365 auditados; 0 vulnerabilidades | 0 |
| `npm run lint` | 0 errores, 0 advertencias; `--max-warnings 0` | 0 |
| `npm run typecheck` | PASS | 0 |
| `npm test` | **284/284**, 30 archivos | 0 |
| `npm run test:e2e` | **43/43**, sin omisiones ni reintentos; incluye Sentinel aislado | 0 |
| `npm run build` | PASS, build final de producción | 0 |
| `node --test tests/flujos_v2.test.cjs` | **147/147**, sin omisiones | 0 |
| `node --test tests/margen_estrategia.test.cjs` | **6/6**, sin red ni omisiones | 0 |

RC de la cadena Cooper: **0**. Logs completos locales, fuera de Git por la política del repositorio: [puerta Cooper](../../cooper/.cache/total-margen-estrategia/puerta-cooper.log), [flujos](../../cooper/.cache/total-margen-estrategia/flujos.log), [datos del canal](../../cooper/.cache/total-margen-estrategia/datos-canal.log) y [resumen con SHA](../../cooper/.cache/total-margen-estrategia/resumen.json). Sentinel: 0 fallos; una observación informativa de cobertura de vista sin URL propia, no una advertencia. Los ensayos usan loopback, bases efímeras y servicios simulados.

| Evidencia | SHA-256 |
| --- | --- |
| `puerta-cooper.log` | `705e9f9bbd743c3a5db70c6ccfda64197886c2a7c8fb5af0e7481b91a36a1960` |
| `flujos.log` | `99c3f57de148406da424e9af7c78617a9517dbc651e99e27679d5a737457a03e` |
| `datos-canal.log` | `0f2a84b26842cba0324a5c7343a9c74ce0709f6f4886d4299085986a446b504e` |

La primera ejecución terminó con **42/43 E2E**, RC 1: Sentinel no tenía su Chromium `1243` dentro de este worktree. La preparación inicial de Playwright también anunció la distribución Linux de respaldo. Se conservaron [el log inicial](../../cooper/.cache/total-margen-estrategia/puerta-cooper-inicial.log) y [el diagnóstico](../../cooper/.cache/total-margen-estrategia/sentinel-inicial.json), se descargaron los navegadores en las carpetas `.cache` previstas por el README y se repitió toda la puerta. [Preparación de Sentinel](../../cooper/.cache/total-margen-estrategia/preparacion-sentinel.log). No se modificaron pruebas, guardianes ni umbrales para pasar. La segunda cadena completa es la evidencia final; las advertencias de preparación de la primera no se presentan como una ejecución limpia.

## Limitaciones reales

- Las muestras son públicas y acotadas; describen vistas acumuladas, no ventanas comparables ni ingresos. Los métodos de selección difieren según disponibilidad y están declarados. No se vieron/oyeron aperturas audiovisuales; falta comprobar ejecución y retención.
- PQS y Trome son históricos; Detrás tiene volumen diminuto; Emprende Aprendiendo mezcla subformatos. No presentar esas señales como evidencia de crecimiento actual generalizable.
- No existe una línea base propia madura ni verificación pública de titularidad de TikTok. No se obtuvieron Analytics privados ni expedientes económicos de los negocios propuestos.
- El parche queda **preparado y probado localmente**, pendiente de revisión/integración y aplicación a la biblia activa. No hay autoimportación del repositorio a n8n, producción, perfiles modificados ni publicación.
- No hubo lectura de `.env` reales, claves/tokens, pagos, OAuth, push, merge, despliegue o contacto con el VPS/D&S Factory. Las pruebas usan sesiones ficticias y bases efímeras locales.

## Pendientes de Walter

1. Confirmar la URL/ID exactos del TikTok propio; el `@margenreal` público devuelve nombre «margen» y no acredita vínculo con `@MargenRealtv`.
2. Si tiene identificado un **Margen Real mexicano** concreto, aportar su URL para contrastarlo. Los homónimos comprobados están registrados; `@MARGENREAL` declara España.
3. Revisar descriptor «Negocios del Perú», series y piloto de un documental + dos cortes semanales; confirmar capacidad y recursos existentes. No hay calendario ni gasto activado.
4. Seleccionar casos peruanos con documentos/declaraciones utilizables y permisos de imagen/datos; decidir si los faltantes permiten un rango o exigen escenario ilustrativo.
5. Revisar con Claude la integración de los commits y la aplicación editorial por el puente existente, conciliando notas previas y confirmando el canal interno correcto. Esta misión no autoriza despliegue ni publicación.
6. Cuando corresponda, facilitar métricas propias mediante los mecanismos autorizados existentes para medir a 2/7/28 días y aceptar o descartar hipótesis. No se solicitan credenciales ni un login en esta misión.
