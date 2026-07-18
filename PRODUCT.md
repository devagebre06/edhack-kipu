# Kipu

**Registro**: product — el diseño sirve a la tarea, no es la marca.

## Qué es

Plataforma de trazabilidad pedagógica para UGEL (Perú). Docentes suben evidencias (sesiones, unidades, notas en PDF/PPTX/XLSX); la IA las evalúa contra rúbricas del CNEB y devuelve retroalimentación accionable. Directores supervisan su institución; especialistas UGEL ven métricas agregadas y alertas.

## Usuarios y escena

Docentes y directores de colegios públicos, en laptops modestas de sala de profesores con luz de día; especialistas UGEL en oficina. Usuarios no técnicos, español, poca paciencia para jerga. **Tema claro** obligado por la escena.

## Principios

1. **No punitivo**: el lenguaje acompaña, nunca acusa. "Tu sesión necesita una corrección", jamás "reprobado".
2. **Estados visibles**: cada entrega muestra claramente dónde está (procesando, aprobada, por corregir).
3. **Trazabilidad como metáfora**: cada versión es un nudo en la cuerda del quipu — historial inmutable visible.
4. **Datos agregados por defecto** para UGEL; el detalle requiere justificación.

## Sistema visual

- Tipografía: una familia (system-ui/Inter), escala fija rem, ratio 1.2.
- Color (restrained): fondo neutro `oklch(0.985 0.002 60)`, tinta `oklch(0.24 0.01 50)`, acento terracota `oklch(0.55 0.15 35)` solo en acciones primarias/selección, sidebar azul profundo `oklch(0.28 0.04 250)`. Estados: verde aprobado, ámbar corrección, rojo solo severidad de alertas.
- Componentes propios mínimos (tabla, badge de estado, tarjeta de criterio), Recharts para gráficos.

## Stack

Vite + React + TS + Tailwind v4 + React Router + TanStack Query + supabase-js. Lecturas directas a Supabase con RLS; escrituras (subida/evaluación) vía API Express.
