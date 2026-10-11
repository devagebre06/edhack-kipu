// ─────────────────────────────────────────────────────────────
// Factory de Evaluation — `criteria` puede ser la Ficha nueva
// (objeto) o el formato legacy (array de criterios). Este es el
// único lugar que decide cuál es cuál.
// ─────────────────────────────────────────────────────────────
import type { Criterion, Evaluation, Ficha, RubricaKipu } from '@/types'

/** Devuelve la Ficha de monitoreo si la evaluación usa ese formato. */
export function getFicha(ev: Evaluation): Ficha | null {
  const c = ev.criteria
  return !Array.isArray(c) && Array.isArray((c as Ficha)?.desempenos) ? (c as Ficha) : null
}

/** Rúbrica vigente de ocho criterios; las fichas anteriores conservan su vista histórica. */
export function getRubricaKipu(ev: Evaluation): RubricaKipu | null {
  const c = ev.criteria
  return !Array.isArray(c) && c?.version?.startsWith('planificacion-4primaria.') ? c as RubricaKipu : null
}

/** Devuelve los criterios legacy si la evaluación usa ese formato.
 *  Normaliza campos opcionales (evidence/feedback) para que la vista nunca
 *  reviente si un criterio viene incompleto (p. ej. data de demo). */
export function getLegacyCriteria(ev: Evaluation): Criterion[] {
  return Array.isArray(ev.criteria)
    ? ev.criteria.map(c => ({ ...c, evidence: c.evidence ?? [], feedback: c.feedback ?? '' }))
    : []
}

/** Diferencia de puntaje frente a una evaluación previa. */
export function scoreDelta(ev: Evaluation, prev?: Evaluation): number | null {
  if (!prev || ev.decision === 'MANUAL_REVIEW' || prev.decision === 'MANUAL_REVIEW') return null
  return ev.overall_score - prev.overall_score
}

/** Items de la ficha agrupados por dimensión (A, B, C, D). */
export function fichaItemsByDimension(ficha: Ficha) {
  return ['A', 'B', 'C', 'D'].map(d => [d, ficha.items.filter(it => it.dimension === d)] as const)
}
