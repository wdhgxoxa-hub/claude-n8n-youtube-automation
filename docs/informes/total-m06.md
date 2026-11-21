# M06 — retención e inventario de datos

21-11-2026, Lima. Rama/worktree `total-m06`, base `de397f3195856c10b6a9959171ff42da4328d9ec` (`version-chatgpt`). **Implementado y probado con fixtures; no integrado ni desplegado. Purga real pendiente B08.**

## Commits y alcance

- `93d7c44b150a9eeac05768c8af806c64e693b241` — «M06: inventariar datos y simular retención sin habilitar borrado»: servicio de proyección SQLite, CLI, política conservadora, 23 pruebas y guía de operación.
- El commit documental de cierre se identifica con `git log -1 -- docs/informes/total-m06.md`; añade este informe, evidencia de puerta, ESTADO y corrige la descripción histórica del consentimiento en `cooper/MEDIOS.md`.

Se leyeron especificación, ENTREGA, README, ESTADO, la guía disponible en `docs/diseno/`, AGENTS y M06 del archivo de auditoría ya presente. Se aplicó la skill `ecosistema-constructor`, respetando la instrucción expresa de actualizar ESTADO. Se revisaron `git branch --list 'total-*'`, los commits relacionados con retención y los cambios de seguridad/operación/runtime y M03/M05: no había una herramienta equivalente de inventario de datos. No se duplicaron copias, trabajadores, conciliación ni adaptadores. También se contrastó el aviso del orquestador y su guía de conciliación en la rama `cooper-total`, sin integrar esa rama.

## Cerrado

- `npm run datos:inventario` exige base, política, archivo nuevo de salida y `--simular`. Usa la dependencia SQLite existente, apertura readonly, `query_only` y una transacción de lectura; no carga `.env`, no migra, no invoca proveedores ni modifica la base. No existe modo ejecutor.
- Proyección por dueño: adjuntos, mensajes, memoria, activos/vistas, consentimiento/retos/contactos, ingestas y avisos. Referencias desde perfil, chat, biblioteca, marcas y revisiones; conserva referencias compartidas y consumidores de otro dueño. Cuenta referencias remotas de videos sin recuperar sus URLs.
- Clasifica huérfanos y candidatos simulados con motivo. Protege identidad/consentimiento, operaciones pendientes/inciertas, originales compartidos, memoria activa, referencias conservadas y datos sin fecha. Excepciones por dueño o recurso y plazos configurables; ejemplo predeterminado sin caducidad.
- Informe privado `0600`, sin sobrescritura, corte y huellas SHA-256 de política/proyección. No exporta cuerpos, fotos/base64, nombres, teléfonos, frases de identidad, consentimientos, URLs ni credenciales. Los IDs locales sí se conservan para auditar y el informe debe custodiarse.
- [Propuesta y uso](../cooper-retencion.md): escenarios de 30/90 días para mensajes anteriores al olvido y 7/30 días para ingestas terminadas, solo para comparar impacto y sujetos a Walter. No son plazos aprobados.

## Pruebas y evidencia

El conjunto específico pasó **23/23**: compartición y retirada de la última referencia, revocación, logos actuales/históricos y perfil, consumidores ajenos, seis clases de operación en curso/incierta, operaciones terminadas, aislamiento por dueño, antigüedad desconocida, memoria, referencias remotas, excepciones, JSON/base inválidos, política estricta, protección de salida, ausencia de escritura, borrado sintético y recuperación.

La recuperación usó `backup` de una base temporal, borró un mensaje exclusivamente desde el test, detectó el adjunto huérfano y restauró la copia; recuperó el contenido y una proyección idéntica. Una ejecución CLI con política válida conserva el SHA-256 del archivo de entrada; una base ausente no se crea y una incompatible no se migra. Un error privado no aparece en stderr. La primera pasada encontró una fixture con ámbito de memoria inválido y un tipo `unknown` de `pragma`; ambos corregidos antes del commit funcional.

