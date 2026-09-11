// ═══════════════════════════════════════════════════════════════════════════
//  api.ts — PUNTO ÚNICO DE ACCESO A DATOS DE KIPU
// ───────────────────────────────────────────────────────────────────────────
//  · api.llm → operaciones que disparan el motor de evaluación con IA (backend)
//  · api.db  → lecturas/escrituras contra Supabase (modelo unificado)
//
//  Regla: ninguna página o hook llama a `supabase`/`fetch` directamente.
//  Aquí se MAPEAN las tablas del modelo unificado (evidencias/unidades/sesiones/
//  dictados/notas/colegios/alertas) a las formas de dominio del front (Artifact,
//  Alert, Institution…), para que factories y páginas no cambien.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase'
import { postForm, getJson, postJson, patchJson, putJson, delJson } from './http'
import type { Alert, AlertaFila, AlertasResponse, AlumnoDetalle, AlumnosResponse, Artifact, AulaResumen, EvaluacionAlertas, NuevaAlerta, ClassSchedule, Dictado, Horario, ProfesorDetalle, HorariosPanel, Institution, MapaResponse, NewHorario, NewUsuario, CompetenciasResponse, ConfigEvaluacion, ProfesoresResponse, Profile, RegistroNotas, ResultadoRegistro, UploadResult, UsuarioRow, UsuariosPanel } from '@/types'

// ─────────────────────────────────────────────────────────────
// LLM — motor de evaluación (backend /api/v1)
// ─────────────────────────────────────────────────────────────
export const llm = {
  /** Sube una evidencia nueva (unidad o sesión); el backend la evalúa con IA. */
  evaluateArtifact(form: FormData) {
    return postForm<UploadResult>('/api/v1/artifacts', form)
  },
  /** Sube una versión corregida de una evidencia existente y la re-evalúa. */
  reevaluateVersion(evidenciaId: string, form: FormData) {
    return postForm<UploadResult>(`/api/v1/artifacts/${evidenciaId}/versions`, form)
  },
}

