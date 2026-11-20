# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: revision.spec.ts >> entrada, no encontrado y formularios accesibles en ambos temas y cuatro anchuras
- Location: e2e/revision.spec.ts:178:1

# Error details

```
Error: pedir-video claro 390

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 268

- Array []
+ Array [
+   Object {
+     "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
+     "help": "Elements must meet minimum color contrast ratio thresholds",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.14/color-contrast?application=playwright",
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f5f5f2",
+               "contrastRatio": 4.32,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6a757c",
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<body>",
+                 "target": Array [
+                   "body",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p>Ideas en movimiento. Historias listas para salir.</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".page-heading > div > p",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f5f5f2",
+               "contrastRatio": 4.32,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6a757c",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<body>",
+                 "target": Array [
+                   "body",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button aria-pressed=\"false\">En producción</button>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".filters > button:nth-child(2)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f5f5f2",
+               "contrastRatio": 4.32,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6a757c",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<body>",
+                 "target": Array [
+                   "body",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button aria-pressed=\"false\">Por aprobar</button>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "button:nth-child(3)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f5f5f2",
+               "contrastRatio": 4.32,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6a757c",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<body>",
+                 "target": Array [
+                   "body",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button aria-pressed=\"false\">Publicados</button>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "button:nth-child(4)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f5f5f2",
+               "contrastRatio": 4.32,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6a757c",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<body>",
+                 "target": Array [
+                   "body",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<small>Solo mío</small>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".video-list-row:nth-child(1) > .video-mini > div > small",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f5f5f2",
+               "contrastRatio": 4.32,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6a757c",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<body>",
+                 "target": Array [
+                   "body",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<small>Ciencia cotidiana</small>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".video-list-row:nth-child(2) > .video-mini > div > small",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f5f5f2",
+               "contrastRatio": 4.32,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#6a757c",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<body>",
+                 "target": Array [
+                   "body",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.32 (foreground color: #6a757c, background color: #f5f5f2, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<small>Ciencia cotidiana</small>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".video-list-row:nth-child(3) > .video-mini > div > small",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2aa",
+       "wcag143",
+       "TTv5",
+       "TT13.c",
+       "EN-301-549",
+       "EN-9.1.4.3",
+       "ACT",
+       "RGAAv4",
+       "RGAA-3.2.1",
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [ref=f27e1]:
  - generic [ref=f27e2]:
    - link "Saltar al contenido" [ref=f27e3] [cursor=pointer]:
      - /url: "#contenido"
    - generic [ref=f27e4]:
      - banner [ref=f27e5]:
        - button "Abrir navegación" [ref=f27e6] [cursor=pointer]
        - generic [ref=f27e10]:
          - generic [ref=f27e11]: En vivo
          - button "Pausar movimiento" [ref=f27e13] [cursor=pointer]
          - generic [ref=f27e14]: Modo de prueba
      - main [ref=f27e15]:
        - generic [ref=f27e17]:
          - generic [ref=f27e18]:
            - generic [ref=f27e19]:
              - heading "Tus videos" [level=1] [ref=f27e20]
              - paragraph [ref=f27e21]: Ideas en movimiento. Historias listas para salir.
            - button "Pedir video" [ref=f27e22] [cursor=pointer]
          - generic [ref=f27e24]:
            - heading "¿Qué vamos a contar?" [level=2] [ref=f27e25]
            - generic [ref=f27e26]:
              - text: Canal
              - combobox "Canal" [ref=f27e27]:
                - option "Selecciona un canal" [selected]
            - generic [ref=f27e28]:
              - text: Idea del video
              - textbox "Idea del video" [active] [ref=f27e29]:
                - /placeholder: Por qué el cielo es azul
            - generic [ref=f27e30]:
              - text: Presentador
              - combobox "Presentador" [ref=f27e31]:
                - option "Sin presentador" [selected]
                - option "Alma"
                - option "Mateo"
                - option "Luz"
                - option "Cooper"
            - generic [ref=f27e32]:
              - text: Voz
              - combobox "Voz" [ref=f27e33]:
                - option "Elegir según el guion" [selected]
                - option "Clara"
                - option "Tomás"
            - generic [ref=f27e34]:
              - text: Presencia del avatar
              - combobox "Presencia del avatar" [ref=f27e35]:
                - option "Solo en algunas partes" [selected]
                - option "Durante todo el video"
            - generic [ref=f27e36]:
              - button "Enviar a la fábrica" [ref=f27e37] [cursor=pointer]
              - button "Cancelar" [ref=f27e38] [cursor=pointer]
          - generic "Filtrar videos" [ref=f27e39]:
            - button "Todos" [pressed] [ref=f27e40] [cursor=pointer]
            - button "En producción" [ref=f27e41] [cursor=pointer]
            - button "Por aprobar" [ref=f27e42] [cursor=pointer]
            - button "Publicados" [ref=f27e43] [cursor=pointer]
          - generic [ref=f27e44]:
            - link "Solo mío <img src=x onerror=\"window.inyeccion=1\"> Aprobación de guion" [ref=f27e46] [cursor=pointer]:
              - /url: /videos/4cc38d9b-6117-4bd0-92af-a890a54474ad
              - generic [ref=f27e55]:
                - text: Solo mío
                - heading "<img src=x onerror=\"window.inyeccion=1\">" [level=2] [ref=f27e56]
                - generic [ref=f27e57]: Aprobación de guion
            - link "Ciencia cotidiana Cooper explica las mareas Aprobación de guion" [ref=f27e62] [cursor=pointer]:
              - /url: /videos/96da3ceb-9140-4882-afe6-8bf03476eb37
              - generic [ref=f27e72]:
                - text: Ciencia cotidiana
                - heading "Cooper explica las mareas" [level=2] [ref=f27e73]
                - generic [ref=f27e74]: Aprobación de guion
            - link "Ciencia cotidiana Por qué el cielo es azul Publicado" [ref=f27e79] [cursor=pointer]:
              - /url: /videos/b9c293cc-0425-40fb-bc23-5fab1f0f14ad
              - generic [ref=f27e88]:
                - text: Ciencia cotidiana
                - heading "Por qué el cielo es azul" [level=2] [ref=f27e89]
                - generic [ref=f27e90]: Publicado
  - alert [ref=f27e94]
```

