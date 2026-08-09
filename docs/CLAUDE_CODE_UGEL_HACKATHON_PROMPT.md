# Prompt maestro para Claude Code — Plataforma de auditoría pedagógica UGEL

## Rol de Claude Code

Actúa como **arquitecto de software senior, desarrollador full-stack y responsable de calidad** para construir un MVP funcional de una plataforma de auditoría pedagógica para una hackathon de UGEL.

Debes analizar el repositorio existente antes de modificarlo. Si el repositorio está vacío, crea la estructura inicial completa. Implementa de forma incremental, documentada y verificable.

No inventes requisitos fuera de este documento. Cuando exista una decisión técnica menor no especificada, elige la alternativa más simple, segura y adecuada para una hackathon.

---

# 1. Problema que debe resolver la plataforma

UGEL realiza capacitaciones dirigidas a directores y docentes, pero actualmente no existe una forma efectiva de comprobar si esas capacitaciones están siendo aplicadas en la planificación pedagógica ni si las instituciones presentan patrones que requieran intervención.

Los docentes deben presentar evidencias en distintos periodos:

1. **Planificación diaria:** sesiones de clase.
2. **Planificación mensual:** unidades de aprendizaje.
3. **Evaluación bimestral:** registro de notas.
4. **Evaluación anual:** balance general de calificaciones.

La plataforma debe centralizar estas evidencias, validarlas mediante inteligencia artificial, mantener trazabilidad de las versiones y analizar patrones para identificar situaciones preocupantes.

El propósito no es sancionar automáticamente al docente, sino:

- Verificar que los materiales cumplan criterios pedagógicos.
- Dar retroalimentación concreta al profesor.
- Facilitar la supervisión del director.
- Detectar patrones relevantes para UGEL.
- Sugerir cuándo UGEL debería evaluar o intervenir.

---

# 2. Objetivo del MVP

Construir un sistema web multiusuario y jerárquico que permita:

- Autenticación y autorización por roles.
- Subida de archivos PDF, PPTX y XLSX.
- Procesamiento de documentos mediante `microsoft/markitdown`.
- Evaluación de contenido con Gemini API.
- Retroalimentación específica para el profesor.
- Versionamiento inmutable de entregas.
- Supervisión por parte del director.
- Dashboards con métricas para UGEL.
- Generación automática de alertas por patrones preocupantes.
- Descarga de archivos y exportación de registros en Excel.
- Trazabilidad completa mediante logs de auditoría.

---

# 3. Stack tecnológico obligatorio

## Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Librería de componentes accesibles, preferiblemente shadcn/ui o Radix UI
- Librería de gráficos, preferiblemente Recharts
- Zod para validaciones
- Supabase JS Client

El frontend será desplegado en **Vercel**.

## Backend

- Node.js
- Express
- TypeScript
- Zod
- Supabase Admin Client
- Gemini API
- Sistema de logging estructurado
- OpenAPI o documentación equivalente para los endpoints

El backend será desplegado en **Railway**.

## Procesamiento documental

- Python
- `microsoft/markitdown`
- Servicio o worker ejecutado en Railway
- Comunicación con el backend mediante cola basada en base de datos o endpoints internos seguros

## Infraestructura y servicios

- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Supabase Row Level Security
- Vercel para frontend
- Railway para backend y worker
- Gemini API como motor de evaluación

---

# 4. Restricciones funcionales importantes

1. **Los usuarios no crean ni editan capacitaciones desde la plataforma.**
2. **Los usuarios no crean ni editan criterios o rúbricas desde la plataforma.**
3. Los criterios pedagógicos serán insertados por el equipo desarrollador mediante:
   - migraciones,
   - seeds,
   - scripts internos,
   - archivos JSON versionados.
4. El especialista UGEL es un consumidor de datos, no un administrador de capacitaciones.
5. La IA debe entregar retroalimentación comprensible al profesor.
6. Una entrega enviada no debe editarse directamente.
7. Toda corrección genera una nueva versión.
8. Las alertas no deben convertirse automáticamente en sanciones.
9. Las decisiones delicadas deben quedar bajo revisión humana.
10. Por defecto, UGEL debe visualizar datos agregados antes que información personal de estudiantes.

---

# 5. Roles del sistema

## 5.1 Profesor

Puede:

