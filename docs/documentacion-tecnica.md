# Kipu — Documentación técnica

> Referencia técnica completa del sistema. Para una visión general y de producto,
> ver [proyecto.md](proyecto.md). Última actualización: 2026-07-19.

**Índice**
1. [Panorama y topología](#1-panorama-y-topología)
2. [Modelo de dominio](#2-modelo-de-dominio)
3. [Base de datos](#3-base-de-datos)
4. [Seguridad y RLS](#4-seguridad-y-rls)
5. [Backend (API Express)](#5-backend-api-express)
6. [El pipeline de evaluación](#6-el-pipeline-de-evaluación)
7. [Capa de IA (Gemini)](#7-capa-de-ia-gemini)
8. [Frontend (React SPA)](#8-frontend-react-spa)
9. [Flujos end-to-end](#9-flujos-end-to-end)
10. [Configuración y despliegue](#10-configuración-y-despliegue)
11. [Scripts de datos](#11-scripts-de-datos)
12. [Límites y deuda técnica](#12-límites-y-deuda-técnica)

---

## 1. Panorama y topología

Kipu es una plataforma de **trazabilidad pedagógica** para la UGEL 06 (Perú).
Tres piezas desplegables:

```
┌─────────────────┐   lecturas (anon key + RLS)   ┌──────────────────┐
│  web/  React SPA │ ─────────────────────────────▶│     Supabase     │
│  Vercel          │                                │ Postgres + Auth  │
│                  │ ── escrituras (multipart) ────▶│   + Storage      │
└─────────────────┘         │                       └──────────────────┘
                            ▼  (service role key)          ▲
                   ┌──────────────────┐                    │
                   │  api/  Express   │  markitdown (py)    │
                   │  Railway         │──▶ Markdown ──▶ Gemini
                   └──────────────────┘   (subproceso)  (REST)
```

**Principio de reparto**: la web lee **directo de Supabase** con la *anon key*
(la seguridad la impone RLS de Postgres); la API solo recibe **escrituras
sensibles** (subida/evaluación de evidencias) y **lecturas agregadas** de UGEL
que requieren el *service role*. El *service role key* y la *key de Gemini* nunca
salen del backend.

| Capa | Stack |
|---|---|
| Web | Vite 8 · React 19 · TypeScript · Tailwind v4 · React Router 7 · TanStack Query 5 · supabase-js · Recharts · react-leaflet · `xlsx` |
| API | Node + Express 5 · TypeScript (ejecutado con `tsx`, sin build) · `zod` · `multer` · `@supabase/supabase-js` |
| Datos | Supabase: Postgres + Auth (JWT) + Storage (bucket privado `evidence`) |
| IA | Google Gemini `gemini-3.8-flash` vía REST (`generateContent` + `responseSchema`) |
| Conversión | `markitdown` (CLI Python) PDF/PPTX/XLSX → Markdown |

## 2. Modelo de dominio

**Roles** (`user_role`): `teacher`, `director`, `ugel`.

**Evidencia (artifact)**: unidad lógica de entrega de un docente. Cuatro tipos
(`artifact_type`):

| Tipo | Significado |
|---|---|
| `DAILY_SESSION` | Sesión de clase. Se liga a una unidad (`unit_id`) del docente. |
| `MONTHLY_UNIT` | Unidad de aprendizaje mensual. Cubre uno o varios grupos (`unit_groups`). |
| `BIMONTHLY_GRADES` | Notas bimestrales. |
| `ANNUAL_GRADE_SUMMARY` | Consolidado anual de notas. |

Cada evidencia tiene **N versiones inmutables** (`artifact_versions`), y cada
versión **una evaluación** de IA (`evaluations`). Estados (`artifact_status`):
`PROCESSING`, `APPROVED`, `NEEDS_REVISION`, `MANUAL_REVIEW`, `PROCESSING_ERROR`.

**Validez** ≠ estado: una versión tiene además `is_valid` + `invalid_reason`. El
documento **siempre se sube**; la validez decide si cuenta como sesión/unidad en
los agregados (ver §6).

**Diagnóstico UGEL 06**: subsistema paralelo (`ugel06_*`) con datos agregados
reales/sintéticos de 30 profesores y 1500 evaluaciones diagnósticas de
estudiantes, que alimenta el mapa y los paneles de UGEL. Se enlaza al mundo Kipu
por DNI (`profiles.dni → ugel06_profesor.dni`).

## 3. Base de datos

Migraciones en `supabase/migrations/`, aplicadas vía Session pooler de Supabase
(`aws-1-us-west-2.pooler...`, la conexión directa está deprecada).

### Tipos enum (001)

```sql
user_role       = teacher | director | ugel
artifact_type   = DAILY_SESSION | MONTHLY_UNIT | BIMONTHLY_GRADES | ANNUAL_GRADE_SUMMARY
artifact_status = PROCESSING | APPROVED | NEEDS_REVISION | MANUAL_REVIEW | PROCESSING_ERROR
alert_severity  = LOW | MEDIUM | HIGH | CRITICAL
alert_status    = NEW | UNDER_REVIEW | DISMISSED | ESCALATED | RESOLVED
```

### Esquema núcleo (001, ampliado por 003/005/006)

| Tabla | Columnas clave | Notas |
|---|---|---|
| `institutions` | `code` (unique), `name` | Colegios. |
| `profiles` | `id`→auth.users, `full_name`, `role`, `institution_id`, `dni`→ugel06_profesor *(005)* | Perfil de usuario. |
| `subjects` | `institution_id`, `name` | Cursos por institución. |
| `student_groups` | `institution_id`, `grade`, `name` | Secciones (p. ej. 4°A). |
| `class_schedules` | `teacher_id`, `subject_id`, `group_id`, `weekday` (0=dom), `start_time`, `end_time` | Horario de clases; no restringe la subida de sesiones. |
| `artifacts` | `teacher_id`, `institution_id`, `subject_id`, `group_id`, `type`, `status`, `current_version`, `name` *(003)*, `unit_id`→artifacts *(003)* | Evidencia; `unit_id` es auto-referencia (sesión→unidad). |
| `artifact_versions` | `artifact_id`, `version`, `original_filename`, `storage_path`, `sha256`, `markdown`, `status`, `is_valid` *(006)*, `invalid_reason` *(006)*; `unique(artifact_id, version)` | Versión inmutable. |
| `evaluations` | `artifact_version_id`, `model_name`, `prompt_version`, `rubric_version`, `decision`, `overall_score` (0–100), `confidence`, `summary`, `strengths/improvements/criteria/critical_flags` (jsonb) | Salida de IA persistida. |
| `grade_records` | `group_id`, `period`, `student_code`, `score` | Notas por grupo. |
| `alerts` | `institution_id`, `type`, `severity`, `status`, `title`, `summary`, `suggested_action`, `evidence` (jsonb), `history` (jsonb) | Alertas director/UGEL. |
| `audit_logs` | `actor_id`, `action`, `entity_type`, `entity_id`, `metadata` (jsonb) | Auditoría; **sin políticas RLS** (solo service role). |
| `unit_groups` *(003)* | PK `(unit_id, group_id)`, ambos FK con `ON DELETE CASCADE` | Unidad ↔ grupos que cubre. |
| `artifact_contexts` *(006)* | `artifact_id`, `context` (jsonb) | Contexto de contenido extraído por IA (área, temas, periodo). Visible solo a director/UGEL. |

### Subsistema UGEL 06 (002/004)

Catálogo y hechos del diagnóstico (todos con RLS `SELECT using(true)` para
autenticados):

```
ugel06_ugel ─< ugel06_red_educativa ─< ugel06_colegio ─< ugel06_seccion ─< ugel06_evaluacion_diagnostica
                                                              │                     │ c1..c4, overall_grade
ugel06_profesor ──(dni)── ugel06_seccion.professor_dni        │                     └─▶ ugel06_escala_logro (C/B/A/AD → 1..4)
ugel06_curso ──────────── (course_key en profesor/seccion)    │
ugel06_profesor_contexto (004) ── dni, school_key ────────────┘  (contexto sociodemográfico)
```

**Vistas de agregación**:
- `ugel06_mapa_colegio_curso` (002): grano colegio × curso → `total`, `critico` (C), `intermedio` (B), `logrado` (A+AD), `promedio`. Alimenta el mapa.
- `ugel06_profesor_resumen` (004): grano profesor → datos demográficos + agregados de logro de sus estudiantes. Alimenta las tarjetas de profesor de UGEL.

### Escala de logro

`C=1` (En inicio), `B=2` (En proceso), `A=3` (Logrado), `AD=4` (Logrado destacado).
Buckets de color: **crítico** = {C}, **intermedio** = {B}, **logrado** = {A, AD}.

## 4. Seguridad y RLS

**Autenticación**: JWT de Supabase Auth. La web adjunta `Authorization: Bearer
<access_token>` a cada llamada a la API; el backend resuelve el perfil en
[middleware/auth.ts](../api/src/middleware/auth.ts) (`db.auth.getUser(token)` →
tabla `profiles`).

**RLS**: la web usa la *anon key*, así que **toda** lectura pasa por políticas
de Postgres. Dos funciones `security definer` son el eje:

```sql
my_role()        → select role from profiles where id = auth.uid()
my_institution() → select institution_id from profiles where id = auth.uid()
```

Patrón de visibilidad general (SELECT):

- **teacher**: solo sus propias filas (`teacher_id = auth.uid()`).
- **director**: todo lo de su institución (`institution_id = my_institution()`).
- **ugel**: todo, sin restricción de institución.

Casos particulares:
- `artifact_versions` / `evaluations` / `unit_groups` heredan visibilidad del `artifact` padre vía `EXISTS`.
- `artifact_contexts`: **solo director/UGEL** — el docente dueño **no** ve el contexto de IA de su propia evidencia (evita que ajuste el documento para forzar coherencia).
- `alerts`: SELECT + UPDATE para director (su institución) y UGEL.
- `audit_logs`: sin políticas → inaccesible con anon key; solo el service role (backend) escribe/lee.
- Catálogos `ugel06_*`: lectura abierta a cualquier autenticado.

**Auditoría por trigger**: cada UPDATE en `alerts` dispara `log_alert_change()`,
que inserta en `audit_logs` `{action: 'ALERT_STATUS_CHANGE', metadata: {from, to}}`
con `actor_id = auth.uid()`. El backend además audita explícitamente acciones de
escritura (subidas, horarios, enlaces) vía el helper `audit()` de
[infra/supabase.ts](../api/src/infra/supabase.ts) (fire-and-forget).

## 5. Backend (API Express)

Bootstrap en [server.ts](../api/src/server.ts): `cors()` (abierto), monta el
router en `/api`, health en `/health`. Rutas montadas en
[routes/index.ts](../api/src/routes/index.ts) bajo `/api/v1`.

### Endpoints

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| `POST` | `/api/v1/artifacts` | teacher | Crea evidencia + versión 1. Multipart `file` + `type`, `subject_id`, `group_id`, `unit_id?`, `group_ids?`, `name?`. Dispara el pipeline. |
| `POST` | `/api/v1/artifacts/:id/versions` | teacher | Sube una corrección (nueva versión). Rechaza si el artifact ya está `APPROVED`. Pasa la evaluación previa como contexto. |
| `GET` | `/api/v1/artifacts/versions/:versionId/file` | teacher/director/ugel | Devuelve signed URL (TTL 300 s) del archivo original. Control de acceso por rol/institución/propiedad. |
| `GET` | `/api/v1/mapa?course=` | ugel | Agregado del mapa (colegios + distritos) desde `ugel06_mapa_colegio_curso`. |
| `GET` | `/api/v1/profesores?course=&limit=` | ugel | Tarjetas de profesor desde `ugel06_profesor_resumen`. |
| `GET` | `/api/v1/horarios` | director | Panel de horarios de la institución (docentes, cursos, grupos, profesores UGEL). |
| `POST` | `/api/v1/horarios` | director | Crea horario en `class_schedules` (valida pertenencia, weekday 0–6, HH:MM, start<end). |
| `POST` | `/api/v1/horarios/link` | director | Enlaza/desenlaza un docente con un profesor UGEL 06 por DNI. |
| `DELETE` | `/api/v1/horarios/:id` | director | Borra un horario de la institución. |

`createArtifact` ([artifacts.controller.ts](../api/src/controllers/artifacts.controller.ts))
valida para `DAILY_SESSION` que la unidad vinculada pertenezca al docente.
La sesión puede subirse en cualquier momento; el horario de clases no bloquea
la entrega.

### Respuesta del pipeline

```jsonc
{
  "artifact_id": "uuid",
  "version": 1,
  "status": "APPROVED | NEEDS_REVISION | MANUAL_REVIEW | PROCESSING_ERROR",
  "is_valid": true,
  "invalid_reason": null,
  "evaluation": { /* fila de evaluations */ }
}
```

### Servicios de datos UGEL

- [mapa.service.ts](../api/src/services/mapa.service.ts): lee la vista, agrupa por colegio (con `distribution`, `dominant`, `average_score_1_to_4`, desglose por curso) y hace roll-up por distrito.
- [profesores.service.ts](../api/src/services/profesores.service.ts): mapea el resumen a tarjetas con `pct_logrado`, `distribution` y `contexto` sociodemográfico; ordena por promedio.
- [horarios.service.ts](../api/src/services/horarios.service.ts): panel + CRUD de `class_schedules` + `linkProfesor` (setea `profiles.dni`).

## 6. El pipeline de evaluación

Función `processUpload()` en
[artifact.service.ts](../api/src/services/artifact.service.ts) — flujo **síncrono
por request**, sin cola ni worker:

```
1. sha256(buffer)  → path = {artifact.id}/v{version}/{ts}-{filename}
2. Storage.upload('evidence', path)               ── si falla: throw
3. insert artifact_versions {filename, path, sha256}
4. markdown = toMarkdown(buffer)                   ── markitdown (Python)
   ├─ si markdown.trim().length < 50:
   │    legible=false, evaluation = stub MANUAL_REVIEW (flag EMPTY_DOCUMENT)
   └─ si legible:
        evaluation = evaluate(markdown, {type, subject, grade, previous})
   (error de conversión/eval → version+artifact = PROCESSING_ERROR, throw)
5. si es sesión: se pasa el contexto de su unidad al evaluador
6. isValid = legible && decision == APPROVED && score >= 75
7. si legible: se guarda el contexto incluido en la misma respuesta de evaluate
   (fallo al guardarlo es best-effort: se loguea, NO tumba la subida)
8. update artifact_versions {status, markdown, is_valid, invalid_reason}
   update artifacts {status, current_version, updated_at}
   insert evaluations {model_name, prompt_version, rubric_version, ...}
   upsert artifact_contexts {artifact_id, context}
   audit('ARTIFACT_EVALUATED')
9. return { artifact_id, version, status, is_valid, invalid_reason, evaluation }
```

Puntos importantes:
- **El archivo nunca se pierde**: incluso ilegible o con error de análisis de contexto, la versión queda registrada y el documento en Storage.
- **Una sola regla de validez**: una evaluación legible con al menos 18/24 puntos (75/100). La coherencia de una sesión con su unidad integra el criterio 3 de la rúbrica; no funciona como veto independiente.
- **Reenvío**: `createArtifactVersion` incrementa la versión y pasa el resumen/mejoras/score de la evaluación anterior al prompt, para que la IA compare progreso.

## 7. Capa de IA (Gemini)

Carpeta [api/src/services/analysis/](../api/src/services/analysis/). Cliente de
bajo nivel [gemini.client.ts](../api/src/services/analysis/gemini.client.ts):

```
POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}
→ parse candidates[0].content.parts[0].text  (JSON forzado por responseSchema)
```

El pipeline de análisis hace **una llamada a Gemini** por documento legible en condiciones normales. La respuesta reúne extracción, valoración y contexto. Si el modelo principal devuelve 429 o 503, se prueba el modelo de respaldo; los 503 pueden generar reintentos.

### 7.1 Extracción (en la respuesta de `evaluate`)
Identifica qué documentos están presentes (insumos, planificación anual, unidad,
sesión, instrumentos) y extrae datos de identificación (IE, docente, área, grado,
competencia…) + flag `legible`. Markdown truncado a 60k chars. Schema validado
con Zod (`ExtractionSchema`).

### 7.2 Evaluación (`evaluate`)
El system prompt vigente es `api/config/prompts/planificacion-4primaria.v1.md`
(`PROMPT_VERSION = v4`, `RUBRIC_VERSION = planificacion-4primaria.v1`).
La **rúbrica propia de Kipu** tiene ocho criterios generales basados en el CNEB,
el Programa Curricular de Educación Primaria y los elementos generales del Oficio
Múltiple N.º 00038-2026 de la UGEL 06. Sirve solo para unidades y sesiones de
4.º de primaria en Comunicación y Matemática. El ítem específico de prevención
ante emergencias/desastres no se puntúa.

Gemini asigna de 0 a 3 puntos a cada criterio con evidencia y recomendación. Un
criterio sin evidencia recibe 0 y sigue en el denominador. El servidor valida
que aparezcan los ocho criterios exactamente una vez y calcula:

```
puntaje_total = suma(ocho puntajes)              (0–24)
overall_score = redondear(puntaje_total / 24 × 100)
decision      = puntaje_total >= 18 → APPROVED ; else NEEDS_REVISION
```

La confianza queda registrada como dato informativo; no cambia la decisión de
una evaluación completada. Un documento ilegible queda en `MANUAL_REVIEW` y se
muestra sin nota, aunque la columna numérica existente almacene 0 como centinela.

Devuelve `{ decision, confidence, summary, overall_score, strengths[],
improvements[], criteria (la ficha completa), criticalFlags[] }`.

### 7.3 Contexto (en la respuesta de `evaluate`)
- La misma respuesta resume **de qué trata realmente el contenido** (área, título, resumen 2–4 frases, temas, grado, periodo) y se guarda en `artifact_contexts` sin otra llamada a Gemini.
- El contexto guardado de la unidad se proporciona al evaluador de una sesión para valorar su coherencia dentro del criterio 3. Ya no hay una llamada posterior que invalide por separado la sesión.

La rúbrica (ocho criterios, escala, umbral y schemas Zod) vive en
[rubric.ts](../api/src/services/analysis/rubric.ts).

## 8. Frontend (React SPA)

### 8.1 Arranque y enrutamiento
[main.tsx](../web/src/main.tsx) → [App.tsx](../web/src/App.tsx): `QueryClient`
(`retry:1`, `refetchOnWindowFocus:false`) → `ProfileProvider` → `BrowserRouter` →
`Shell`. [useAuth](../web/src/hooks/useAuth.ts) resuelve el estado de sesión:

- `loading` → "Cargando…"
- autenticado sin fila en `profiles` → [SessionError](../web/src/pages/SessionError.tsx)
- sin sesión → [Login](../web/src/pages/Login.tsx)
- con perfil → árbol enrutado, protegido por `guard(role, allowed, element)` que redirige al `HOME` del rol.

Rutas: `/profesor/{calendario,subir,unidades,entregas}`,
`/director{,/entregas,/contextos,/horarios,/alertas}`, `/ugel{,/mapa}`.

### 8.2 Capa de servicios
Regla: **ninguna página/hook toca Supabase o `fetch` directo** — todo pasa por
[services/api.ts](../web/src/services/api.ts), fachada con cinco módulos:

| Módulo | Vía | Qué expone |
|---|---|---|
| `api.llm` | API (multipart) | `evaluateArtifact(form)`, `reevaluateVersion(id, form)` |
| `api.db` | Supabase directo | ~15 lecturas/escrituras tipadas por rol (artifacts, alerts, grades, institutions…) |
| `api.map` | API | `mapa(course?)`, `profesores(course?, limit?)` |
| `api.horarios` | API | `panel()`, `create()`, `remove(id)`, `link(teacher, dni)` |
| `api.files` | API | `artifactVersionUrl(versionId)` |

[http.ts](../web/src/services/http.ts) inyecta el `Bearer` token de la sesión
Supabase en cada request a `VITE_API_BASE_URL`.
[supabase.ts](../web/src/services/supabase.ts) crea el cliente con la *anon key*.

### 8.3 Hooks (TanStack Query)
Query keys centralizadas en [keys.ts](../web/src/hooks/keys.ts). Grupos:
- [useArtifacts](../web/src/hooks/useArtifacts.ts): `useTeacherArtifacts`, `useArtifactTypes`, `useTeacherUnits`, `useArtifactFile` (staleTime 4 min, lazy), y la mutación `useSubmitArtifact` (decide crear vs. reenviar; invalida artifacts/types/units).
- [useDashboards](../web/src/hooks/useDashboards.ts): `useDirectorPanel`, `useDirectorArtifacts`, `useDirectorContexts`, `useMapa`, `useProfesores`, `useUgelData` (varias con `Promise.all`).
- [useAlerts](../web/src/hooks/useAlerts.ts): lectura + `useUpdateAlertStatus` (máquina `NEW→UNDER_REVIEW→RESOLVED`).
- [useHorarios](../web/src/hooks/useHorarios.ts) y [useSchedules](../web/src/hooks/useSchedules.ts): CRUD de horarios y filtrado por curso/grado permitidos (`Matemática`/`Comunicación`, `4to`).

### 8.4 Factories
[factories/](../web/src/factories/) traducen filas de DB a modelos de vista sin
lógica de red:
- `artifact.factory`: `latestVersion/latestEvaluation/previousEvaluation`, `unitsWithSessions` (agrupa sesiones bajo su unidad), `countByStatus`, `isValid/invalidReason`.
- `dashboard.factory`: `progressByTeacher`, `metricsByInstitution`, `lowGradeGroups`.
- `evaluation.factory`: `getFicha` vs `getLegacyCriteria` (soporta el formato nuevo de ficha y el legacy de criterios), `scoreDelta`, `fichaItemsByDimension`.
- `alert.factory`: `activeAlerts`, `newCount`, `isClosed`.

### 8.5 Páginas por rol
- **Docente**: `TeacherCalendar` (calendario pedagógico 2026 con entregas requeridas y su estado), `TeacherUpload` (formulario drag-and-drop con validación de clase/unidad/archivo), `TeacherArtifacts` (historial + versiones + reenvío), `TeacherUnits` (unidades con sus sesiones y PDFs).
- **Director**: `DirectorPanel` (KPIs + avance por docente), `DirectorArtifacts` (tabla filtrable + visor PDF lazy + export XLSX vía `xlsx`), `DirectorAlerts` (máquina de estados), `DirectorHorarios` (CRUD + enlace UGEL), `DirectorContexts` (contexto de contenido IA de unidades/sesiones).
- **UGEL**: `Ugel` (KPIs agregados + barras Recharts por institución + grupos con notas bajas + alertas), `MapaDiagnostico` (mapa Leaflet con círculos por colegio y tarjetas de profesor).

### 8.6 Componentes y tipos
UI propia mínima en [components/](../web/src/components/) (`Shell`, `Sidebar`,
`Table`, `Badge`, `Stat`, `Section`, `Modal`, `Spinner`, `ArtifactPdf` con carga
lazy de la signed URL, `EvaluationView`/`EvaluationAnnotations` para renderizar la
ficha). Tipos de dominio en [types/index.ts](../web/src/types/index.ts); enums →
etiquetas y estilos en `config/labels.ts`; constantes (rutas HOME, filtros,
máquinas de estado, cursos/grados permitidos) en `config/constants.ts`.

## 9. Flujos end-to-end

**Login** → `auth.signIn` → `useAuth` carga `profiles` → `ProfileProvider` →
Shell del rol. Sin fila de perfil → `SessionError` (cierra sesión y reintenta).

**Subida de sesión** (docente):
1. `TeacherUpload`: elige tipo + unidad vinculada + archivo; valida en cliente.
2. `useSubmitArtifact` → `api.llm.evaluateArtifact(FormData)` → `POST /api/v1/artifacts` con Bearer.
3. Backend valida el enlace a una unidad del docente → `processUpload` (§6).
4. Respuesta con score + validez → invalida queries → UI refresca. Si no válida, muestra `invalid_reason`.

**Reenvío/corrección**: desde una entrega `NEEDS_REVISION` → `reevaluateVersion`
→ nueva versión que compara contra la anterior. Al llegar a `APPROVED` se bloquean
nuevos reenvíos.

**Gestión de alerta** (director/UGEL): cambio de estado → UPDATE en `alerts` →
trigger escribe en `audit_logs` con `{from, to}` y actor.

## 10. Configuración y despliegue

### Variables de entorno (API — [config/env.ts](../api/src/config/env.ts))

| Var | Default | Rol |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | — (obligatorias) | Cliente service-role. |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | — / `gemini-3.8-flash` / `gemini-3.6-flash` | IA; respaldo ante saturación 503 o cuota 429 del modelo principal. |
| `MAX_UPLOAD_SIZE_MB` | `15` | Límite de multer. |
| `PORT` | `3001` | Puerto de la API. |
| `SUPABASE_DB_URL` | — | Cadena Postgres (Session pooler) para el script de migración. |

Constantes fijas en código: `VALID_SCORE_MIN=75`, `PROMPT_VERSION='v3'`, `RUBRIC_VERSION='planificacion-4primaria.v1'`, `ALLOWED` = `.pdf/.pptx/.xlsx`.

### Variables (Web)
`VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

### Desarrollo local
```bash
# migración base + seed (una vez)
psql "host=aws-1-us-west-2.pooler.supabase.com port=6543 \
  user=postgres.yoylrbqqxumdgvgdtviw dbname=postgres sslmode=require" \
  -f supabase/migrations/001_init.sql
cd api && npm run db:seed

# API (requiere: pip install 'markitdown[pdf,pptx,xlsx]')
cd api && npm i && npm run dev        # :3001

# Web
cd web && npm i && npm run dev        # :5173
```

### Despliegue
Web → **Vercel**; API → **Railway** (imagen con Python + `markitdown`);
DB/Auth/Storage → **Supabase**. La API corre con `tsx` (sin paso de build).

## 11. Scripts de datos

En `api/scripts/` (invocables por npm, cargan `.env`):

| Script | Comando | Qué hace |
|---|---|---|
| `seed.mjs` | `npm run db:seed` | Demo idempotente: limpia, siembra 2 IIEE, 7 usuarios (`*@kipu.demo`, pass `KipuDemo2026!`), cursos, grupos, horarios amplios, historial de entregas, notas, 2 alertas y el bucket `evidence`. |
| `poblacion.mjs` | `npm run db:poblacion` | Carga el diagnóstico UGEL 06 desde `scripts/data/*.json` (60 rúbricas, 1500 evaluaciones, contexto de 30 profesores) respetando el orden de FKs; siembra coordenadas por centroide de distrito + jitter determinista. |
| `add-user.mjs` | `npm run db:add-user` | Alta/upsert rápida de usuarios demo. |
| `apply-migration.mjs` | `npm run db:migrate -- <archivo.sql>` | Aplica un `.sql` en transacción vía `SUPABASE_DB_URL` (Session pooler). |

## 12. Límites y deuda técnica

Recortes deliberados de hackathon:

- **Sin tests automatizados** (decisión de tiempo); verificado end-to-end contra servicios reales.
- **Pipeline síncrono**: sin reintentos, sin backpressure, sensible a picos; un request lento ocupa su conexión ~30 s.
- **`cors()` abierto** sin restricción de origen en [server.ts](../api/src/server.ts).
- **Key de Gemini como query param** en [gemini.client.ts](../api/src/services/analysis/gemini.client.ts) → riesgo de fuga en logs de red.
- **Dependencia de subproceso Python** (`markitdown`) acopla el runtime de la API y su despliegue.
- **Acoplamiento a Gemini** y a su formato `responseSchema`.
- Escrituras de dominio (crear artifact, horarios) se apoyan en el service role del backend, no en RLS de `INSERT/UPDATE` (que no está definida para esas tablas).
