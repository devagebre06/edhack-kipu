# Kipu — Identidad de marca

**Nombre**: Kipu, del quechua *quipu*: el sistema andino de cuerdas y nudos usado para registrar información con precisión y memoria.

**Tagline**: *Trazabilidad pedagógica que acompaña.*

## Concepto

El quipu registraba sin borrar: cada nudo es un hecho que permanece. Kipu hace lo mismo con la evidencia pedagógica: cada versión de una entrega es un nudo en la cuerda — historial inmutable, retroalimentación inmediata, supervisión que acompaña en lugar de sancionar.

## Voz

- Acompaña, no acusa: "Tu sesión necesita una corrección", nunca "reprobado" ni "incumplimiento" hacia el docente.
- Español claro, sin jerga técnica ni de IA.
- Las alertas hablan de patrones y acciones sugeridas, no de culpables.

## Sistema visual

| Token | Valor | Uso |
|---|---|---|
| `--color-brand` | `oklch(0.55 0.15 35)` terracota andino | Acciones primarias, selección, logo |
| `--color-nav` | `oklch(0.28 0.04 250)` azul profundo | Sidebar, panel institucional |
| `--color-bg` | `oklch(0.985 0.002 60)` | Fondo |
| `--color-ink` | `oklch(0.24 0.01 50)` | Texto |
| ok / warn / bad | verde / ámbar / rojo | Solo estados y severidad |

- **Logo**: wordmark "kipu" en minúsculas + glifo de cuerda vertical con 3 nudos (SVG inline en `web/src/ui.tsx`).
- **Tipografía**: una sola familia (Inter/system-ui), escala fija, ratio 1.2.
- **Registro de diseño**: `product` (impeccable) — el diseño sirve a la tarea; color restrained, terracota solo como acento.