- Ver sus cursos asignados.
- Ver sus horarios.
- Ver sus unidades.
- Ver sus sesiones.
- Ver los registros de notas asociados a sus grupos.
- Ver las entregas realizadas.
- Subir archivos PDF, PPTX o XLSX.
- Recibir el resultado de la evaluación automática.
- Consultar el puntaje total y por criterio.
- Consultar comentarios de mejora.
- Subir una nueva versión cuando la entrega requiera corrección o cuando tenga autorización.
- Consultar el historial de versiones.

No puede:

- Editar una entrega ya enviada.
- Eliminar una entrega.
- Reemplazar silenciosamente un archivo.
- Ver materiales de otros profesores.
- Modificar criterios.
- Aprobar su propio material.
- Consultar información de otras instituciones.

## 5.2 Director o administrador local

Puede:

- Ver profesores de su institución.
- Ver grupos, cursos y horarios de su institución.
- Ver entregas pendientes, procesadas, aprobadas, observadas o rechazadas.
- Descargar archivos de su institución.
- Descargar registros y reportes en Excel.
- Consultar resultados por profesor, curso, grado, grupo y periodo.
- Revisar casos enviados a revisión manual.
- Registrar observaciones.
- Autorizar una nueva versión si la entrega está bloqueada.
- Consultar alertas de su institución.
- Marcar una alerta como revisada.
- Registrar una acción tomada.

No puede:

- Ver instituciones ajenas.
- Modificar criterios pedagógicos.
- Alterar el resultado histórico de una evaluación.
- Eliminar evidencia.
- Editar el contenido del profesor.

## 5.3 Especialista UGEL / SuperAdmin auditor

Su función principal es revisar permanentemente el análisis de datos y decidir qué acciones deberían evaluarse.

Puede:

- Consultar métricas agregadas de instituciones.
- Ver alertas automáticas.
- Ver tendencias por institución, curso, grado, periodo y criterio.
- Ver outliers.
- Ver grupos de estudiantes con calificaciones preocupantes.
- Ver agrupaciones de profesores con entregas inválidas consecutivas.
- Profundizar en un caso cuando exista una alerta o justificación.
- Registrar comentarios, observaciones y acciones sugeridas.
- Marcar una alerta como:
  - nueva,
  - en revisión,
  - descartada,
  - escalada,
  - resuelta.
- Descargar reportes agregados.

No puede:

- Crear capacitaciones.
- Editar capacitaciones.
- Crear criterios.
- Editar criterios.
- Modificar entregas.
- Cambiar resultados históricos de IA.
- Sancionar automáticamente desde la plataforma.

## 5.4 Developer / System

No es un rol expuesto en la interfaz principal.

Responsabilidades:

- Insertar y versionar criterios pedagógicos.
- Insertar rúbricas.
- Configurar reglas de evaluación.
- Configurar reglas de alertas.
- Administrar seeds y migraciones.
- Mantener variables de entorno.
- Gestionar integraciones técnicas.

---

# 6. Módulos principales

## 6.1 Autenticación

Implementar autenticación mediante Supabase Auth.

Flujos:

- Inicio de sesión.
- Recuperación de contraseña.
- Cierre de sesión.
- Persistencia de sesión.
- Redirección según rol.
- Protección de rutas.
- Protección de endpoints backend.

Los roles deben almacenarse en la base de datos y no depender exclusivamente de metadata editable por el cliente.

---

## 6.2 Gestión de estructura educativa

Entidades mínimas:

- UGEL
- Institución educativa
- Usuario
- Perfil
- Membresía
- Profesor
- Director
- Especialista UGEL
- Año académico
- Periodo
- Grado
- Sección
- Grupo
- Curso
- Competencia
- Asignación docente
- Horario

Debe existir una relación clara:

```text
UGEL
└── Instituciones
    └── Grupos
        └── Cursos
            └── Profesor asignado
```

---

## 6.3 Gestión de evidencia pedagógica

Tipos de evidencia:

```text
DAILY_SESSION
MONTHLY_UNIT
BIMONTHLY_GRADES
ANNUAL_GRADE_SUMMARY
```

Estados principales:

```text
DRAFT
UPLOADING
UPLOADED
PROCESSING
EVALUATING
APPROVED
NEEDS_REVISION
MANUAL_REVIEW
PROCESSING_ERROR
ARCHIVED
```

Reglas:

- La versión subida queda congelada.
- La aplicación nunca reemplaza físicamente una versión previa.
- Cada reenvío crea una nueva versión.
- Cada versión mantiene:
  - usuario,
  - fecha,
  - archivo,
  - hash,
  - estado,
  - evaluación,
  - criterios utilizados,
  - modelo utilizado,
  - prompt version,
  - resultado.