// ─────────────────────────────────────────────────────────────
// Mapeadores: modelo unificado → forma de dominio del front
// ─────────────────────────────────────────────────────────────
const EV_SELECT = `
  id, estado, version_actual, created_at, unidad_id, sesion_id, profesor_id,
  usuarios ( nombre_completo, colegio_id ),
  unidades ( id, nombre, dictados ( cursos ( nombre ), aulas ( grado, seccion ) ), contextos_ia ( contexto, created_at ) ),
  sesiones ( id, nombre, unidad_id, unidades ( dictados ( cursos ( nombre ), aulas ( grado, seccion ) ) ), contextos_ia ( contexto, created_at ) ),
  evidencia_versiones ( id, version, estado, created_at, nombre_archivo, es_valida, motivo_invalidez, evaluaciones ( puntaje_total, decision, resumen, fortalezas, mejoras, criterios ) )
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toArtifact(ev: any): Artifact {
  const isUnit = !!ev.unidad_id
  const unidad = isUnit ? ev.unidades : ev.sesiones?.unidades
  const dictado = unidad?.dictados
  const versions = [...(ev.evidencia_versiones ?? [])].sort((a, b) => b.version - a.version)
  const currentId = versions[0]?.id
  const ctxRow = isUnit ? ev.unidades?.contextos_ia : ev.sesiones?.contextos_ia
  const ctx = Array.isArray(ctxRow) ? ctxRow[0] : ctxRow
  return {
    id: ev.id,
    type: isUnit ? 'MONTHLY_UNIT' : 'DAILY_SESSION',
    status: ev.estado,
    current_version: ev.version_actual,
    created_at: ev.created_at,
    name: isUnit ? ev.unidades?.nombre : ev.sesiones?.nombre,
    teacher_id: ev.profesor_id,
    // Colegio de la evidencia = colegio del docente (el panel UGEL agrupa por él).
    institution_id: ev.usuarios?.colegio_id ?? undefined,
    // unit_id: para agrupar sesiones bajo su unidad se usa el id de la UNIDAD.
    unit_id: isUnit ? ev.unidades?.id : ev.sesiones?.unidad_id,
    profiles: ev.usuarios ? { full_name: ev.usuarios.nombre_completo } : null,
    subjects: dictado?.cursos ? { name: dictado.cursos.nombre } : null,
    student_groups: dictado?.aulas ? { grade: dictado.aulas.grado ?? '', name: dictado.aulas.seccion ?? '' } : null,
    artifact_versions: versions.map((v: any) => ({
      id: v.id, version: v.version, status: v.estado, created_at: v.created_at,
      original_filename: v.nombre_archivo, is_valid: v.es_valida, invalid_reason: v.motivo_invalidez,
      evaluations: (v.evaluaciones ?? []).map((e: any) => ({
        overall_score: e.puntaje_total, decision: e.decision, summary: e.resumen,
        strengths: e.fortalezas ?? [], improvements: e.mejoras ?? [], criteria: e.criterios ?? [],
      })),
    })),
    artifact_contexts: ctx ? [{ version_id: currentId, context: ctx.contexto, created_at: ctx.created_at }] : [],
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAlert(a: any): Alert {
  return {
    id: a.id, institution_id: a.colegio_id, type: a.tipo, severity: a.severidad, status: a.estado,
    title: a.titulo, summary: a.resumen, suggested_action: a.accion_sugerida, created_at: a.created_at,
    institutions: a.colegios ? { name: a.colegios.nombre } : null,
  }
}

async function mapRows<T>(query: PromiseLike<{ data: unknown; error?: unknown }>, fn: (r: any) => T): Promise<T[]> {
  const { data, error } = await query
  if (error) console.error('supabase query error:', error)
  return ((data ?? []) as any[]).map(fn)
}

// ─────────────────────────────────────────────────────────────
// DB — modelo unificado (Supabase)
// ─────────────────────────────────────────────────────────────
export const db = {
  // ── Docente ──
  /** Dictados del docente (curso + aula + periodo + horarios), para elegir al subir. */
  dictadosByTeacher(teacherId: string) {
    return mapRows<Dictado>(supabase
      .from('dictados')
      .select('id, cursos(id, nombre), aulas(id, grado, seccion, turno, nombre), periodos_academicos(id, nombre), horarios(id, dia_semana, hora_inicio, hora_fin)')
      .eq('profesor_id', teacherId), (d: any) => ({
        id: d.id, curso: d.cursos, aula: d.aulas, periodo: d.periodos_academicos,
        horarios: (d.horarios ?? []) as Horario[],
      }))
  },
  /** Clases del docente como ClassSchedule (derivado de horarios ⋈ dictados). */
  schedulesByTeacher(teacherId: string) {
    return mapRows<ClassSchedule>(supabase
      .from('horarios')
      .select('id, dia_semana, hora_inicio, hora_fin, dictados!inner(profesor_id, curso_id, aula_id, cursos(name:nombre), aulas(name:seccion, grade:grado))')
      .eq('dictados.profesor_id', teacherId), (h: any) => ({
        id: h.id, teacher_id: teacherId, weekday: h.dia_semana, start_time: h.hora_inicio, end_time: h.hora_fin,
        subject_id: h.dictados?.curso_id, group_id: h.dictados?.aula_id,
        subjects: h.dictados?.cursos ?? { name: '' }, student_groups: h.dictados?.aulas ?? { name: '', grade: '' },
      }))
  },
  artifactsByTeacher(teacherId: string) {
    return mapRows<Artifact>(supabase.from('evidencias').select(EV_SELECT)
      .eq('profesor_id', teacherId).order('created_at', { ascending: false }), toArtifact)
  },
  /** Alias ligero para el calendario (misma forma). */
  artifactTypesByTeacher(teacherId: string) {
    return this.artifactsByTeacher(teacherId)
  },
  /** Unidades del docente (evidencias de unidad) para enlazar sesiones. */
  unitsByTeacher(teacherId: string) {
    return mapRows<Artifact>(supabase.from('evidencias').select(EV_SELECT)
      .eq('profesor_id', teacherId).not('unidad_id', 'is', null)
      .order('created_at', { ascending: false }), toArtifact)
  },

  // ── Directivo / Colegio ──
  teachersByInstitution(colegioId: string) {
    return mapRows<Profile>(supabase
      .from('usuarios')
      .select('id, nombre_completo, colegio_id, roles!inner(key)')
      .eq('colegio_id', colegioId).eq('roles.key', 'profesor'), (u: any) => ({
        id: u.id, full_name: u.nombre_completo, role: 'teacher', institution_id: u.colegio_id,
      }))
  },
  artifactsByInstitution(colegioId: string) {
    return mapRows<Artifact>(supabase.from('evidencias').select(EV_SELECT.replace('usuarios (', 'usuarios!inner ('))
      .eq('usuarios.colegio_id', colegioId).order('created_at', { ascending: false }), toArtifact)
  },
  /** Unidades y sesiones del colegio con su contexto (para el director). Misma forma. */
  artifactsWithContextByInstitution(colegioId: string) {
    return this.artifactsByInstitution(colegioId)
  },
  /** Resumen (con teacher_id y scores). Misma forma. */
  artifactsSummaryByInstitution(colegioId: string) {
    return this.artifactsByInstitution(colegioId)
  },
  alertsByInstitution(colegioId: string) {
    return mapRows<Alert>(supabase.from('alertas').select('*').eq('colegio_id', colegioId)
      .order('created_at', { ascending: false }), toAlert)
  },
  async updateAlertStatus(id: string, status: string) {
    return supabase.from('alertas').update({ estado: status }).eq('id', id)
  },

  // ── UGEL (agregado) ──
  institutions() {
    return mapRows<Institution>(supabase.from('colegios').select('id, nombre'), (c: any) => ({ id: c.id, name: c.nombre }))
  },
  artifactsAll() {
    return mapRows<Artifact>(supabase.from('evidencias').select(EV_SELECT), toArtifact)
  },
  alertsAll() {
    return mapRows<Alert>(supabase.from('alertas').select('*, colegios(nombre)')
      .order('created_at', { ascending: false }), toAlert)
  },
  /** Logro diagnóstico agregado por aula × curso (vista vw_aula_resumen). */
  grades() {
    return mapRows<AulaResumen>(supabase.from('vw_aula_resumen')
      .select('aula_id, aula_nombre, grado, seccion, turno, colegio_nombre, course_key, curso_nombre, total, en_inicio, en_proceso, logrado, promedio'),
      (r: any) => ({
        aula_id: r.aula_id, aula_nombre: r.aula_nombre, grado: r.grado, seccion: r.seccion, turno: r.turno,
        colegio_nombre: r.colegio_nombre, course_key: r.course_key, curso_nombre: r.curso_nombre,
        total: r.total ?? 0, en_inicio: r.en_inicio ?? 0, en_proceso: r.en_proceso ?? 0,
        logrado: r.logrado ?? 0, promedio: Number(r.promedio ?? 0),
      }))
  },
}

// ─────────────────────────────────────────────────────────────
// MAP — mapa diagnóstico UGEL 06 (backend /api/v1/mapa)
// ─────────────────────────────────────────────────────────────
export const map = {
  mapa(course?: string) {
    return getJson<MapaResponse>(`/api/v1/mapa${course ? `?course=${course}` : ''}`)
  },
  profesores(course?: string, limit?: number) {
    const params = new URLSearchParams()
    if (course) params.set('course', course)
    if (limit) params.set('limit', String(limit))
    const qs = params.toString()
    return getJson<ProfesoresResponse>(`/api/v1/profesores${qs ? `?${qs}` : ''}`)
  },
  /** Ficha del docente: aulas, evolución, competencias, unidades y scoring. */
  profesor(dni: string) {
    return getJson<ProfesorDetalle>(`/api/v1/profesores/${encodeURIComponent(dni)}`)
  },
  /** Listado de alumnos con estadísticas agregadas. */
  alumnos(opts: { search?: string; colegio?: string; aula?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(opts)) if (v !== undefined && v !== '') params.set(k, String(v))
    const qs = params.toString()
    return getJson<AlumnosResponse>(`/api/v1/alumnos${qs ? `?${qs}` : ''}`)
  },
  /** Ficha del alumno: serie de notas en el tiempo y desglose por competencia. */
  alumno(id: string) {
    return getJson<AlumnoDetalle>(`/api/v1/alumnos/${encodeURIComponent(id)}`)
  },
}

// ─────────────────────────────────────────────────────────────
// HORARIOS — gestión del directivo (backend /api/v1/horarios)
// ─────────────────────────────────────────────────────────────
export const horarios = {
  panel() {
    return getJson<HorariosPanel>('/api/v1/horarios')
  },
  create(payload: NewHorario) {
    return postJson<Horario>('/api/v1/horarios', payload)
  },
  remove(id: string) {
    return delJson<{ id: string }>(`/api/v1/horarios/${id}`)
  },
}

// ─────────────────────────────────────────────────────────────
// USUARIOS — alta de cuentas (backend /api/v1/usuarios, solo UGEL)
// ─────────────────────────────────────────────────────────────
const roleToKey = (r: string) => (r === 'teacher' ? 'profesor' : r)

export const usuarios = {
  async panel(): Promise<UsuariosPanel> {
    const p = await getJson<{ colegios: { id: string; name?: string; nombre?: string }[]; users: any[] }>('/api/v1/usuarios')
    return {
      institutions: (p.colegios ?? []).map((c) => ({ id: c.id, name: c.nombre ?? c.name ?? '' })),
      users: (p.users ?? []).map((u) => ({
        id: u.id, full_name: u.full_name, role: u.role === 'profesor' ? 'teacher' : u.role,
        email: u.email, institution_id: u.colegio_id, institution_name: u.colegio_name,
        deleted_at: u.deleted_at, active: u.active,
      })),
    }
  },
  create(payload: NewUsuario) {
    return postJson<UsuarioRow>('/api/v1/usuarios', {
      email: payload.email, password: payload.password, full_name: payload.full_name,
      role: roleToKey(payload.role), colegio_id: payload.institution_id,
    })
  },
  update(id: string, payload: { password?: string; email?: string }) {
    return patchJson<{ id: string }>(`/api/v1/usuarios/${id}`, payload)
  },
  softDelete(id: string) {
    return delJson<{ id: string }>(`/api/v1/usuarios/${id}`)
  },
  restore(id: string) {
    return postJson<{ id: string }>(`/api/v1/usuarios/${id}/restore`, {})
  },
  hardDelete(id: string) {
    return delJson<{ id: string }>(`/api/v1/usuarios/${id}?hard=true`)
  },
}

// ─────────────────────────────────────────────────────────────
// FILES — acceso a archivos de evidencia
// ─────────────────────────────────────────────────────────────
export const files = {
  artifactVersionUrl(versionId: string) {
    return getJson<{ url: string | null; filename: string; note?: string }>(`/api/v1/artifacts/versions/${versionId}/file`)
  },
}

// ─────────────────────────────────────────────────────────────
// ALERTAS — motor de reglas (backend /api/v1/alertas, solo UGEL)
// ─────────────────────────────────────────────────────────────
export const alertas = {
  /** Listado con estadísticas y catálogo de reglas. */
  list(filtros: { estado?: string; severidad?: string; tipo?: string; colegio?: string } = {}) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(filtros)) if (v) params.set(k, v)
    const qs = params.toString()
    return getJson<AlertasResponse>(`/api/v1/alertas${qs ? `?${qs}` : ''}`)
  },
  /** Corre el motor. Con `dry_run` devuelve lo que haría sin escribir nada. */
  evaluar(payload: { dry_run?: boolean; reglas?: string[]; umbrales?: Record<string, number> } = {}) {
    return postJson<EvaluacionAlertas>('/api/v1/alertas/evaluar', payload)
  },
  /** Alta manual, para probar el flujo de punta a punta. */
  crear(payload: NuevaAlerta) {
    return postJson<AlertaFila>('/api/v1/alertas', payload)
  },
  cambiarEstado(id: string, estado: string, motivo?: string) {
    return patchJson<AlertaFila>(`/api/v1/alertas/${id}`, { estado, motivo })
  },
  /** Borra las alertas generadas (motor o manuales) tras las pruebas. */
  limpiar(origen: 'motor' | 'manual' | 'todas') {
    return delJson<{ borradas: number }>(`/api/v1/alertas?origen=${origen}`)
  },
}

// ─────────────────────────────────────────────────────────────
// NOTAS — registro del docente (backend /api/v1/notas)
// ─────────────────────────────────────────────────────────────
export const notas = {
  /** Nómina del aula, competencias del curso y lo ya registrado en ese periodo. */
  registro(dictadoId: string, periodoId?: string) {
    const params = new URLSearchParams({ dictado_id: dictadoId })
    if (periodoId) params.set('periodo_id', periodoId)
    return getJson<RegistroNotas>(`/api/v1/notas/registro?${params}`)
  },
  /** Guarda o corrige el registro completo de un dictado × periodo. */
  guardar(payload: { dictado_id: string; periodo_id: string; filas: { alumno_id: string; notas: Record<string, string> }[] }) {
    return postJson<ResultadoRegistro>('/api/v1/notas/registro', payload)
  },
}

// ─────────────────────────────────────────────────────────────
// DOCENTE — lo que ve el profesor de sus propios alumnos
// ─────────────────────────────────────────────────────────────
export const docente = {
  /** Competencias de sus dictados: desempeño del grupo + su propio seguimiento. */
  competencias() {
    return getJson<CompetenciasResponse>('/api/v1/competencias')
  },
  /** Guarda el estado de trabajo y/o el plan de una competencia. */
  guardarCompetencia(payload: { dictado_id: string; competencia: string; estado?: string; nota?: string }) {
    return putJson<{ ok: true }>('/api/v1/competencias', payload)
  },
  /** Alumnos de las aulas donde dicta, con la misma forma que el listado UGEL. */
  misAlumnos(opts: { search?: string; aula?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(opts)) if (v !== undefined && v !== '') params.set(k, String(v))
    const qs = params.toString()
    return getJson<AlumnosResponse>(`/api/v1/alumnos/mis${qs ? `?${qs}` : ''}`)
  },
}

// ─────────────────────────────────────────────────────────────
// EVALUACIÓN — cómo funciona el motor (documentación viva)
// ─────────────────────────────────────────────────────────────
export const evaluacion = {
  config() {
    return getJson<ConfigEvaluacion>('/api/v1/evaluacion')
  },
}

export const api = { llm, db, map, horarios, usuarios, files, alertas, notas, docente, evaluacion }
export default api
