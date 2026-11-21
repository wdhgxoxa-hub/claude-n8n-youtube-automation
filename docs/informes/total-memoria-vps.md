# Condición real de memoria del VPS para H19

Fecha: 2026-11-21 15:30 (Lima). Consulta exclusivamente de metadatos.

**El VPS no tiene swap utilizable.** Cooper vigente `cbf2068` está limitado a 1 GiB de RAM. Aunque Docker autoriza hasta 2 GiB combinados de RAM/swap, `SwapTotal` y `SwapFree` del host son cero. El ensayo H19 que utilizó aproximadamente 396 MiB de swap no reproduce esa condición y no acredita margen de memoria en producción.

| Campo observado | Valor |
|---|---:|
| Docker Server | 29.10.0 |
| `HostConfig.Memory` | 1.073.741.824 bytes |
| `HostConfig.MemorySwap` | 2.147.483.648 bytes |
| cgroup `memory.max` | 1.073.741.824 bytes |
| cgroup `memory.swap.max` | 1.073.741.824 bytes |
| Host `SwapTotal` | 0 kB |
| Host `SwapFree` | 0 kB |
| Compose candidato `mem_limit` | `1g` |
| Compose candidato `memswap_limit` | No definido |

[Recibo público](evidencias/total-radar-contexto/memoria-vps.json). El Compose candidato conserva SHA-256 `b3071fc8b069fec5f522ea7d69c4232ac8436519b09810178e610bdf649eedb7`, correspondiente a la aceptación de `bfd5e79`. No se serializó el entorno efectivo ni se consultaron logs; `docker inspect` se limitó a memoria, swap, imagen y PID usado para localizar los dos archivos públicos del cgroup. No se modificaron servicios o límites.

Docker define `MemorySwap` como el total combinado de memoria y swap; con límite de memoria y swap no especificado permite otra cantidad igual de swap **solo si el host dispone de ella**. Igualar ambos límites en el laboratorio impide swap y permite ensayar esa condición efectiva sin cambiar producción. [Documentación oficial](https://docs.docker.com/engine/containers/resource_constraints/#--memory-swap-details), [Compose](https://docs.docker.com/reference/compose-file/container-spec/#memswap_limit).

Competencia repetirá la medición H19 con 1 GiB y swap deshabilitado. Este recibo solo establece las condiciones reales: no afirma ausencia de OOM bajo carga, capacidad para 10.000 videos ni rendimiento del caso administrativo. No requiere repetir la puerta web porque no cambia código, configuración ni imagen.

## Pendientes de Walter

Ninguno nuevo. Cualquier corrección que resulte del ensayo sigue siendo trabajo técnico de Codex; no se cambian recursos ni se contrata capacidad durante esta consulta.
