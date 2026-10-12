# Kipu — Documentación del proyecto

> **Referencia histórica.** Este documento conserva detalles de una versión anterior, incluidas direcciones de despliegue. Para la demo actual y la entrega, consultar [README](../README.md) y [entrega-poc.md](entrega-poc.md).

> Trazabilidad pedagógica a gran escala. MVP para el hackathon UGEL 06 (Perú).
> Última actualización: 2026-07-19.

## 1. Qué es

Plataforma donde los **docentes** de colegios públicos suben evidencias
(sesiones de clase, unidades, notas) en PDF/PPTX/XLSX. Una IA las evalúa contra
las rúbricas del CNEB / ficha de monitoreo y devuelve **retroalimentación
accionable**. Los **directores** supervisan su institución y los **especialistas
UGEL** ven métricas agregadas, un mapa diagnóstico y alertas.

Principios de producto (ver [PRODUCT.md](../PRODUCT.md) y [docs/brand.md](brand.md)):
lenguaje **no punitivo**, estados siempre visibles, versionado inmutable como
metáfora del quipu, y datos agregados por defecto para UGEL.

## 2. Roles

| Rol | Qué hace |
|---|---|
| **Docente** (`teacher`) | Sube evidencias, ve sus estados y la retroalimentación, sube correcciones. |
| **Director** (`director`) | Métricas de su institución, tabla filtrable, alertas, horarios, export Excel. |
| **UGEL** (`ugel`) | Métricas agregadas por institución, mapa diagnóstico, alertas de la red. |

## 3. Arquitectura

```
┌────────────┐   lecturas (anon key + RLS)   ┌──────────────┐
│  Web (SPA) │ ─────────────────────────────▶│   Supabase   │
│  React/Vite│                                │ Postgres+Auth│
│            │ ─── escrituras (upload/eval) ─▶│   +Storage   │
└────────────┘        │                       └──────────────┘
                      ▼                               ▲
                ┌───────────┐  markitdown (Python)    │
                │ API Express│──▶ Markdown ──▶ Gemini ─┘ (service role)
                └───────────┘
```

- La **web es "thin"**: lee directo de Supabase con la *anon key* y RLS por rol.
- La **API** solo maneja **escrituras sensibles** (subida y evaluación de evidencias)
  y lecturas agregadas de UGEL. El *service role key* y la *key de Gemini* nunca
  llegan al frontend.
- La seguridad multi-rol se delega a **RLS de Postgres**.

### Stack

- **Web** (`web/`): Vite + React 19 + TypeScript + Tailwind v4 + React Router +
  TanStack Query + supabase-js. Recharts (gráficos), Leaflet (mapa diagnóstico),
  `xlsx` (export Excel en el cliente).
- **API** (`api/`): Express 5 + TypeScript ejecutado con `tsx` (sin build), `zod`
  para validar la salida de la IA, `multer` para uploads en memoria.
- **Datos/Auth/Storage**: Supabase (Postgres + Auth + Storage, bucket privado `evidence`).
- **IA**: Google Gemini (`gemini-3.8-flash`) vía REST con `responseSchema` JSON.
- **Conversión de documentos**: `markitdown` (subproceso Python), PDF/PPTX/XLSX → Markdown.

### Despliegue

| Pieza | Servicio |
|---|---|
| Web | Vercel — https://kipu-one.vercel.app |
| API | Railway (necesita Python + `markitdown`) — https://kipu-api-production.up.railway.app |
| DB/Auth/Storage | Supabase (`yoylrbqqxumdgvgdtviw`) |

## 4. El pipeline de evaluación

Flujo síncrono (sin cola ni worker) en [artifact.service.ts](../api/src/services/artifact.service.ts):

```
multer → Supabase Storage → markitdown (Python) → Gemini (responseSchema + Zod)
       → ocho criterios (0–3) → nota y decisión → contexto → auditoría
```

- El documento **siempre queda subido**. Una evaluación completada cuenta como
  satisfactoria y válida desde **18/24 puntos = 75/100**. Para sesiones, la
  relación con su unidad se valora dentro del criterio de coherencia.
- Documento ilegible o vacío (< 50 chars de Markdown) → estado `MANUAL_REVIEW`,
  nunca se pierde.
- Latencia típica ~30 s. Es un flujo por request: simple de operar y depurar,
  pero sin reintentos ni backpressure.

Config del dominio de IA versionada y persistida en cada evaluación:
`PROMPT_VERSION` (`v3`) y `RUBRIC_VERSION` (`planificacion-4primaria.v1`), en
[env.ts](../api/src/config/env.ts).

