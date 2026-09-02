// ─────────────────────────────────────────────────────────────
// Factory de tableros — transforma data cruda en las series que
// consumen los paneles de directivo y UGEL (barras, progreso, etc.).
// ─────────────────────────────────────────────────────────────
import type { Artifact, AulaResumen, Institution, Profile } from '@/types'
import { allScores } from './artifact.factory'

/** Avance por docente: aprobadas vs total, ordenado de menor a mayor %. */
export function progressByTeacher(teachers: Profile[], artifacts: Artifact[]) {
  return teachers.map(t => {
    const arts = artifacts.filter(a => a.teacher_id === t.id)
    const ok = arts.filter(a => a.status === 'APPROVED').length
    return {
      name: t.full_name,
      total: arts.length,
      ok,
      pct: arts.length ? Math.round((ok / arts.length) * 100) : null,
    }
  }).sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1))
}

/** Score promedio y % de invalidez por institución (barras UGEL).
 *  Solo las instituciones CON entregas: la UGEL 06 tiene 166 colegios y las que
 *  no han subido nada dejan el gráfico lleno de barras en cero. */
export function metricsByInstitution(institutions: Institution[], artifacts: Artifact[]) {
  return institutions.map(inst => {
    const arts = artifacts.filter(a => a.institution_id === inst.id)
    const scores = allScores(arts)
    return {
      name: inst.name.replace('I.E. ', ''),
      entregas: arts.length,
      invalidez: arts.length ? Math.round(100 * arts.filter(a => a.status === 'NEEDS_REVISION').length / arts.length) : 0,
      score: scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0,
    }
  }).filter(i => i.entregas > 0).sort((a, b) => b.score - a.score)
}

/** Aulas ordenadas por proporción de estudiantes en nivel "En inicio" (C).
 *  `promedio` va en la escala de logro 1-4 (C=1 · B=2 · A=3 · AD=4). */
export function lowGradeGroups(aulas: AulaResumen[]) {
  return aulas
    .filter(a => a.total > 0)
    .map(a => ({
      id: `${a.aula_id}-${a.course_key}`,
      label: [a.aula_nombre, a.turno].filter(Boolean).join(' · '),
      colegio: a.colegio_nombre ?? '—',
      curso: a.curso_nombre ?? a.course_key,
      avg: a.promedio.toFixed(2),
      under: Math.round((100 * a.en_inicio) / a.total),
    }))
    .sort((a, b) => b.under - a.under || Number(a.avg) - Number(b.avg))
}
