// ─────────────────────────────────────────────────────────────
// Tipos de dominio de kipu — fuente única de verdad.
// Todo el front (services, factories, hooks, pages) importa desde aquí.
// Si cambia la forma de un dato del backend, se ajusta este archivo
// y su factory correspondiente (src/factories) — nada más.
// ─────────────────────────────────────────────────────────────

// ── Usuarios / roles ──
export type Role = 'teacher' | 'director' | 'ugel'
export type Profile = { id: string; full_name: string; role: Role; institution_id: string | null }

// ── Gestión de usuarios (panel UGEL, GET/POST /api/v1/usuarios) ──
export type UsuarioRow = {
  id: string
  full_name: string
  role: Role
  email: string | null
  institution_id: string | null
  institution_name: string | null
  deleted_at: string | null
  active: boolean
}
export type UsuariosPanel = {
  institutions: { id: string; name: string }[]
  users: UsuarioRow[]
}
export type NewUsuario = {
  email: string
  password: string
  full_name: string
  role: Role
  institution_id: string | null
}

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
  /** Ítem excluido de la evaluación (no cuenta para el puntaje). */
  excluido?: boolean
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

// ── Contexto de contenido (IA) — visible solo para director/UGEL ──
export type ArtifactContext = {
  area: string
  titulo: string
  resumen: string
  temas: string[]
  grado: string
  periodo: string
}

// ── Evidencias (artifacts) ──
export type ArtifactVersion = {
  id: string
  version: number
  status: ArtifactStatus
  created_at: string
  original_filename: string
  /** Cuenta como sesión/unidad válida (superó el umbral y —si es sesión— es coherente con su unidad). */
  is_valid?: boolean
  /** Motivo (apto para el docente) cuando la versión no es válida; null si lo es. */
  invalid_reason?: string | null
  evaluations: Evaluation[]
}
export type Artifact = {
  id: string
  type: ArtifactType
  status: ArtifactStatus
  current_version: number
  created_at: string
  /** Nombre dado por el docente (usado en unidades de aprendizaje). */
  name?: string | null
  teacher_id?: string
  institution_id?: string
  subject_id?: string
  /** Unidad de aprendizaje a la que pertenece una sesión (null en otras entregas). */
  unit_id?: string | null
  profiles?: { full_name: string } | null
  subjects?: { name: string } | null
  /** Aula/sección de la evidencia (join student_groups). */
  student_groups?: { grade: string; name: string } | null
  artifact_versions: ArtifactVersion[]
  /** Secciones que cubre una unidad (join unit_groups). */
  unit_groups?: { group_id: string }[]
  /** Contexto de contenido por versión (join artifact_contexts; solo director/UGEL). */
  artifact_contexts?: { version_id: string; context: ArtifactContext; created_at: string }[]
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
  /** Si la entrega cuenta como válida (umbral de puntaje y coherencia con la unidad). */
  is_valid?: boolean
  invalid_reason?: string | null
  evaluation?: Evaluation
}

// ── Mapa diagnóstico UGEL 06 (GET /api/v1/mapa) ──
export type MapaBucket = 'critico' | 'intermedio' | 'logrado'
export type MapaBucketStat = { count: number; pct: number; color: string }
export type MapaDistribution = Record<MapaBucket, MapaBucketStat>
export type MapaCourse = {
  course_key: string
  course_name: string
  total: number
  promedio: number | null
  dominant: MapaBucket
  distribution: MapaDistribution
}
export type MapaColegio = {
  school_key: string
  school_name: string
  district: string
  network_key: string
  network_name: string
  latitude: number | null
  longitude: number | null
  total_students: number
  average_score_1_to_4: number | null
  dominant: MapaBucket
  distribution: MapaDistribution
  courses: MapaCourse[]
}
export type MapaDistrito = {
  district: string
  schools: number
  total_students: number
  dominant: MapaBucket
  distribution: MapaDistribution
}
export type MapaResponse = {
  course: string
  buckets: Record<MapaBucket, { label: string; grades: string[]; color: string }>
  totals: { colegios: number; distritos: number; evaluaciones: number }
  colegios: MapaColegio[]
  distritos: MapaDistrito[]
}

// ── Dictado (aula + curso + profesor + periodo) y horarios ──
export type Horario = {
  id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}
export type Dictado = {
  id: string
  curso: { id: string; nombre: string } | null
  aula: { id: string; grado: string | null; seccion: string | null; nombre: string | null } | null
  periodo: { id: string; nombre: string } | null
  horarios: Horario[]
}
export type HorarioDocente = {
  id: string
  full_name: string
  dni: string | null
  dictados: Dictado[]
}
export type HorariosPanel = {
  teachers: HorarioDocente[]
  cursos: { id: string; nombre: string }[]
  aulas: { id: string; seccion: string | null; grado: string | null; nombre: string | null }[]
  periodos: { id: string; nombre: string }[]
}
export type NewHorario = {
  profesor_id: string
  curso_id: string
  aula_id: string
  periodo_id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

// ── Profesores UGEL 06 (GET /api/v1/profesores) ──
// Contexto sociodemográfico del docente (card lateral).
export type ProfesorContexto = {
  school_key: string | null
  school_name: string | null
  codigo_local: string | null
  address: string | null
  district: string | null
  network_name: string | null
  educational_levels: string[]
}
export type ProfesorResumen = {
  dni: string
  full_name: string
  course_key: string
  course_name: string | null
  total_evaluaciones: number
  average_score_1_to_4: number | null
  pct_logrado: number
  distribution: MapaDistribution
  contexto: ProfesorContexto
}
export type ProfesoresResponse = {
  course: string
  buckets: Record<MapaBucket, { label: string; grades: string[]; color: string }>
  total: number
  profesores: ProfesorResumen[]
}