- No permitir eliminación desde la interfaz.
- Las descargas deben usar URLs firmadas de corta duración.

---

# 7. Regla especial para sesiones de clase

Las sesiones diarias solo deben poder subirse dentro de una ventana relacionada con el horario de clase.

Para el MVP usar una configuración como:

```text
Desde 30 minutos antes del inicio de la clase
hasta el final del horario de clase.
```

Esta ventana debe ser configurable desde variables o tabla interna.

Validaciones:

- El profesor debe estar asignado al curso.
- La sesión debe corresponder al grupo.
- Debe existir horario para ese día.
- La fecha debe coincidir con el calendario.
- El backend debe validar la hora; no confiar únicamente en el frontend.
- Registrar intentos fuera de horario en auditoría.
- Mostrar un mensaje claro al profesor cuando no pueda subir el archivo.

No presentar esta regla como una prueba absoluta de que la sesión fue aplicada, sino como evidencia temporal.

---

# 8. Procesamiento documental con MarkItDown

Crear un worker de Python desplegado en Railway.

Flujo:

1. Recibir un job pendiente.
2. Descargar el archivo desde Supabase Storage.
3. Validar:
   - extensión,
   - MIME type,
   - tamaño,
   - hash.
4. Convertir el documento a Markdown con `microsoft/markitdown`.
5. Extraer:
   - títulos,
   - tablas,
   - texto,
   - estructura,
   - hojas relevantes en Excel,
   - diapositivas en PowerPoint.
6. Limpiar texto.
7. Detectar contenido vacío o ilegible.
8. Enmascarar información personal innecesaria.
9. Guardar:
   - Markdown extraído,
   - metadatos,
   - estado,
   - errores.
10. Marcar el job como listo para evaluación.
11. Disparar la evaluación con Gemini o dejarlo para un segundo job.

Tipos admitidos en el MVP:

- `.pdf`
- `.pptx`
- `.xlsx`

Configurar límite de tamaño, por ejemplo 15 MB.

No ejecutar archivos ni macros.

---

# 9. Evaluación con Gemini API

## 9.1 Objetivo

Evaluar cada documento contra criterios pedagógicos previamente cargados por el developer.

La IA debe:

- Identificar evidencia.
- Puntuar por criterio.
- Explicar faltas.
- Dar retroalimentación accionable.
- Indicar nivel de confianza.
- Recomendar aprobación, corrección o revisión manual.

## 9.2 Entrada mínima

Enviar a Gemini:

- Tipo de documento.
- Curso.
- Grado.
- Competencias.
- Contexto curricular.
- Criterios aplicables.
- Ponderaciones.
- Reglas críticas.
- Markdown extraído.
- Metadatos necesarios.
- Evaluación anterior si es una corrección.
- Versión del prompt.

## 9.3 Salida obligatoriamente estructurada

Usar una respuesta JSON validada con Zod.

Ejemplo:

```json
{
  "decision": "NEEDS_REVISION",
  "overall_score": 68,
  "confidence": 0.91,
  "summary": "La sesión está correctamente estructurada, pero no demuestra la estrategia de retroalimentación esperada.",
  "strengths": [
    "La competencia está identificada.",
    "La secuencia didáctica es coherente."
  ],
  "improvements": [
    "Incluir una estrategia explícita de retroalimentación.",
    "Relacionar las evidencias con el criterio de evaluación."
  ],
  "criteria": [
    {
      "criterionCode": "SESSION_COMPETENCY_ALIGNMENT",
      "criterionName": "Alineación con competencia",
      "score": 18,
      "maxScore": 20,
      "status": "PASS",
      "confidence": 0.95,
      "evidence": [
        {
          "quote": "Se desarrollará la competencia...",
          "location": "Sección: Propósito"
        }
      ],
      "feedback": "La competencia y la capacidad están correctamente indicadas."
    },
    {
      "criterionCode": "FORMATIVE_FEEDBACK",
      "criterionName": "Retroalimentación formativa",
      "score": 6,
      "maxScore": 20,
      "status": "FAIL",
      "confidence": 0.9,
      "evidence": [],
      "feedback": "No se identifica una estrategia concreta para retroalimentar al estudiante."
    }
  ],
  "criticalFlags": [
    "MISSING_FORMATIVE_FEEDBACK"
  ],
  "requiresHumanReview": false
}
```

## 9.4 Reglas de decisión

Configurar umbrales internamente.

Ejemplo inicial:

