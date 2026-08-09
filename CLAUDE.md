# CLAUDE.md — Kipu

Instrucciones core del proyecto. Se cargan automáticamente en cada sesión.

## Directrices (axiomas)

### 1. La fuente de verdad de la DB es el diagrama draw.io

**[`supabase/models/kipu_db.drawio`](supabase/models/kipu_db.drawio) es la
fuente única de verdad del esquema de la base de datos del proyecto.**

- Cualquier cambio en ese diagrama (nueva tabla/columna/relación, rename, borrado)
  **obliga a propagar el cambio a todo el proyecto**: migraciones en
  [`supabase/migrations/`](supabase/migrations/), los modelos consolidados en
  [`supabase/models/*.sql`](supabase/models/), tipos/servicios del backend en
  [`api/src/`](api/src/), y tipos/servicios del frontend en [`web/src/`](web/src/).
- **Antes de propagar, medir el impacto del cambio.** Si el cambio es de bajo
  riesgo y mecánico (p. ej. añadir una columna nullable, un índice, un comentario),
  aplicarlo de forma **automática** en toda la cadena. Ese es el caso habitual.
- **Requiere intervención humana** (preguntar antes de actuar) cuando el impacto es
  alto o ambiguo: borrado/rename de columnas o tablas en uso, cambios de tipo con
  posible pérdida de datos, cambios en RLS o en llaves foráneas, o cualquier cosa
  que rompa datos existentes o contratos de API. En esos casos, exponer el impacto
  medido y preguntar cómo proceder.
- El flujo inverso también aplica: si un cambio de esquema nace en una migración o
  en código, **actualizar el `.drawio`** para que siga reflejando la realidad.

> Convención visual del diagrama: azul = esquema Kipu (app), verde = UGEL 06
> (diagnóstico), morado = vistas; PK negrita+subrayado, FK cursiva, arista roja
> punteada = puente entre dominios (`profiles.dni → ugel06_profesor.dni`).

### 2. Principios de producto (de `PRODUCT.md`)

Guían toda decisión de UI, copy y modelado. No son estética, son requisitos:

- **No punitivo**: el lenguaje acompaña, nunca acusa. "Tu sesión necesita una
  corrección", jamás "reprobado".
- **Estados visibles**: cada entrega muestra claramente dónde está (procesando,
  aprobada, por corregir).
- **Trazabilidad = quipu**: cada versión es un nudo en la cuerda; historial
  inmutable y visible (de ahí `artifact_versions`, nunca sobrescribir).
- **Datos agregados por defecto para UGEL**; el detalle requiere justificación.
- **Tema claro obligatorio** (escena: sala de profesores con luz de día, usuarios
  no técnicos, español, poca jerga).

## Memoria del proyecto

Kipu es una plataforma de trazabilidad pedagógica para UGEL (Perú): docentes
suben evidencias (sesiones, unidades, notas en **PDF/PPTX/XLSX**); la IA
(**Gemini**) las evalúa contra rúbricas del **CNEB** y devuelve retroalimentación
accionable. Directores supervisan su institución; especialistas UGEL ven métricas
agregadas, **mapas** y alertas.

### Estructura (monorepo)

- **`api/`** — backend **Express + TypeScript** (ejecutado con `tsx`). Deps clave:
  `@supabase/supabase-js`, `multer` (subida de archivos), `ws` (websockets),
  `zod` (validación), `cors`. Análisis con Gemini. Scripts de datos en
  `api/scripts/`.
- **`web/`** — frontend **Vite + React + TypeScript + Tailwind v4**, organizado en
  capas (`components/`, `pages/`, `hooks/`, `services/`, `factories/`, `types/`).
  Deps clave: `@tanstack/react-query`, `react-router-dom`, **Radix UI**,
  **Recharts** (gráficos), **Leaflet / react-leaflet** (mapas UGEL), `sonner`,
  `lucide-react`, `xlsx`.
- **`supabase/`** — `migrations/` (DDL versionado) y `models/` (esquema canónico
  consolidado + diagrama; ver directriz 1).
- **`docs/`**, `PRODUCT.md` — producto y documentación.

### Patrón de acceso a datos

**Lecturas directas a Supabase desde el frontend con RLS**; **escrituras**
(subida y evaluación de evidencias) **vía la API Express** con `service_role`.
No escribir a tablas desde el frontend.

### Base de datos — modelo unificado (migración `008_remodelado.sql`)

- **Dominio único**. Jerarquía institucional: `ugels → canales → colegios`; el
  **colegio ES la institución** (usuarios, alumnos, aulas, alertas cuelgan de él).
  La data real de UGEL 06 puebla estas tablas vía el **adapter de ingesta**.
- **Identidad**: `usuarios` (→ `auth.users`) + `roles` (key `ugel|director|profesor`)
  + `datos_personales` (1:1, dni). Helpers RLS `mi_rol()`/`mi_colegio()`.
- **Dictado como hub**: `dictados` (aula+curso+profesor+periodo) → cuelgan
  `horarios`, `unidades` → `sesiones`.
- **Evidencia polimórfica**: `evidencias` (unidad XOR sesión) → `evidencia_versiones`
  → `evaluaciones`; `contextos_ia` (1:1, oculto por RLS). Un solo pipeline.
- **Notas**: `notas` (+ `escala_logro` C/B/A/AD ↔ 1-4). El diagnóstico se guarda
  como `notas` (tipo `DIAGNOSTICO`, competencias C1-C4 + GENERAL).
- **Adapter**: `fuentes_datos` + `mapeo_llaves_externas` (llave externa → uuid).
  Ver `api/scripts/lib/adapter.mjs`. Data sintética marcada con `es_sintetico`.
- **Vistas** del panel UGEL: `vw_mapa_colegio_curso`, `vw_profesor_resumen`,
  `vw_alumnos_por_profesor`, `vw_notas_agregadas`.
- Llaves: `uuid` surrogado + columna `codigo`/natural `unique` en cada tabla.
- Migraciones vía **Session pooler** (`aws-1-<region>.pooler.supabase.com:5432`);
  conexión directa `db.<ref>.supabase.co` **deprecada**. El `service_role` JWT
  **no** ejecuta DDL. Correr `db:poblacion` **antes** de `db:seed`.
- **Adaptador front↔DB**: el frontend mantiene sus tokens de dominio (`role:'teacher'`,
  `institution_id`, forma `Artifact`); la traducción a `profesor`/`colegio_id`/
  `evidencias` vive en `web/src/services/{auth,api}.ts` (choke points).

### Comandos

| Contexto | Comando |
|---|---|
| API dev | `cd api && npm run dev` (nodemon) |
| API build/run | `cd api && npm start` |
| Migración | `cd api && npm run db:migrate -- ../supabase/migrations/00X_*.sql` |
| Seed / poblar | `cd api && npm run db:seed` · `npm run db:poblacion` |
| Web dev | `cd web && npm run dev` |
| Web build | `cd web && npm run build` (typecheck `tsc -b` + vite) |
| Web lint | `cd web && npm run lint` (oxlint) |

## Convenciones

- Commits en **español**, estilo Conventional Commits: `feat(api): …`,
  `fix(web): …`, `refactor(web): …`, `chore: …`.
- Secretos (claves Supabase, `SUPABASE_DB_URL`, `GEMINI_API_KEY`) van en `.env`
  (gitignored). **Nunca** en código, en el repo, ni en `settings.local.json`.
- Idioma de trabajo: español (respuestas, comentarios de código y documentación).
