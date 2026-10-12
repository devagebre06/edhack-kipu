// ─────────────────────────────────────────────────────────────
// Factory de Artifact — única capa que conoce la forma anidada
// (artifact → versions → evaluations). Si esa forma cambia, se
// corrige AQUÍ y ninguna vista se rompe.
// ─────────────────────────────────────────────────────────────
import type { Artifact, ArtifactContext, ArtifactStatus, ArtifactVersion, Evaluation } from '@/types'

/** Versiones ordenadas de la más reciente a la más antigua. */
export function sortedVersions(a: Artifact): ArtifactVersion[] {
  return [...(a.artifact_versions ?? [])].sort((x, y) => y.version - x.version)
}

/** Versión actual (la de mayor número). */
export function latestVersion(a: Artifact): ArtifactVersion | undefined {
  return sortedVersions(a)[0]
}

/** Evaluación de la versión actual. */
export function latestEvaluation(a: Artifact): Evaluation | undefined {
  return latestVersion(a)?.evaluations?.[0]
}

/** Evaluación de la versión anterior (para comparar puntajes). */
export function previousEvaluation(a: Artifact): Evaluation | undefined {
  return sortedVersions(a)[1]?.evaluations?.[0]
}

/** Puntaje global de la versión actual, o undefined si aún no hay. */
export function artifactScore(a: Artifact): number | undefined {
  const ev = latestEvaluation(a)
  return ev?.decision === 'MANUAL_REVIEW' ? undefined : ev?.overall_score
}

export function teacherName(a: Artifact): string {
  return a.profiles?.full_name ?? '—'
}
export function subjectName(a: Artifact): string {
  return a.subjects?.name ?? '—'
}

/** Todos los puntajes de un conjunto de artifacts (aplanados). */
export function allScores(list: Artifact[]): number[] {
  return list.flatMap(a => (a.artifact_versions ?? [])
    .flatMap(v => (v.evaluations ?? []).filter(e => e.decision !== 'MANUAL_REVIEW').map(e => e.overall_score)))
}

export function averageScore(list: Artifact[]): number | null {
  const s = allScores(list)
  return s.length ? Math.round(s.reduce((acc, x) => acc + x, 0) / s.length) : null
}

/** Contexto de contenido (IA) de la versión actual; el más reciente como respaldo. */
export function latestContext(a: Artifact): ArtifactContext | undefined {
  const ctxs = a.artifact_contexts ?? []
  if (!ctxs.length) return undefined
  const currentId = latestVersion(a)?.id
  const match = currentId && ctxs.find(c => c.version_id === currentId)
  const chosen = match || [...ctxs].sort((x, y) => +new Date(y.created_at) - +new Date(x.created_at))[0]
  return chosen?.context
}

/** Aula/sección legible de la evidencia ("4° A"), o "—" si no hay. */
export function classroomName(a: Artifact): string {
  const g = a.student_groups
  return g ? `${g.grade} ${g.name}`.trim() : '—'
}

/** ¿La versión actual de la entrega cuenta como válida (superó umbral y coherencia)? */
export function isValid(a: Artifact): boolean {
  return latestVersion(a)?.is_valid ?? false
}

/** Motivo por el que la entrega no es válida (apto para el docente), o undefined si lo es. */
export function invalidReason(a: Artifact): string | undefined {
  const v = latestVersion(a)
  return v && v.is_valid === false ? (v.invalid_reason ?? undefined) : undefined
}

/** Una unidad de aprendizaje junto con las sesiones registradas dentro de ella. */
export type UnitWithSessions = { unit: Artifact; sessions: Artifact[] }

/**
 * Agrupa las entregas del docente: cada unidad (MONTHLY_UNIT) con sus sesiones
 * (DAILY_SESSION ligadas por `unit_id`), ordenadas de la más reciente a la más antigua.
 */
export function unitsWithSessions(list: Artifact[]): UnitWithSessions[] {
  const byDateDesc = (x: Artifact, y: Artifact) =>
    +new Date(y.created_at) - +new Date(x.created_at)
  const sessions = list.filter(a => a.type === 'DAILY_SESSION')
  return list
    .filter(a => a.type === 'MONTHLY_UNIT')
    .sort(byDateDesc)
    .map(unit => ({
      unit,
      sessions: sessions.filter(s => s.unit_id === unit.unit_id).sort(byDateDesc),
    }))
}

/** Conteos por estado para tarjetas de resumen. */
export function countByStatus(list: Artifact[]) {
  const count = (s: ArtifactStatus) => list.filter(a => a.status === s).length
  const approved = count('APPROVED')
  return {
    total: list.length,
    approved,
    revision: count('NEEDS_REVISION'),
    manual: count('MANUAL_REVIEW'),
    approvalRate: list.length ? Math.round((approved / list.length) * 100) : null,
  }
}
