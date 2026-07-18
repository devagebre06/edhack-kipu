// ─────────────────────────────────────────────────────────────
// Factory de tableros — transforma data cruda en las series que
// consumen los paneles de directivo y UGEL (barras, progreso, etc.).
// ─────────────────────────────────────────────────────────────
import type { Artifact, GradeRecord, Institution, Profile } from '@/types'
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

/** Score promedio y % de invalidez por institución (barras UGEL). */
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
  })
}

/** Grupos con calificaciones preocupantes (promedio y % bajo la nota 11). */
export function lowGradeGroups(grades: GradeRecord[]) {
  const map = new Map<string, { label: string; scores: number[] }>()
  for (const g of grades) {
    if (!map.has(g.group_id)) {
      map.set(g.group_id, { label: `${g.student_groups.grade} ${g.student_groups.name}`, scores: [] })
    }
    map.get(g.group_id)!.scores.push(g.score)
  }
  return [...map.values()].map(g => ({
    label: g.label,
    avg: (g.scores.reduce((s, x) => s + x, 0) / g.scores.length).toFixed(1),
    under: Math.round(100 * g.scores.filter(s => s < 11).length / g.scores.length),
  })).sort((a, b) => b.under - a.under)
}
