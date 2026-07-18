// ─────────────────────────────────────────────────────────────
// Factory de Evaluation — `criteria` puede ser la Ficha nueva
// (objeto) o el formato legacy (array de criterios). Este es el
// único lugar que decide cuál es cuál.
// ─────────────────────────────────────────────────────────────
import type { Criterion, Evaluation, Ficha } from '@/types'

/** Devuelve la Ficha de monitoreo si la evaluación usa ese formato. */
export function getFicha(ev: Evaluation): Ficha | null {
  const c = ev.criteria
  return !Array.isArray(c) && (c as Ficha)?.items ? (c as Ficha) : null
}

/** Devuelve los criterios legacy si la evaluación usa ese formato. */
export function getLegacyCriteria(ev: Evaluation): Criterion[] {
  return Array.isArray(ev.criteria) ? ev.criteria : []
}

/** Diferencia de puntaje frente a una evaluación previa. */
export function scoreDelta(ev: Evaluation, prev?: Evaluation): number | null {
  if (!prev) return null
  return ev.overall_score - prev.overall_score
}

/** Items de la ficha agrupados por dimensión (A, B, C, D). */
export function fichaItemsByDimension(ficha: Ficha) {
  return ['A', 'B', 'C', 'D'].map(d => [d, ficha.items.filter(it => it.dimension === d)] as const)
}
