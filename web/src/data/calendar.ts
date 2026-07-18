// ─────────────────────────────────────────────────────────────
// Calendario pedagógico 2026 — 4.to primaria · Matemática y Comunicación.
// Data estática del front (calendario escolar MINEDU 2026). Define qué
// debe subirse, en qué fecha y de qué tipo. En producción parte vendría
// del schedule del docente.
// ─────────────────────────────────────────────────────────────
import type { ArtifactType } from '@/types'

export type CalSubject = 'MAT' | 'COM' | 'AMBOS'
export type CalItem = {
  date: string          // YYYY-MM-DD
  type: ArtifactType
  label: string
  subject: CalSubject
  bimestre?: number
  optional?: boolean
}
export type Bimestre = { num: number; label: string; start: string; end: string }

export const BIMESTRES: Bimestre[] = [
  { num: 1, label: '1.er Bimestre', start: '2026-03-16', end: '2026-05-22' },
  { num: 2, label: '2.do Bimestre', start: '2026-06-01', end: '2026-07-31' },
  { num: 3, label: '3.er Bimestre', start: '2026-08-17', end: '2026-10-16' },
  { num: 4, label: '4.to Bimestre', start: '2026-10-19', end: '2026-12-18' },
]

export const CALENDAR: CalItem[] = [
  // ── Unidades (MONTHLY_UNIT) — inicio de cada mes escolar ──
  { date: '2026-03-20', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Marzo (Mat)', subject: 'MAT', bimestre: 1 },
  { date: '2026-03-20', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Marzo (Com)', subject: 'COM', bimestre: 1 },
  { date: '2026-04-20', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Abril (Mat)', subject: 'MAT', bimestre: 1 },
  { date: '2026-04-20', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Abril (Com)', subject: 'COM', bimestre: 1 },
  { date: '2026-05-18', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Mayo (Mat)', subject: 'MAT', bimestre: 1 },
  { date: '2026-05-18', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Mayo (Com)', subject: 'COM', bimestre: 1 },
  { date: '2026-06-03', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Junio (Mat)', subject: 'MAT', bimestre: 2 },
  { date: '2026-06-03', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Junio (Com)', subject: 'COM', bimestre: 2 },
  { date: '2026-07-01', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Julio (Mat)', subject: 'MAT', bimestre: 2 },
  { date: '2026-07-01', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Julio (Com)', subject: 'COM', bimestre: 2 },
  { date: '2026-08-19', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Agosto (Mat)', subject: 'MAT', bimestre: 3 },
  { date: '2026-08-19', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Agosto (Com)', subject: 'COM', bimestre: 3 },
  { date: '2026-09-18', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Setiembre (Mat)', subject: 'MAT', bimestre: 3 },
  { date: '2026-09-18', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Setiembre (Com)', subject: 'COM', bimestre: 3 },
  { date: '2026-10-14', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Octubre (Mat)', subject: 'MAT', bimestre: 3 },
  { date: '2026-10-14', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Octubre (Com)', subject: 'COM', bimestre: 3 },
  { date: '2026-10-21', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Nov (Mat)', subject: 'MAT', bimestre: 4 },
  { date: '2026-10-21', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Nov (Com)', subject: 'COM', bimestre: 4 },
  { date: '2026-11-18', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Nov 2.ª quincena (Mat)', subject: 'MAT', bimestre: 4 },
  { date: '2026-11-18', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Nov 2.ª quincena (Com)', subject: 'COM', bimestre: 4 },
  { date: '2026-12-09', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Diciembre (Mat)', subject: 'MAT', bimestre: 4 },
  { date: '2026-12-09', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Diciembre (Com)', subject: 'COM', bimestre: 4 },

  // ── Registro de notas bimestral (BIMONTHLY_GRADES) ──
  { date: '2026-05-22', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 1.er Bimestre (Mat)', subject: 'MAT', bimestre: 1 },
  { date: '2026-05-22', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 1.er Bimestre (Com)', subject: 'COM', bimestre: 1 },
  { date: '2026-07-31', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 2.do Bimestre (Mat)', subject: 'MAT', bimestre: 2 },
  { date: '2026-07-31', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 2.do Bimestre (Com)', subject: 'COM', bimestre: 2 },
  { date: '2026-10-16', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 3.er Bimestre (Mat)', subject: 'MAT', bimestre: 3 },
  { date: '2026-10-16', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 3.er Bimestre (Com)', subject: 'COM', bimestre: 3 },
  { date: '2026-12-18', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 4.to Bimestre (Mat)', subject: 'MAT', bimestre: 4 },
  { date: '2026-12-18', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 4.to Bimestre (Com)', subject: 'COM', bimestre: 4 },

  // ── Balance anual (ANNUAL_GRADE_SUMMARY) ──
  { date: '2026-12-18', type: 'ANNUAL_GRADE_SUMMARY', label: 'Balance anual de notas (Mat)', subject: 'MAT' },
  { date: '2026-12-18', type: 'ANNUAL_GRADE_SUMMARY', label: 'Balance anual de notas (Com)', subject: 'COM' },
]

export const TYPE_DOT: Record<ArtifactType, string> = {
  DAILY_SESSION: 'bg-ok',
  MONTHLY_UNIT: 'bg-nav',
  BIMONTHLY_GRADES: 'bg-warn',
  ANNUAL_GRADE_SUMMARY: 'bg-bad',
}
export const SUBJECT_LABEL: Record<CalSubject, string> = { MAT: 'Matemática', COM: 'Comunicación', AMBOS: 'Ambos' }

// ── Derivaciones puras del calendario ──
export function groupByDate(items: CalItem[]): Map<string, CalItem[]> {
  const map = new Map<string, CalItem[]>()
  for (const it of items) {
    const arr = map.get(it.date) ?? []
    arr.push(it)
    map.set(it.date, arr)
  }
  return map
}

export function groupByBimestre(grouped: Map<string, CalItem[]>) {
  const res: { bim: Bimestre; dates: { date: string; items: CalItem[] }[] }[] = []
  for (const bim of BIMESTRES) {
    const dates: { date: string; items: CalItem[] }[] = []
    for (const [date, items] of grouped) {
      if (date >= bim.start && date <= bim.end) dates.push({ date, items })
    }
    dates.sort((a, b) => a.date.localeCompare(b.date))
    if (dates.length) res.push({ bim, dates })
  }
  const extra: { date: string; items: CalItem[] }[] = []
  for (const [date, items] of grouped) {
    if (!BIMESTRES.some(b => date >= b.start && date <= b.end)) extra.push({ date, items })
  }
  if (extra.length) {
    extra.sort((a, b) => a.date.localeCompare(b.date))
    res.push({ bim: { num: 0, label: 'Cierre anual', start: '2026-12-01', end: '2026-12-31' }, dates: extra })
  }
  return res
}

/** Nombre de curso completo a partir del código del calendario. */
export function calSubjectName(subject: CalSubject): string {
  return subject === 'MAT' ? 'Matemática' : subject === 'COM' ? 'Comunicación' : ''
}