```text
APPROVED:
score >= 80
sin criterio crítico fallido
confidence >= 0.75

NEEDS_REVISION:
score < 80
o existe criterio crítico fallido
confidence >= 0.75

MANUAL_REVIEW:
confidence < 0.75
documento ilegible
resultado contradictorio
información insuficiente
posible error de extracción
```

No codificar reglas sensibles directamente en componentes visuales. Mantenerlas en configuración del backend.

## 9.5 Retroalimentación al profesor

La vista del profesor debe mostrar:

- Puntaje total.
- Estado.
- Resumen.
- Fortalezas.
- Aspectos por mejorar.
- Resultado por criterio.
- Evidencias encontradas.
- Criterios no encontrados.
- Instrucciones concretas para corregir.
- Comparación con la versión anterior.

La retroalimentación debe ser:

- pedagógica,
- clara,
- respetuosa,
- específica,
- no punitiva.

---

# 10. Criterios pedagógicos gestionados por developer

Crear una estrategia de configuración versionada.

Opción recomendada:

```text
/config/rubrics/
  daily-session.v1.json
  monthly-unit.v1.json
  bimonthly-grades.v1.json
  annual-summary.v1.json
```

Cada criterio debe incluir:

```json
{
  "code": "FORMATIVE_FEEDBACK",
  "name": "Retroalimentación formativa",
  "description": "La planificación debe incluir una estrategia explícita de retroalimentación.",
  "weight": 20,
  "critical": true,
  "applicableArtifactTypes": ["DAILY_SESSION"],
  "version": 1
}
```

Crear scripts para:

- insertar criterios,
- actualizar versiones,
- mantener historial,
- vincular criterios con tipos de evidencia,
- evitar modificaciones destructivas.

Las evaluaciones históricas deben mantener la versión exacta de la rúbrica utilizada.

---

# 11. Sistema de alertas

## 11.1 Objetivo

Detectar patrones que merezcan revisión de UGEL.

Las alertas no deben sancionar automáticamente. Deben indicar:

- qué ocurrió,
- por qué es relevante,
- datos que lo sustentan,
- nivel de severidad,
- acción sugerida.

## 11.2 Tipos mínimos de alerta

### A. Grupo de alumnos con calificaciones muy bajas

Ejemplo:

- Un porcentaje alto de estudiantes del mismo grupo está por debajo del nivel esperado.
- La tendencia se mantiene en más de un periodo.
- El promedio cayó considerablemente.

Variables sugeridas:

- porcentaje de estudiantes bajo umbral,
- promedio del grupo,
- variación frente al periodo anterior,
- número mínimo de estudiantes,
- número de periodos consecutivos.

### B. Profesores con unidades inválidas consecutivas

Ejemplo:

- Tres o más unidades consecutivas con estado `NEEDS_REVISION`.
- Varios profesores de la misma institución fallan en el mismo criterio.
- Un grupo o asociación docente presenta incumplimientos repetidos.

Variables sugeridas:

- número consecutivo de entregas inválidas,
- criterio fallido,
- cantidad de profesores afectados,
- institución,
- curso,
- periodo.

### C. Patrón institucional

Ejemplo:

- Una institución presenta una tasa de invalidez significativamente superior a otras similares.
- Un criterio pedagógico falla en múltiples cursos.
- Existe una caída continua del score promedio.

### D. Discordancia entre planificación y resultados

Ejemplo:

- Los documentos muestran puntajes altos, pero las calificaciones del grupo caen de manera sostenida.
- Las unidades se aprueban, pero existe una concentración de notas bajas.

Presentar esto como una señal para evaluación, no como causalidad demostrada.

### E. Falta de entrega

Ejemplo:

- Sesiones o unidades esperadas no fueron presentadas.
- Se acumulan omisiones en un mismo docente o institución.

---

## 11.3 Severidad

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Ejemplo de regla:

```text
LOW:
evento aislado

MEDIUM:
patrón repetido dos veces

HIGH:
tres o más periodos o múltiples docentes afectados

CRITICAL:
riesgo extendido, fuerte caída o gran proporción de alumnos afectados
```

Los umbrales deben quedar configurables en archivos o tablas internas.

---

## 11.4 Estados de alerta

```text
NEW
UNDER_REVIEW
DISMISSED
ESCALATED
RESOLVED
```

Registrar:

- quién cambió el estado,
- fecha,
- comentario,
- acción sugerida,
- acción tomada.

---

## 11.5 Ejemplo de alerta para UGEL