## 5. Modelo de datos

Migraciones en `supabase/migrations/` (aplicadas vía Session pooler de Supabase):

| Migración | Contenido |
|---|---|
| `001_init` | Schema base: `institutions`, `profiles`, `subjects`, `student_groups`, `class_schedules`, `artifacts`, `artifact_versions`, `evaluations`, `grade_records`, `alerts`, `audit_logs`. |
| `002_ugel06_diagnostico` | Datos UGEL 06: `ugel06_*` (ugel, colegio, profesor, sección, evaluación diagnóstica, red educativa…). |
| `003_unidades_clases` | `unit_groups`: liga unidades ↔ grupos. |
| `004_ugel06_profesor_contexto` | `artifact_contexts`, `ugel06_profesor_contexto`: contexto extraído de evidencias. |
| `005_profile_profesor_link` | Vincula `profiles` con profesores de UGEL 06. |
| `006_contexto_validez` | Reglas de validez del contexto. |

Núcleo del versionado:

```
artifacts (entrega lógica)
   └── artifact_versions (cada subida: sha256, storage_path, markdown)
          └── evaluations (model_name, prompt_version, rubric_version, score, criteria…)
```

Cada versión es "un nudo en la cuerda del quipu": historial inmutable, comparación
v1 vs v2. Los cambios de estado de alertas quedan auditados por **trigger** de Postgres.

## 6. API HTTP

Base: `/api/v1`. Auth por Bearer token de Supabase resuelto en
[middleware/auth.ts](../api/src/middleware/auth.ts).

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/artifacts` | Crea una evidencia y su versión 1 (dispara el pipeline). |
| `POST` | `/artifacts/:id/versions` | Sube una corrección (nueva versión). |
| `GET`  | `/artifacts/versions/:versionId/file` | Descarga el archivo original. |
| `GET`  | `/mapa` | Mapa diagnóstico agregado UGEL 06. |
| `GET`  | `/profesores` | Resumen de profesores UGEL 06. |
| `GET`/`POST`/`DELETE` | `/horarios`, `/horarios/link` | Gestión de horarios de clase (panel del directivo). |

## 7. Estructura del repo

```
api/
  src/
    server.ts            # bootstrap Express
    config/env.ts        # constantes de dominio desde env
    middleware/auth.ts   # perfil desde Bearer token
    infra/supabase.ts    # cliente service-role + audit
    routes/              # montaje de rutas /v1/*
    controllers/         # artifacts, mapa, profesores, horarios
    services/
      artifact.service.ts        # pipeline de subida/evaluación
      markdown.service.ts        # markitdown (Python)
      analysis/                  # extraction, gemini.client, evaluation, context, rubric
  scripts/               # seed, poblacion, add-user, apply-migration
web/
  src/
    pages/{teacher,director,ugel}/  # vistas por rol
    components/          # UI propia (Table, Badge, Modal…) + layout + evaluation
    hooks/               # TanStack Query (useArtifacts, useDashboards, useHorarios…)
    services/            # api, http, supabase, auth
    factories/           # mapeo DB → modelos de vista
    config/, types/
supabase/migrations/     # 001–006
docs/                    # brand.md, adr/
```

## 8. Desarrollo local

```bash
# Migración + seed (una vez)
psql "host=aws-1-us-west-2.pooler.supabase.com port=6543 user=postgres.yoylrbqqxumdgvgdtviw \
  dbname=postgres sslmode=require" -f supabase/migrations/001_init.sql
cd api && npm run db:seed

# API (requiere markitdown: pip install 'markitdown[pdf,pptx,xlsx]')
cd api && npm i && npm run dev        # :3001

# Web
cd web && npm i && npm run dev        # :5173
```

Variables de entorno: ver `api/.env.example` y `web/.env.example`. La web solo
usa la *anon key* con RLS; el *service role* y la key de Gemini viven solo en la API.

**Credenciales demo** (password `KipuDemo2026!`): `profesor@kipu.demo`,
`director@kipu.demo`, `ugel@kipu.demo` (ver [README.md](../README.md) para el guion completo).

## 9. Límites conocidos (deuda asumida de hackathon)

- **Sin tests automatizados**; verificado end-to-end contra servicios reales.
- Pipeline **síncrono**: sin reintentos, sin backpressure, sensible a picos de carga.
- `cors()` abierto sin restricción de origen en [server.ts](../api/src/server.ts).
- La key de Gemini viaja como query param en [gemini.client.ts](../api/src/services/analysis/gemini.client.ts) (riesgo de fuga en logs).
- Dependencia de subproceso Python (`markitdown`) acopla el runtime de la API.
