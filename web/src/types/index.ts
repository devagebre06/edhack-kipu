// ─────────────────────────────────────────────────────────────
// Tipos de dominio de kipu — fuente única de verdad.
// Todo el front (services, factories, hooks, pages) importa desde aquí.
// Si cambia la forma de un dato del backend, se ajusta este archivo
// y su factory correspondiente (src/factories) — nada más.
// ─────────────────────────────────────────────────────────────

// ── Usuarios / roles ──
export type Role = 'teacher' | 'director' | 'ugel'
export type Profile = { id: string; full_name: string; role: Role; institution_id: string | null }

// ── Estados / enums ──
export type ArtifactStatus =
  | 'PROCESSING' | 'APPROVED' | 'NEEDS_REVISION' | 'MANUAL_REVIEW' | 'PROCESSING_ERROR'
export type ArtifactType =
  | 'DAILY_SESSION' | 'MONTHLY_UNIT' | 'BIMONTHLY_GRADES' | 'ANNUAL_GRADE_SUMMARY'
export type AlertStatus = 'NEW' | 'UNDER_REVIEW' | 'DISMISSED' | 'ESCALATED' | 'RESOLVED'
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

// ── Catálogo ──
export type Institution = { id: string; name: string }
export type Subject = { id?: string; name: string }
export type StudentGroup = { id?: string; name: string; grade: string; institution_id?: string }

export type ClassSchedule = {
  id: string
  teacher_id: string
  weekday: number
  start_time: string
  end_time: string
  subject_id: string
  group_id: string
  subjects: Subject
  student_groups: StudentGroup
}

// ── Evaluación (resultado del motor de IA) ──
export type Criterion = {
  criterionCode: string; criterionName: string; score: number; maxScore: number
  status: string; feedback: string; evidence: { quote: string; location: string }[]
}
export type FichaItem = {
  numero: number; dimension: string; nombre: string; valoracion: string
  puntaje: number | null; evidencia: string; recomendacion: string
}
export type Desempeno = {
  numero: number; nombre: string; valoracion: string
  evidencia_diseno: string; recomendacion: string
}
export type Ficha = {
  version: string
  extraccion: { identificacion: Record<string, string>; documentos_presentes: Record<string, boolean> }
  items: FichaItem[]
  desempenos: Desempeno[]
  puntaje_total: number; puntaje_max: number; promedio: number; nivel_global: string
  recomendaciones_priorizadas: string[]; compromisos_docente: string[]; compromisos_especialista: string[]
}
export type Evaluation = {
  overall_score: number
  decision: string
  summary: string
  strengths: string[]
  improvements: string[]
  criteria: Criterion[] | Ficha
}

// ── Evidencias (artifacts) ──
export type ArtifactVersion = {
  id: string
  version: number
  status: ArtifactStatus
  created_at: string
  original_filename: string
  evaluations: Evaluation[]
}
export type Artifact = {
  id: string
  type: ArtifactType
  status: ArtifactStatus
  current_version: number
  created_at: string
  teacher_id?: string
  institution_id?: string
  subject_id?: string
  profiles?: { full_name: string } | null
  subjects?: { name: string } | null
  artifact_versions: ArtifactVersion[]
}

// ── Alertas ──
export type Alert = {
  id: string
  institution_id: string
  type: string
  severity: Severity
  status: AlertStatus
  title: string
  summary: string
  suggested_action: string
  created_at: string
  institutions?: { name: string } | null
}

// ── Notas ──
export type GradeRecord = {
  group_id: string
  period: string
  score: number
  student_groups: StudentGroup
}

// ── Respuestas del backend/LLM ──
export type UploadResult = {
  artifact_id: string
  status: ArtifactStatus
  evaluation?: Evaluation
}