```json
{
  "type": "REPEATED_INVALID_UNITS",
  "severity": "HIGH",
  "title": "Incumplimiento recurrente en evaluación formativa",
  "summary": "Cinco docentes de la I.E. 2034 presentan tres unidades consecutivas observadas por falta de estrategias de retroalimentación.",
  "affectedInstitutionId": "uuid",
  "affectedTeacherCount": 5,
  "evidence": {
    "invalidSubmissionCount": 17,
    "criterionCode": "FORMATIVE_FEEDBACK",
    "periods": ["2026-B1", "2026-B2"]
  },
  "suggestedAction": "Evaluar acompañamiento pedagógico focalizado y revisar la aplicación de la capacitación relacionada."
}
```

---

# 12. Dashboards

## 12.1 Profesor

Mostrar:

- Próximas entregas.
- Estado de cada entrega.
- Historial de versiones.
- Puntaje por documento.
- Puntaje por criterio.
- Retroalimentación.
- Comparación entre versiones.
- Tendencia personal.
- Botón para resubir cuando corresponda.

## 12.2 Director

Mostrar:

- Total de profesores.
- Entregas esperadas.
- Entregas realizadas.
- Entregas aprobadas.
- Entregas que requieren corrección.
- Casos de revisión manual.
- Profesores con entregas inválidas consecutivas.
- Criterios con mayor incumplimiento.
- Evolución por periodo.
- Alertas de la institución.
- Descarga de Excel.

Filtros:

- periodo,
- grado,
- sección,
- curso,
- profesor,
- tipo de evidencia,
- estado,
- criterio.

## 12.3 UGEL

Mostrar:

- Resumen general.
- Instituciones con scores bajos.
- Instituciones con mayor tasa de entregas inválidas.
- Grupos con calificaciones preocupantes.
- Profesores agrupados por patrones de incumplimiento.
- Alertas nuevas.
- Tendencias.
- Heatmap institución × criterio.
- Comparación por periodo.
- Outliers.
- Acciones sugeridas.
- Estado de revisión de alertas.

Por defecto, mostrar información agregada.

---

# 13. Exportaciones

El director debe poder descargar:

- Entregas por periodo.
- Estados por profesor.
- Puntajes por criterio.
- Historial de versiones.
- Alertas institucionales.
- Resumen de notas agregado.

UGEL debe poder descargar:

- Indicadores agregados.
- Alertas.
- Tendencias.
- Comparaciones institucionales.
- Resultados por criterio.

Formato:

- XLSX
- CSV opcional

Registrar la descarga en auditoría.

---

# 14. Modelo de datos sugerido

Crear migraciones SQL para Supabase.

## Tablas principales

```text
ugels
institutions
profiles
user_roles
institution_memberships

academic_years
academic_periods
grades
sections
student_groups
subjects
competencies
teacher_assignments
class_schedules

artifact_types
artifacts
artifact_versions
artifact_files

rubrics
rubric_versions
rubric_criteria
rubric_version_criteria

document_processing_jobs
document_extractions
evaluation_jobs
evaluations
evaluation_criterion_results

student_grade_imports
student_grade_records
grade_aggregates

alerts
alert_evidence
alert_status_history
alert_actions

resubmission_permissions
director_observations
audit_logs
```

## Campos relevantes

### `artifacts`

```text
id
teacher_id
institution_id
group_id
subject_id
artifact_type
academic_year_id
period_id
scheduled_class_id nullable
status
current_version_number
created_at
updated_at
```

### `artifact_versions`

```text
id
artifact_id
version_number
uploaded_by
file_id
submitted_at
status
previous_version_id nullable
rubric_version_id
locked_at
created_at
```

### `artifact_files`

```text
id
storage_bucket
storage_path
original_filename
mime_type
size_bytes
sha256
created_at
```

### `evaluations`

```text
id
artifact_version_id
provider
model_name
prompt_version
rubric_version_id
decision
overall_score
confidence
summary
strengths jsonb
improvements jsonb
critical_flags jsonb
requires_human_review
raw_response jsonb
created_at
```

### `evaluation_criterion_results`

```text
id
evaluation_id
criterion_id
score
max_score
status
confidence
evidence jsonb
feedback
created_at
```

### `alerts`

```text
id
type
severity
status
ugel_id
institution_id nullable
group_id nullable
teacher_id nullable
title
summary
suggested_action
detected_at
last_evaluated_at
rule_version
created_at
```

---

# 15. RLS y seguridad

Implementar políticas estrictas.

## Profesor

