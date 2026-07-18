// ═══════════════════════════════════════════════════════════════════════════
//  api.ts — PUNTO ÚNICO DE ACCESO A DATOS DE KIPU
// ───────────────────────────────────────────────────────────────────────────
//  · api.llm → operaciones que disparan el motor de evaluación con IA (backend)
//  · api.db  → lecturas/escrituras CRUD contra Supabase
//
//  Regla: ninguna página o hook llama a `supabase`/`fetch` directamente.
//  Si cambia un endpoint, una tabla o un `select`, se ajusta AQUÍ y nada más.
//  Estas funciones devuelven filas "crudas"; la normalización a tipos de
//  dominio vive en src/factories.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase'
import { postForm } from './http'
import type { Artifact, Alert, ClassSchedule, GradeRecord, Institution, Profile, UploadResult } from '@/types'

// ─────────────────────────────────────────────────────────────
// LLM — motor de evaluación (backend /api/v1)
// ─────────────────────────────────────────────────────────────
export const llm = {
  /** Sube una evidencia nueva; el backend la convierte y la evalúa con IA. */
  evaluateArtifact(form: FormData) {
    return postForm<UploadResult>('/api/v1/artifacts', form)
  },
  /** Sube una versión corregida de una evidencia existente y la re-evalúa. */
  reevaluateVersion(artifactId: string, form: FormData) {
    return postForm<UploadResult>(`/api/v1/artifacts/${artifactId}/versions`, form)
  },
}

// ─────────────────────────────────────────────────────────────
// DB — CRUD (Supabase)
// ─────────────────────────────────────────────────────────────
// El query builder de Supabase infiere shapes concretos; casteamos al
// tipo de dominio en este único punto (los factories asumen esa forma).
async function rows<T>(query: PromiseLike<{ data: unknown }>): Promise<T[]> {
  const { data } = await query
  return (data ?? []) as T[]
}

export const db = {
  // ── Docente ──
  schedulesByTeacher(teacherId: string) {
    return rows<ClassSchedule>(supabase
      .from('class_schedules')
      .select('*, subjects(name), student_groups(name, grade)')
      .eq('teacher_id', teacherId))
  },
  artifactsByTeacher(teacherId: string) {
    return rows<Artifact>(supabase
      .from('artifacts')
      .select('*, artifact_versions(*, evaluations(*))')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false }))
  },
  /** Versión ligera para el calendario (solo tipo/estado/curso/fecha). */
  artifactTypesByTeacher(teacherId: string) {
    return rows<Artifact>(supabase
      .from('artifacts')
      .select('type, status, subject_id, subjects(name), created_at')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false }))
  },
  /** Unidades de aprendizaje ya subidas por el docente (para enlazar sesiones). */
  unitsByTeacher(teacherId: string) {
    return rows<Artifact>(supabase
      .from('artifacts')
      .select('id, type, status, subject_id, subjects(name), created_at')
      .eq('teacher_id', teacherId)
      .eq('type', 'MONTHLY_UNIT')
      .order('created_at', { ascending: false }))
  },

  // ── Directivo / Institución ──
  teachersByInstitution(institutionId: string) {
    return rows<Profile>(supabase
      .from('profiles')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('role', 'teacher'))
  },
  artifactsByInstitution(institutionId: string) {
    return rows<Artifact>(supabase
      .from('artifacts')
      .select('*, profiles(full_name), subjects(name), artifact_versions(version, status, created_at, evaluations(overall_score, decision))')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false }))
  },
  /** Resumen para el panel (con teacher_id y scores). */
  artifactsSummaryByInstitution(institutionId: string) {
    return rows<Artifact>(supabase
      .from('artifacts')
      .select('id, status, type, teacher_id, profiles(full_name), artifact_versions(evaluations(overall_score))')
      .eq('institution_id', institutionId))
  },
  alertsByInstitution(institutionId: string) {
    return rows<Alert>(supabase
      .from('alerts')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false }))
  },
  async updateAlertStatus(id: string, status: string) {
    return supabase.from('alerts').update({ status }).eq('id', id)
  },

  // ── UGEL (agregado) ──
  institutions() {
    return rows<Institution>(supabase.from('institutions').select('*'))
  },
  artifactsAll() {
    return rows<Artifact>(supabase
      .from('artifacts')
      .select('id, institution_id, status, artifact_versions(evaluations(overall_score))'))
  },
  alertsAll() {
    return rows<Alert>(supabase
      .from('alerts')
      .select('*, institutions(name)')
      .order('created_at', { ascending: false }))
  },
  grades() {
    return rows<GradeRecord>(supabase
      .from('grade_records')
      .select('group_id, period, score, student_groups(name, grade, institution_id)'))
  },
}

// Fachada única.
export const api = { llm, db }
export default api
