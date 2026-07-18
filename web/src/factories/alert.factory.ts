// ─────────────────────────────────────────────────────────────
// Factory de Alert — reglas de estado y campos derivados.
// ─────────────────────────────────────────────────────────────
import type { Alert } from '@/types'

const CLOSED = ['DISMISSED', 'RESOLVED']

export function isClosed(a: Alert): boolean {
  return CLOSED.includes(a.status)
}

/** Alertas aún activas (no descartadas ni resueltas). */
export function activeAlerts(list: Alert[]): Alert[] {
  return list.filter(a => !isClosed(a))
}

export function newCount(list: Alert[]): number {
  return list.filter(a => a.status === 'NEW').length
}

export function institutionName(a: Alert): string {
  return a.institutions?.name ?? ''
}