Puede leer:

- su perfil,
- sus asignaciones,
- sus horarios,
- sus grupos,
- sus entregas,
- sus evaluaciones.

Puede insertar:

- entregas propias,
- versiones propias cuando estén permitidas.

No puede:

- actualizar evaluaciones,
- cambiar estados finales,
- leer entregas ajenas.

## Director

Puede leer:

- datos de su institución.

Puede insertar:

- observaciones,
- permisos de resubida,
- acciones sobre alertas.

No puede:

- modificar evaluaciones históricas,
- acceder a instituciones ajenas.

## UGEL

Puede leer:

- datos agregados de instituciones de su UGEL,
- alertas,
- casos detallados autorizados.

Debe evitarse exponer información sensible de estudiantes salvo que sea estrictamente necesaria.

## Backend y worker

Usar Supabase service role únicamente en servidores seguros.

Nunca exponer:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- secretos internos

en el frontend.

---

# 16. Privacidad de estudiantes

Para el MVP:

- Minimizar nombres y documentos de identidad.
- Usar IDs internos.
- No enviar nombres completos a Gemini.
- Enmascarar DNI, correos, teléfonos y otros datos personales.
- Trabajar con notas agregadas cuando sea posible.
- Mostrar a UGEL datos agregados por defecto.
- Registrar accesos a información detallada.
- No usar datos para entrenar modelos propios.
- Incluir aviso de uso de IA.

---

# 17. API backend sugerida

Base:

```text
/api/v1
```

## Auth y perfil

```text
GET    /me
GET    /me/permissions
```

## Entregas

```text
GET    /artifacts
POST   /artifacts
GET    /artifacts/:id
POST   /artifacts/:id/versions
GET    /artifacts/:id/versions
GET    /artifact-versions/:id/evaluation
POST   /artifacts/:id/request-resubmission
```

## Archivos

```text
POST   /uploads/presign
POST   /uploads/complete
GET    /files/:id/download-url
```

## Profesor

```text
GET    /teacher/dashboard
GET    /teacher/schedule
GET    /teacher/assignments
GET    /teacher/feedback
```

## Director

```text
GET    /director/dashboard
GET    /director/teachers
GET    /director/artifacts
GET    /director/alerts
POST   /director/artifacts/:id/allow-resubmission
POST   /director/observations
GET    /director/exports
```

## UGEL

```text
GET    /ugel/dashboard
GET    /ugel/institutions
GET    /ugel/alerts
GET    /ugel/alerts/:id
PATCH  /ugel/alerts/:id/status
POST   /ugel/alerts/:id/actions
GET    /ugel/metrics
GET    /ugel/outliers
GET    /ugel/exports
```

## Internos

```text
POST   /internal/jobs/document-processing
POST   /internal/jobs/evaluation
POST   /internal/alerts/recompute
GET    /health
GET    /ready
```

Proteger endpoints internos con un secreto independiente.

---

# 18. Arquitectura de repositorio

Usar monorepo.

```text
/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   ├── vite.config.ts
│   │   └── package.json
│   ├── api/
│   │   ├── src/
│   │   ├── tests/
│   │   └── package.json
│   └── document-worker/
│       ├── src/
│       ├── tests/
│       ├── requirements.txt
│       └── Dockerfile
├── packages/
│   ├── shared/
│   ├── schemas/
│   ├── ui/
│   └── config/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── config/
│   ├── rubrics/
│   ├── alert-rules/
│   └── prompts/
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   ├── deployment.md
│   └── demo-script.md
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

Usar `pnpm`.

---

# 19. Variables de entorno

Crear `.env.example`.

## Frontend

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=
```

## Backend

```env
NODE_ENV=
PORT=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=
INTERNAL_API_SECRET=
FRONTEND_URL=
MAX_UPLOAD_SIZE_MB=
SESSION_UPLOAD_WINDOW_BEFORE_MINUTES=
SESSION_UPLOAD_WINDOW_AFTER_MINUTES=
```

## Worker

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
INTERNAL_API_BASE_URL=
INTERNAL_API_SECRET=
WORKER_POLL_INTERVAL_SECONDS=
MAX_FILE_SIZE_MB=
```

---

# 20. UX y diseño

La interfaz debe ser:

- limpia,
- institucional,
- responsive,
- accesible,
- clara para usuarios no técnicos.

Priorizar:

- estados visibles,
- mensajes simples,
- indicadores de progreso,
- tablas filtrables,
- gráficos interpretables,
- explicación de alertas,
- retroalimentación detallada.

Evitar:

- exceso de animaciones,
- dashboards saturados,
- términos técnicos de IA,
- mensajes acusatorios.

Ejemplo de mensaje al profesor:

```text
Tu sesión necesita una corrección antes de ser validada.

