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
export type RubricaKipu = {
  version: string
  tipo: string
  extraccion: { identificacion: Record<string, string>; documentos_presentes: Record<string, boolean> }
  items: {
    numero: number; nombre: string; fuente: string; puntaje: number; nivel: string
    evidencia: string; recomendacion: string
  }[]
  puntaje_total: number
  puntaje_max: number
  recomendaciones_priorizadas: string[]
}
export type Evaluation = {
  overall_score: number
  decision: string
  summary: string
  strengths: string[]
  improvements: string[]
  criteria: Criterion[] | Ficha | RubricaKipu
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
  /** Cuenta como sesión/unidad válida cuando alcanza 75/100 en la rúbrica vigente. */
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

/** Logro diagnóstico agregado por aula × curso (vista `vw_aula_resumen`). */
export type AulaResumen = {
  aula_id: string
  aula_nombre: string | null
  grado: string | null
  seccion: string | null
  turno: string | null
  colegio_nombre: string | null
  course_key: string
  curso_nombre: string | null
  /** Alumnos con nota GENERAL en ese curso. */
  total: number
  /** Reparto por nivel de logro: C · B · A+AD. */
  en_inicio: number
  en_proceso: number
  logrado: number
  /** Promedio en la escala 1-4 (C=1 … AD=4). */
  promedio: number
}

// ── Respuestas del backend/LLM ──
export type UploadResult = {
  artifact_id: string
  status: ArtifactStatus
  /** Si la entrega cuenta como válida según su rúbrica. */
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
  dominant: MapaBucket | null
  distribution: MapaDistribution
  courses: MapaCourse[]
  /** true = colegio de demo (sintético); false = colegio real (MINEDU). */
  synthetic: boolean
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
  aula: { id: string; grado: string | null; seccion: string | null; turno: string | null; nombre: string | null } | null
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
  aulas: { id: string; seccion: string | null; grado: string | null; turno: string | null; nombre: string | null }[]
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
export type ProfesorNivel = 'destacado' | 'esperado' | 'en_progreso' | 'acompanamiento'
/** Scorings derivados del logro diagnóstico de los alumnos del docente. */
export type ProfesorScores = {
  /** 0-100: qué tan arriba está el promedio de sus alumnos en la escala 1-4. */
  logro: number
  /** 0-100: proporción de alumnos que NO quedó en nivel "En inicio". */
  equidad: number
  /** 0-100: alumnos evaluados, relativo al docente que más evaluó. */
  cobertura: number
  /** 0-100: promedio diagnóstico 55%, estudiantes por encima de C 30%, tamaño relativo 15%. */
  global: number
  /** Promedio del docente menos el de su distrito (escala 1-4). */
  valor_agregado: number | null
  referencia_distrito: number | null
  nivel: ProfesorNivel
  nivel_label: string
  nivel_color: string
}
export type ProfesorResumen = {
  dni: string
  full_name: string
  course_key: string
  course_name: string | null
  total_evaluaciones: number
  average_score_1_to_4: number | null
  pct_logrado: number
  pct_critico: number
  distribution: MapaDistribution
  scores: ProfesorScores
  ranking: number
  contexto: ProfesorContexto
}
export type ProfesoresResponse = {
  course: string
  buckets: Record<MapaBucket, { label: string; grades: string[]; color: string }>
  total: number
  scoring: {
    pesos: { logro: number; equidad: number; cobertura: number }
    niveles: { key: ProfesorNivel; label: string; min: number; color: string }[]
    referencias: {
      promedio_ugel: number | null
      alumnos_evaluados: number
      max_alumnos_por_docente: number
      promedio_por_distrito: Record<string, number | null>
    }
  }
  profesores: ProfesorResumen[]
}

// ── Alumnos UGEL (GET /api/v1/alumnos) ──
export type NivelLogro = 'C' | 'B' | 'A' | 'AD'
export type AlumnoFila = {
  alumno_id: string
  alumno_codigo: string | null
  alumno_nombre: string
  alumno_numero: number | null
  colegio_id: string | null
  colegio_nombre: string | null
  aula_id: string | null
  grado: string | null
  seccion: string | null
  turno: string | null
  aula_nombre: string | null
  notas: number
  periodos: number
  cursos: number
  promedio_diagnostico: number | null
  promedio_actual: number | null
  promedio_global: number | null
  fecha_ultima: string | null
  nivel_actual: NivelLogro | null
  nivel_actual_nombre: string | null
  nivel_diagnostico: NivelLogro | null
  nivel_diagnostico_nombre: string | null
  /** Promedio actual menos el del diagnóstico. */
  delta: number | null
}
export type PeriodoPunto = {
  periodo_id: string
  periodo_nombre: string
  fecha: string | null
  tipo: string
  alumnos: number
  promedio: number | null
  distribution: MapaDistribution
}
export type AlumnosResponse = {
  buckets: Record<MapaBucket, { label: string; grades: string[]; color: string }>
  total: number
  totals: {
    alumnos: number
    colegios: number
    aulas: number
    promedio_actual: number | null
    promedio_diagnostico: number | null
    avance_promedio: number | null
  }
  distribucion: MapaDistribution
  evolucion: PeriodoPunto[]
  cursos: { course_key: string; curso_nombre: string; registros: number; promedio: number | null; distribution: MapaDistribution }[]
  avance: { suben: number; estables: number; bajan: number; promedio: number | null }
  alumnos: AlumnoFila[]
}

// ── Ficha de alumno (GET /api/v1/alumnos/:id) ──
export type AlumnoSeriePunto = {
  periodo_id: string
  periodo: string
  fecha: string | null
  tipo: string
  promedio: number | null
  /** Además: una clave por course_key con su promedio, y `<course_key>_nivel`. */
  [key: string]: unknown
}
export type AlumnoDetalle = {
  buckets: Record<MapaBucket, { label: string; grades: string[]; color: string }>
  alumno: AlumnoFila
  docentes: { course_key: string; curso_nombre: string | null; profesor_id: string | null; profesor_nombre: string | null }[]
  periodos: { periodo_id: string; nombre: string; tipo: string; bimestre: number | null; fecha: string | null }[]
  serie: AlumnoSeriePunto[]
  detalle: {
    periodo: string; fecha: string | null; tipo_evaluacion: string
    course_key: string; curso_nombre: string | null
    promedio: number | null; nivel: NivelLogro | null; nivel_nombre: string | null
    profesor_nombre: string | null
  }[]
  competencias: {
    course_key: string
    curso_nombre: string | null
    competencias: {
      codigo: string
      nombre: string
      periodos: { periodo_id: string; periodo: string; fecha: string | null; puntaje: number | null; nivel: NivelLogro | null }[]
    }[]
  }[]
}

// ── Ficha de docente (GET /api/v1/profesores/:dni) ──
export type ProfesorAula = {
  dictado_id: string
  aula_id: string | null
  aula_nombre: string | null
  grado: string | null
  seccion: string | null
  turno: string | null
  nivel: string | null
  colegio_id: string | null
  colegio_nombre: string | null
  course_key: string | null
  curso_nombre: string | null
  periodo: string | null
  alumnos: number
  promedio_diagnostico: number | null
  promedio_actual: number | null
  avance: number | null
  distribution: MapaDistribution
  scores: { logro: number; equidad: number }
}
export type ProfesorUnidad = {
  id: string
  nombre: string
  orden: number | null
  created_at: string
  curso_nombre: string | null
  aula_nombre: string | null
  sesiones: { id: string; nombre: string; fecha: string | null; orden: number | null }[]
  evidencias: {
    id: string; estado: string; version_actual: number; created_at: string
    puntaje: number | null; decision: string | null; resumen: string | null; versiones: number
  }[]
  puntaje: number | null
}
export type ProfesorDetalle = {
  profesor: ProfesorResumen
  scoring: ProfesoresResponse['scoring']
  contacto: { dni: string; telefono: string | null }
  totales: {
    aulas: number; alumnos: number; notas: number; periodos: number
    unidades: number; sesiones: number; evidencias: number; evidencias_observadas: number
    puntaje_evidencias: number | null
  }
  aulas: ProfesorAula[]
  evolucion: { periodo_id: string; periodo: string; tipo: string; fecha: string | null; alumnos: number; promedio: number | null; distribution: MapaDistribution }[]
  competencias: {
    codigo: string; course_key: string; nombre: string; registros: number
    promedio: number | null; nivel: NivelLogro | null; nivel_nombre: string | null
    distribution: MapaDistribution
  }[]
  unidades: ProfesorUnidad[]
}

// ── Motor de alertas (GET/POST /api/v1/alertas) ──
export type AlertaRegla = {
  codigo: string
  nombre: string
  descripcion: string
  fuente: string
  umbral_default: number
  umbral_unidad: string
}
export type AlertaOrigen = 'motor' | 'seed' | 'manual'
export type AlertaFila = {
  id: string
  tipo: string
  severidad: Severity
  estado: AlertStatus
  titulo: string
  resumen: string
  accion_sugerida: string
  colegio_id: string | null
  colegio_nombre: string | null
  evidencia: Record<string, unknown>
  historial: { estado: string; desde?: string; motivo?: string | null; at: string }[]
  origen: AlertaOrigen
  created_at: string
}
export type AlertasResponse = {
  total: number
  totals: { total: number; abiertas: number; nuevas: number; criticas: number; colegios: number }
  por_estado: Record<string, number>
  por_severidad: Record<string, number>
  por_tipo: Record<string, number>
  reglas: AlertaRegla[]
  alertas: AlertaFila[]
}
export type EvaluacionAlertas = {
  dry_run: boolean
  evaluadas: string[]
  umbrales: Record<string, number>
  candidatas: number
  por_regla: Record<string, number>
  omitidas_por_duplicado: number
  creadas: number
  detalle: {
    tipo: string; severidad: Severity; titulo: string; resumen: string
    accion_sugerida: string; colegio_id: string | null; evidencia: Record<string, unknown>
  }[]
}
export type NuevaAlerta = {
  tipo: string
  severidad: Severity
  colegio_id?: string | null
  titulo: string
  resumen: string
  accion_sugerida: string
}

// ── Registro de notas del docente (GET/POST /api/v1/notas/registro) ──
export type PeriodoAcademico = {
  id: string
  nombre: string
  tipo: string
  bimestre: number | null
  anio: number
  fecha_inicio: string | null
  fecha_fin: string | null
}
export type AlumnoRegistro = {
  id: string
  codigo: string | null
  numero: number | null
  nombre: string
  /** Nivel ya registrado por competencia: { C1: 'A', C2: 'B' }. */
  notas: Record<string, string>
}
export type RegistroNotas = {
  dictado: {
    id: string
    curso: string | null
    course_key: string
    aula: string
    grado: string | null
    seccion: string | null
    turno: string | null
    colegio: string | null
  }
  periodo: PeriodoAcademico
  periodos: PeriodoAcademico[]
  escala: { codigo: string; nombre: string; valor: number }[]
  competencias: { codigo: string; nombre: string }[]
  alumnos: AlumnoRegistro[]
}
export type ResultadoRegistro = {
  ok: true
  guardadas: number
  alumnos: number
  periodo: string
  curso: string | null
  aula: string | null
}

// ── Competencias del docente (GET/PUT /api/v1/competencias) ──
export type EstadoCompetencia = 'PENDIENTE' | 'FOCO' | 'REFORZANDO' | 'CONSOLIDADA'
export type CompetenciaDocente = {
  codigo: string
  nombre: string
  alumnos: number
  promedio: number | null
  promedio_diagnostico: number | null
  avance: number | null
  nivel: NivelLogro | null
  nivel_nombre: string | null
  distribution: MapaDistribution
  /** Seguimiento que gestiona el docente. */
  estado: EstadoCompetencia
  nota: string
  actualizado: string | null
}
export type DictadoCompetencias = {
  dictado_id: string
  curso: string | null
  course_key: string
  aula: string
  turno: string | null
  colegio: string | null
  competencias: CompetenciaDocente[]
}
export type CompetenciasResponse = {
  estados: { key: EstadoCompetencia; label: string; descripcion: string }[]
  buckets: Record<MapaBucket, { label: string; grades: string[]; color: string }>
  dictados: DictadoCompetencias[]
}

// ── Cómo se evalúa (GET /api/v1/evaluacion) ──
export type PasoEvaluacion = {
  clave: string
  titulo: string
  /** Nombre corto para el nodo del pipeline. */
  etiqueta: string
  quien: 'IA' | 'servidor'
  descripcion: string
  entrada: string
  salida: string
  aplica: ('UNIDAD' | 'SESION')[]
  devuelve?: { documentos: string[]; identificacion: string[] }
  /** Claves de los prompts que se envían en este paso. */
  prompts: string[]
}
export type ConfigEvaluacion = {
  motor: {
    modelo: string
    /** Ficha técnica pública del modelo. */
    modelo_docs: string
    modelo_respaldo: string
    modelo_respaldo_docs: string
    prompt_version: string
    rubrica_version: string
    formatos: string[]
    max_mb: number
    puntaje_minimo_valida: number
    puntaje_maximo_rubrica: number
    puntaje_minimo_rubrica: number
    limite_texto: number
  }
  pasos: PasoEvaluacion[]
  decisiones: { estado: string; label: string; regla: string }[]
  rubrica: {
    nombre: string
    nota: string
    fuentes: { nombre: string; aporte: string }[]
    valoraciones: { puntaje: number; label: string; nota: string }[]
    items: { numero: number; nombre: string; fuente: string }[]
  }
  prompts: { clave: string; titulo: string; cuando: string; texto: string }[]
}