# Test source

```ts
  152 |     navigator.mediaDevices.getUserMedia = async (constraints) => {
  153 |       const stream = await original(constraints);
  154 |       Object.assign(window, { grabacionEnsayo: stream });
  155 |       return stream;
  156 |     };
  157 |     Object.defineProperty(window, "MediaRecorder", {
  158 |       value: class {
  159 |         constructor() {
  160 |           throw new Error("Grabador no disponible");
  161 |         }
  162 |       },
  163 |     });
  164 |   });
  165 |   await page.goto("/");
  166 |   await page.getByRole("button", { name: "Grabar audio", exact: true }).click();
  167 |   await expect(
  168 |     page.getByRole("alert").filter({ hasText: "Grabador no disponible" }),
  169 |   ).toHaveText("Grabador no disponible");
  170 |   expect(
  171 |     await page.evaluate(() =>
  172 |       (window as unknown as { grabacionEnsayo: MediaStream }).grabacionEnsayo
  173 |         .getTracks()
  174 |         .every((track) => track.readyState === "ended"),
  175 |     ),
  176 |   ).toBe(true);
  177 | });
  178 | test("entrada, no encontrado y formularios accesibles en ambos temas y cuatro anchuras", async ({
  179 |   page,
  180 | }) => {
  181 |   test.setTimeout(180000);
  182 |   const { default: AxeBuilder } = await import("@axe-core/playwright");
  183 |   for (const theme of ["oscuro", "claro"]) {
  184 |     expect(
  185 |       (
  186 |         await page.request.patch("/api/perfil", {
  187 |           data: {
  188 |             name: "Ensayo visual",
  189 |             image: "",
  190 |             theme,
  191 |             home: "chat",
  192 |             whatsapp: "",
  193 |           },
  194 |         })
  195 |       ).status(),
  196 |     ).toBe(200);
  197 |     for (const width of [360, 390, 768, 1440]) {
  198 |       await page.setViewportSize({ width, height: 900 });
  199 |       for (const screen of [
  200 |         "entrada",
  201 |         "no-encontrado",
  202 |         "pedir-video",
  203 |         "crear-avatar",
  204 |         "crear-voz",
  205 |       ]) {
  206 |         const path =
  207 |           screen === "entrada"
  208 |             ? "/entrar?error=AccessDenied"
  209 |             : screen === "no-encontrado"
  210 |               ? "/inexistente"
  211 |               : screen === "pedir-video"
  212 |                 ? "/videos"
  213 |                 : "/avatares";
  214 |         await page.goto(path);
  215 |         if (["entrada", "no-encontrado"].includes(screen)) {
  216 |           // La entrada no tiene selector: se inspecciona también el juego de tokens claro.
  217 |           await page.evaluate((theme) => {
  218 |             document.documentElement.dataset.theme = theme;
  219 |           }, theme);
  220 |         } else {
  221 |           await expect(page.locator(".connection")).toHaveText("En vivo");
  222 |           if (screen === "pedir-video")
  223 |             await page
  224 |               .getByRole("button", { name: "Pedir video", exact: true })
  225 |               .click();
  226 |           else {
  227 |             if (screen === "crear-voz")
  228 |               await page
  229 |                 .getByRole("button", { name: "Voces", exact: true })
  230 |                 .click();
  231 |             await page
  232 |               .getByRole("button", {
  233 |                 name: screen === "crear-voz" ? "Crear voz" : "Crear avatar",
  234 |                 exact: true,
  235 |               })
  236 |               .click();
  237 |           }
  238 |         }
  239 |         expect(
  240 |           await page.evaluate(
  241 |             () => document.documentElement.scrollWidth <= window.innerWidth,
  242 |           ),
  243 |           `${screen} ${width}`,
  244 |         ).toBe(true);
  245 |         expect(
  246 |           (
  247 |             await new AxeBuilder({ page })
  248 |               .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
  249 |               .analyze()
  250 |           ).violations,
  251 |           `${screen} ${theme} ${width}`,
> 252 |         ).toEqual([]);
      |           ^ Error: pedir-video claro 390
  253 |         await page.screenshot({
  254 |           path: `test-results/visual/${screen}-${theme}-${width}.png`,
  255 |           fullPage: true,
  256 |         });
  257 |       }
  258 |     }
  259 |   }
  260 | });
  261 |
```