Puerta completa sobre `93d7c44`, finalizada el **21-11-2026 a las 11:55 Lima**, **0 errores / 0 advertencias**. Se ejecutó la cadena obligatoria desde `cooper/` y la regresión desde la raíz:

| Comando | Resultado | Salida |
| --- | --- | --- |
| `npm ci` | 358 paquetes instalados; 365 auditados; 0 vulnerabilidades | 0 |
| `npm run lint` | 0 errores / 0 advertencias (`--max-warnings 0`) | 0 |
| `npm run typecheck` | TypeScript estricto | 0 |
| `npm test` | **307/307**, 31 archivos; incluye **23/23 M06** | 0 |
| `npm run test:e2e` | **43/43**, 6,9 minutos, Sentinel activo, sin omisiones | 0 |
| `npm run build` | Next.js 16.4.6; compilación final completa | 0 |
| `node --test tests/flujos_v2.test.cjs` | **147/147**, sin omisiones | 0 |

Evidencia versionada: [resultado y SHA-256](evidencias/total-m06/puerta.json), [log íntegro de la cadena](evidencias/total-m06/puerta.log) y [log de flujos](evidencias/total-m06/flujos.log). Las notificaciones informativas `npm notice run` no son advertencias. Copias y [ejemplo de informe de una fixture](../../cooper/.cache/total-m06/inventario-fixture.json) quedan en `cooper/.cache/total-m06/`; este último es sintético, tiene `borradoHabilitado: false` y no representa producción. Los cambios posteriores al código probado son exclusivamente documentales.

## Limitaciones reales

1. El alcance A/H13 queda cerrado como inventario y simulación local. No hay borrado real, restauración de producción, despliegue, programación, OAuth, pagos, publicación, push, merge, escritura VPS/n8n ni acceso a D&S Factory.
2. Los adjuntos no guardan fecha/procedencia histórica durable: un huérfano no se convierte en candidato aunque se configure un plazo. Sin esa historia no se reconstruye si fue original, derivado o evidencia de un activo eliminado.
3. El consentimiento está dentro de `assets`; el borrado heredado del activo elimina esa fila. Se corrige MEDIOS, que afirmaba que el consentimiento sobrevivía. Esta misión no crea un archivo histórico ni recupera datos ya eliminados; la política necesaria es B08.
4. Inventario acotado a SQLite y las familias descritas: no certifica el total de datos en n8n, proveedores, temporales, copias, eventos/gastos ni sus borrados físicos. Los bytes conocidos no equivalen al espacio recuperable. Las huellas no son un respaldo del contenido.
5. Las referencias siguen protegiendo archivos aunque el mensaje sea candidato: no se supone una cascada ya ejecutada. Las nuevas migraciones/campos de otras misiones requieren revisar la proyección; el orquestador debe repetir la puerta tras integrar.
6. Los navegadores de E2E/Sentinel se prepararon copiando sus cachés ya disponibles al worktree propio; no se desactivó Sentinel. La reproducibilidad desde un entorno sin Sentinel corresponde a M08.

Se preservan sin versionar los encargos preexistentes `docs/informes/faltantes-total.md`, `docs/misiones/_comun.md`, `docs/misiones/total-m06.md` y el aviso concurrente `docs/misiones/AVISO-cooper-total.md`.

## Pendientes de Walter

- **B08:** fijar plazos y excepciones por fotos/grabaciones, mensajes, identidad/consentimientos, derivados y copias; decidir conservación tras revocación y tratamiento de proveedores. Aprobar responsable/custodia de los informes privados.
- Autorizar por separado una futura ejecución de borrado real con lote concreto, revalidación de referencias/revisiones, conciliación previa y reversa probada; M06 no la habilita.
- Definir cómo conservar la trazabilidad de consentimientos al eliminar activos y cómo evitar que una restauración reintroduzca datos ya olvidados. No queda bloqueado ningún trabajo independiente de esta misión.
