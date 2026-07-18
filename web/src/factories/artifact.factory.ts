// ─────────────────────────────────────────────────────────────
// Factory de Artifact — única capa que conoce la forma anidada
// (artifact → versions → evaluations). Si esa forma cambia, se
// corrige AQUÍ y ninguna vista se rompe.
// ─────────────────────────────────────────────────────────────
import type { Artifact, ArtifactStatus, ArtifactVersion, Evaluation } from '@/types'

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
  return latestEvaluation(a)?.overall_score
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
    .flatMap(v => (v.evaluations ?? []).map(e => e.overall_score)))
}

export function averageScore(list: Artifact[]): number | null {
  const s = allScores(list)
  return s.length ? Math.round(s.reduce((acc, x) => acc + x, 0) / s.length) : null
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