Se identificó correctamente la competencia y la secuencia didáctica, pero no se encontró una estrategia explícita de retroalimentación para los estudiantes.

Agrega:
1. Cómo comunicarás al estudiante qué logró.
2. Qué aspecto debe mejorar.
3. Qué acción realizará después de recibir la retroalimentación.
```

---

# 21. Métricas principales

## Profesor

- score promedio,
- tasa de aprobación inicial,
- mejora entre versiones,
- criterios con mayor dificultad.

## Director

- entregas esperadas,
- entregas realizadas,
- aprobación inicial,
- correcciones,
- omisiones,
- profesores con recurrencia,
- criterios problemáticos.

## UGEL

- score por institución,
- score por criterio,
- tasa de invalidez,
- grupos con calificaciones bajas,
- alertas por severidad,
- tendencias,
- instituciones outlier,
- mejora posterior a acciones.

---

# 22. Estrategia de alertas para el MVP

No implementar machine learning complejo.

Usar:

- reglas SQL,
- funciones programadas,
- consultas agregadas,
- z-score opcional para outliers,
- comparación contra umbrales,
- análisis de periodos consecutivos.

Crear configuración:

```text
/config/alert-rules/default.v1.json
```

Ejemplo:

```json
{
  "lowGradeGroup": {
    "minimumStudents": 10,
    "lowScoreThreshold": 11,
    "affectedPercentage": 0.4,
    "consecutivePeriods": 2
  },
  "repeatedInvalidUnits": {
    "consecutiveInvalidSubmissions": 3,
    "minimumAffectedTeachers": 3
  },
  "institutionOutlier": {
    "minimumSubmissions": 20,
    "zScoreThreshold": -2
  }
}
```

Versionar reglas.

---

# 23. Jobs asíncronos

Usar tablas de jobs en PostgreSQL para la hackathon.

Ejemplo:

```text
PENDING
PROCESSING
COMPLETED
FAILED
RETRYING
```

Campos:

```text
id
type
payload
status
attempts
max_attempts
locked_at
locked_by
error_message
created_at
updated_at
```

El worker debe:

- tomar jobs pendientes,
- bloquearlos,
- procesarlos,
- registrar intentos,
- reintentar fallos temporales,
- evitar procesar dos veces el mismo job.

---

# 24. Logging y auditoría

Registrar acciones relevantes:

- inicio de sesión,
- subida,
- descarga,
- envío,
- nueva versión,
- evaluación,
- permiso de resubida,
- acceso a casos detallados,
- cambio de alerta,
- exportación.

`audit_logs` debe almacenar:

```text
actor_id
action
entity_type
entity_id
institution_id
metadata
ip_address opcional
user_agent opcional
created_at
```

Nunca almacenar secretos o archivos completos en logs.

---

# 25. Pruebas

Crear pruebas mínimas.

## Backend

- autenticación,
- autorización,
- creación de entrega,
- validación de horario,
- versionamiento,
- evaluación,
- estados,
- alertas.

## Frontend

- protección de rutas,
- formularios,
- carga de archivos,
- visualización de feedback,
- filtros.

## Worker

- PDF,
- PPTX,
- XLSX,
- documento vacío,
- archivo corrupto,
- tamaño inválido.

## Seguridad

- profesor no ve entregas ajenas,
- director no ve otra institución,
- UGEL no modifica evaluaciones,
- claves privadas no llegan al cliente.

---

# 26. Datos demo

Crear seed reproducible con:

- 1 UGEL.
- 2 instituciones.
- 2 directores.
- 1 especialista UGEL.
- 8 profesores.
- 6 grupos.
- 3 cursos.
- horarios.
- 4 tipos de evidencia.
- criterios pedagógicos.
- entregas aprobadas.
- entregas observadas.
- un grupo con notas bajas.
- tres profesores con unidades inválidas consecutivas.
- alertas generadas.

Crear credenciales demo mediante variables o documentación local, nunca hardcodear contraseñas reales en el repositorio público.

---

# 27. Historia de demostración

Preparar un flujo demo:

1. Un profesor inicia sesión.
2. Ve su sesión del día.
3. Sube un PDF dentro del horario permitido.
4. El archivo queda en procesamiento.
5. MarkItDown convierte el documento.
6. Gemini evalúa los criterios.
7. La sesión queda en `NEEDS_REVISION`.
8. El profesor recibe retroalimentación.
9. Corrige y crea una segunda versión.
10. La segunda versión es aprobada.
11. El director ve la mejora.
12. UGEL ve una alerta porque varios profesores fallan en el mismo criterio.
13. UGEL registra una acción sugerida de evaluación o acompañamiento.

---

# 28. Prioridades de implementación

## Fase 1 — Base

- Monorepo.
- React + Vite.
- Express + TypeScript.
- Supabase local/remoto.
- Auth.
- Roles.
- RLS.
- Seed.
- Layout por rol.

## Fase 2 — Entregas

- Modelos.
- Storage privado.
- URLs firmadas.
- Creación de evidencia.
- Versiones.
- Restricción horaria.
- Estados.

## Fase 3 — Worker

- MarkItDown.
- Jobs.
- Extracción.
- Manejo de errores.

## Fase 4 — Gemini

- Prompt versionado.
- JSON estructurado.
- Validación con Zod.
- Resultados por criterio.
- Retroalimentación al profesor.

## Fase 5 — Dashboards

- Profesor.
- Director.
- UGEL.
- Filtros.
- Gráficos.

## Fase 6 — Alertas

- Reglas configurables.
- Generación.
- Historial.
- Acciones.

## Fase 7 — Calidad y demo

- Tests.
- README.
- Deploy.
- Seed.
- Script de demo.
- Manejo de errores.

---

# 29. Criterios de aceptación

El MVP se considera funcional cuando:

1. Un usuario inicia sesión y es dirigido a su dashboard.
2. Un profesor solo ve su información.
3. Una sesión solo puede enviarse dentro del horario permitido.
4. El archivo se almacena de forma privada.
5. El documento se convierte a Markdown.
6. Gemini devuelve una evaluación estructurada.
7. El profesor recibe retroalimentación específica.
8. Una corrección crea una nueva versión.
9. El director ve datos de su institución.
10. UGEL ve métricas agregadas.
11. Se generan alertas por:
    - notas bajas de un grupo,
    - entregas inválidas consecutivas.
12. UGEL puede cambiar el estado de una alerta.
13. La aplicación mantiene logs de auditoría.
14. Existen seeds y documentación para ejecutar la demo.
15. El frontend se puede desplegar en Vercel.
16. El backend y worker se pueden desplegar en Railway.

---

# 30. Instrucciones de trabajo para Claude Code

Sigue este orden:

1. Inspecciona el repositorio.
2. Resume el estado actual.
3. Propón un plan concreto de implementación.
4. Define la estructura de carpetas.
5. Crea las migraciones.
6. Implementa autenticación y autorización.
7. Implementa el flujo mínimo de evidencia.
8. Implementa jobs y worker.
9. Integra Gemini.
10. Implementa dashboards.
11. Implementa alertas.
12. Agrega pruebas.
13. Documenta ejecución y despliegue.
14. Verifica que todo compile.
15. Ejecuta linters y tests.
16. Corrige errores encontrados.

No dejes funciones críticas como pseudocódigo.

No uses mocks permanentes para el flujo principal. Los datos demo pueden ser seeds, pero el sistema debe operar realmente contra Supabase y Gemini cuando las variables estén configuradas.

Cuando una integración externa no pueda probarse por falta de credenciales:

- implementa el adaptador,
- crea una interfaz desacoplada,
- agrega un modo mock explícito solo para desarrollo,
- documenta cómo habilitar el proveedor real.

---

# 31. Resultado esperado de la primera ejecución

En la primera iteración debes producir:

1. Documento de arquitectura.
2. Árbol del repositorio.
3. Plan de fases.
4. Esquema SQL inicial.
5. Migraciones Supabase.
6. Seeds.
7. Configuración de Vite.
8. Configuración de Express.
9. Autenticación.
10. Roles y protección de rutas.
11. Pantallas iniciales por rol.
12. `.env.example`.
13. README con instrucciones.

Después, continuar con el flujo de entregas y evaluación.

---

# 32. Mensaje central del producto

El producto debe comunicar:

> Una plataforma de trazabilidad pedagógica que transforma evidencias docentes en retroalimentación inmediata, supervisión institucional y alertas accionables para UGEL.

No presentar el producto como un sistema que sanciona o reemplaza la evaluación humana.

El valor principal es:

- detectar,
- explicar,
- priorizar,
- acompañar,
- mejorar.
