// Procesamiento de los datos diagnósticos UGEL 06 para el mapa.
// Lee la vista agregada ugel06_mapa_colegio_curso (grano colegio×curso) y la
// reestructura en features listos para pintar: un punto por colegio con la
// distribución de logro (crítico / intermedio / logrado) y el desglose por curso.
import { db } from '../infra/supabase.ts'

// Escala de logro → 3 buckets de color del mapa.
export const BUCKETS = {
  critico: { label: 'Crítico', grades: ['C'], color: '#D32F2F' },
  intermedio: { label: 'Intermedio', grades: ['B'], color: '#FBC02D' },
  logrado: { label: 'Logrado', grades: ['A', 'AD'], color: '#43A047' },
} as const

type Row = {
  school_key: string
  school_name: string
  latitud: number | null
  longitud: number | null
  network_key: string
  network_name: string
  district: string
  course_key: string
  course_name: string
  total: number
  critico: number
  intermedio: number
  logrado: number
  promedio: number | null
}

const pct = (n: number, total: number) => (total ? Math.round((1000 * n) / total) / 10 : 0)

// Bucket dominante (mayor conteo) → define el color del punto en el mapa.
function dominant(critico: number, intermedio: number, logrado: number) {
  const entries = [
    ['critico', critico],
    ['intermedio', intermedio],
    ['logrado', logrado],
  ] as const
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
}

function distribution(critico: number, intermedio: number, logrado: number, total: number) {
  return {
    critico: { count: critico, pct: pct(critico, total), color: BUCKETS.critico.color },
    intermedio: { count: intermedio, pct: pct(intermedio, total), color: BUCKETS.intermedio.color },
    logrado: { count: logrado, pct: pct(logrado, total), color: BUCKETS.logrado.color },
  }
}

export async function buildMapa(courseKey?: string) {
  let query = db.from('vw_mapa_colegio_curso').select('*')
  if (courseKey) query = query.eq('course_key', courseKey)
  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as Row[]

  // Agrupar por colegio (sumando cursos), guardando el desglose por curso.
  const schools = new Map<string, {
    school_key: string
    school_name: string
    latitude: number | null
    longitude: number | null
    network_key: string
    network_name: string
    district: string
    total: number
    critico: number
    intermedio: number
    logrado: number
    scoreSum: number
    courses: Array<Record<string, unknown>>
  }>()

  for (const r of rows) {
    let s = schools.get(r.school_key)
    if (!s) {
      s = {
        school_key: r.school_key, school_name: r.school_name,
        latitude: r.latitud, longitude: r.longitud,
        network_key: r.network_key, network_name: r.network_name, district: r.district,
        total: 0, critico: 0, intermedio: 0, logrado: 0, scoreSum: 0, courses: [],
      }
      schools.set(r.school_key, s)
    }
    s.total += r.total
    s.critico += r.critico
    s.intermedio += r.intermedio
    s.logrado += r.logrado
    s.scoreSum += (r.promedio ?? 0) * r.total
    s.courses.push({
      course_key: r.course_key,
      course_name: r.course_name,
      total: r.total,
      promedio: r.promedio,
      dominant: dominant(r.critico, r.intermedio, r.logrado),
      distribution: distribution(r.critico, r.intermedio, r.logrado, r.total),
    })
  }

  const colegios = [...schools.values()].map((s) => ({
    school_key: s.school_key,
    school_name: s.school_name,
    district: s.district,
    network_key: s.network_key,
    network_name: s.network_name,
    latitude: s.latitude,
    longitude: s.longitude,
    total_students: s.total,
    average_score_1_to_4: s.total ? Math.round((100 * s.scoreSum) / s.total) / 100 : null,
    dominant: dominant(s.critico, s.intermedio, s.logrado),
    distribution: distribution(s.critico, s.intermedio, s.logrado, s.total),
    courses: s.courses,
  }))

  // Roll-up por distrito para vista choropleth / resumen.
  const distMap = new Map<string, { district: string; total: number; critico: number; intermedio: number; logrado: number; schools: number }>()
  for (const s of schools.values()) {
    let d = distMap.get(s.district)
    if (!d) { d = { district: s.district, total: 0, critico: 0, intermedio: 0, logrado: 0, schools: 0 }; distMap.set(s.district, d) }
    d.total += s.total; d.critico += s.critico; d.intermedio += s.intermedio; d.logrado += s.logrado; d.schools += 1
  }
  const distritos = [...distMap.values()].map((d) => ({
    district: d.district,
    schools: d.schools,
    total_students: d.total,
    dominant: dominant(d.critico, d.intermedio, d.logrado),
    distribution: distribution(d.critico, d.intermedio, d.logrado, d.total),
  }))

  return {
    course: courseKey ?? 'all',
    buckets: BUCKETS,
    totals: {
      colegios: colegios.length,
      distritos: distritos.length,
      evaluaciones: colegios.reduce((n, c) => n + c.total_students, 0),
    },
    colegios,
    distritos,
  }
}
