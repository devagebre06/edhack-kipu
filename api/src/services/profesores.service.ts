// Resumen de profesores para el panel UGEL: cruza el logro diagnóstico de sus
// secciones con su contexto sociodemográfico (vista ugel06_profesor_resumen) y
// lo reestructura en tarjetas listas para pintar (score, %, distribución + card).
import { db } from '../infra/supabase.ts'
import { BUCKETS } from './mapa.service.ts'

type Row = {
  dni: string
  full_name: string
  course_key: string
  course_name: string | null
  school_key: string | null
  school_name: string | null
  codigo_local: string | null
  address: string | null
  district: string | null
  network_key: string | null
  network_name: string | null
  educational_levels: string[] | null
  total: number
  critico: number
  intermedio: number
  logrado: number
  promedio: number | null
}

const pct = (n: number, total: number) => (total ? Math.round((1000 * n) / total) / 10 : 0)

function distribution(critico: number, intermedio: number, logrado: number, total: number) {
  return {
    critico: { count: critico, pct: pct(critico, total), color: BUCKETS.critico.color },
    intermedio: { count: intermedio, pct: pct(intermedio, total), color: BUCKETS.intermedio.color },
    logrado: { count: logrado, pct: pct(logrado, total), color: BUCKETS.logrado.color },
  }
}

// Devuelve los profesores ordenados por promedio de logro (desc), con su
// distribución de niveles y la card de contexto sociodemográfico.
// `limit` acota cuántas tarjetas devolver (el panel muestra 4 por defecto).
export async function buildProfesores(courseKey?: string, limit?: number) {
  let query = db.from('vw_profesor_resumen').select('*')
  if (courseKey) query = query.eq('course_key', courseKey)
  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as Row[]
  const profesores = rows
    .map((r) => ({
      dni: r.dni,
      full_name: r.full_name,
      course_key: r.course_key,
      course_name: r.course_name,
      total_evaluaciones: r.total,
      average_score_1_to_4: r.promedio,
      // % de estudiantes en nivel logrado (A/AD): indicador principal de la tarjeta.
      pct_logrado: pct(r.logrado, r.total),
      distribution: distribution(r.critico, r.intermedio, r.logrado, r.total),
      contexto: {
        school_key: r.school_key,
        school_name: r.school_name,
        codigo_local: r.codigo_local,
        address: r.address,
        district: r.district,
        network_name: r.network_name,
        educational_levels: r.educational_levels ?? [],
      },
    }))
    .sort((a, b) => (b.average_score_1_to_4 ?? 0) - (a.average_score_1_to_4 ?? 0))

  return {
    course: courseKey ?? 'all',
    buckets: BUCKETS,
    total: profesores.length,
    profesores: limit ? profesores.slice(0, limit) : profesores,
  }
}
