// Alumnos para el panel UGEL: listado con estadísticas agregadas y ficha
// individual con la evolución de sus notas en el tiempo.
//
// Lee las vistas de la migración 012:
//   vw_alumno_resumen      — una fila por alumno (diagnóstico → actual).
//   vw_alumno_nota_periodo — la serie: alumno × curso × periodo.
import { db } from '../infra/supabase.ts'
import { BUCKETS } from './mapa.service.ts'

const pct = (n: number, total: number) => (total ? Math.round((1000 * n) / total) / 10 : 0)
const round2 = (n: number) => Math.round(n * 100) / 100

// Escala de logro: promedio 1-4 → código cualitativo.
const CODIGOS = ['C', 'B', 'A', 'AD'] as const
export type Codigo = (typeof CODIGOS)[number]
export const NIVEL_NOMBRE: Record<Codigo, string> = {
  C: 'En inicio', B: 'En proceso', A: 'Logro esperado', AD: 'Logro destacado',
}
export function nivelDe(promedio: number | null): Codigo | null {
  if (promedio == null) return null
  return CODIGOS[Math.min(4, Math.max(1, Math.round(promedio))) - 1]
}
const bucketDe = (nivel: Codigo | null) =>
  nivel === 'C' ? 'critico' : nivel === 'B' ? 'intermedio' : nivel ? 'logrado' : null

// Competencias del CNEB por área (la DB guarda solo el código C1..C4).
export const COMPETENCIAS: Record<string, Record<string, string>> = {
  matematica: {
    C1: 'Resuelve problemas de cantidad',
    C2: 'Resuelve problemas de regularidad, equivalencia y cambio',
    C3: 'Resuelve problemas de forma, movimiento y localización',
    C4: 'Resuelve problemas de gestión de datos e incertidumbre',
  },
  comunicacion: {
    C1: 'Se comunica oralmente en su lengua materna',
    C2: 'Lee diversos tipos de textos escritos',
    C3: 'Escribe diversos tipos de textos',
  },
}

type ResumenRow = {
  alumno_id: string
  alumno_codigo: string | null
  alumno_nombre: string
  alumno_numero: number | null
  colegio_id: string | null
  colegio_nombre: string | null
  aula_id: string | null
  grado: string | null
  seccion: string | null
  turno: string | null
  aula_nombre: string | null
  notas: number
  periodos: number
  cursos: number
  promedio_diagnostico: number | null
  promedio_actual: number | null
  promedio_global: number | null
  fecha_ultima: string | null
}

type SerieRow = {
  alumno_id: string
  alumno_nombre: string
  alumno_codigo: string | null
  colegio_id: string | null
  colegio_nombre: string | null
  aula_id: string | null
  aula_nombre: string | null
  grado: string | null
  seccion: string | null
  turno: string | null
  curso_id: string
  course_key: string
  curso_nombre: string | null
  profesor_id: string | null
  profesor_nombre: string | null
  periodo_id: string
  periodo_nombre: string
  periodo_tipo: string
  bimestre: number | null
  fecha: string | null
  tipo_evaluacion: string
  promedio: number | null
  nivel: Codigo | null
  nivel_nombre: string | null
}

// Fila de vw_periodo_aula_resumen (migración 013): agregado periodo × aula × curso.
type AgregadoRow = {
  periodo_id: string
  periodo_nombre: string
  periodo_tipo: string
  bimestre: number | null
  fecha: string | null
  colegio_id: string | null
  aula_id: string | null
  course_key: string
  curso_nombre: string | null
  alumnos: number
  en_inicio: number
  en_proceso: number
  logrado: number
  promedio: number | null
}

// PostgREST devuelve 1 000 filas por consulta: se pagina siempre.
async function todas<T>(tabla: string, cols: string, tweak?: (q: any) => any): Promise<T[]> {
  const out: T[] = []
  for (let desde = 0; ; desde += 1000) {
    let q = db.from(tabla).select(cols)
    if (tweak) q = tweak(q)
    const { data, error } = await q.range(desde, desde + 999)
    if (error) throw error
    out.push(...((data ?? []) as T[]))
    if ((data?.length ?? 0) < 1000) break
  }
  return out
}

function distribucionDeNiveles(niveles: (Codigo | null)[]) {
  const conteo = { critico: 0, intermedio: 0, logrado: 0 }
  for (const n of niveles) {
    const b = bucketDe(n)
    if (b) conteo[b] += 1
  }
  const total = conteo.critico + conteo.intermedio + conteo.logrado
  return {
    critico: { count: conteo.critico, pct: pct(conteo.critico, total), color: BUCKETS.critico.color },
    intermedio: { count: conteo.intermedio, pct: pct(conteo.intermedio, total), color: BUCKETS.intermedio.color },
    logrado: { count: conteo.logrado, pct: pct(conteo.logrado, total), color: BUCKETS.logrado.color },
  }
}

// ── Listado + estadísticas generales ─────────────────────────────────────────
export async function buildAlumnos(opts: {
  search?: string; colegio?: string; aula?: string; limit?: number; offset?: number
} = {}) {
  const rows = await todas<ResumenRow>('vw_alumno_resumen', '*')

  // Filtros (en memoria: son 881 filas y evita repetir la consulta por faceta).
  const search = opts.search?.trim().toLowerCase()
  const filtrados = rows.filter((r) => {
    if (opts.colegio && r.colegio_id !== opts.colegio) return false
    if (opts.aula && r.aula_id !== opts.aula) return false
    if (search && !`${r.alumno_nombre} ${r.alumno_codigo ?? ''}`.toLowerCase().includes(search)) return false
    return true
  })

  const conNota = filtrados.filter((r) => r.promedio_actual != null)
  const promedioActual = conNota.length
    ? round2(conNota.reduce((s, r) => s + (r.promedio_actual ?? 0), 0) / conNota.length)
    : null
  const promedioDiagnostico = (() => {
    const c = filtrados.filter((r) => r.promedio_diagnostico != null)
    return c.length ? round2(c.reduce((s, r) => s + (r.promedio_diagnostico ?? 0), 0) / c.length) : null
  })()

  // Evolución agregada por periodo, desde la vista pre-agregada (300 filas):
  // traer el detalle alumno×periodo solo para dibujar la línea costaba segundos.
  // Los agregados respetan los filtros de colegio/aula; `search` no los altera a
  // propósito — buscar un nombre no debe redibujar el panorama del grupo.
  const agregados = await todas<AgregadoRow>('vw_periodo_aula_resumen', '*', (q: any) => {
    let r = q
    if (opts.colegio) r = r.eq('colegio_id', opts.colegio)
    if (opts.aula) r = r.eq('aula_id', opts.aula)
    return r
  })

  type Acc = { alumnos: number; suma: number; c: number; b: number; l: number }
  const nuevoAcc = (): Acc => ({ alumnos: 0, suma: 0, c: 0, b: 0, l: 0 })
  const suma = (acc: Acc, r: AgregadoRow) => {
    acc.alumnos += r.alumnos
    acc.suma += (r.promedio ?? 0) * r.alumnos
    acc.c += r.en_inicio; acc.b += r.en_proceso; acc.l += r.logrado
  }
  const distDe = (a: Acc) => ({
    critico: { count: a.c, pct: pct(a.c, a.alumnos), color: BUCKETS.critico.color },
    intermedio: { count: a.b, pct: pct(a.b, a.alumnos), color: BUCKETS.intermedio.color },
    logrado: { count: a.l, pct: pct(a.l, a.alumnos), color: BUCKETS.logrado.color },
  })
  const promDe = (a: Acc) => (a.alumnos ? round2(a.suma / a.alumnos) : null)

  const porPeriodo = new Map<string, { meta: AgregadoRow; acc: Acc }>()
  const porCurso = new Map<string, { meta: AgregadoRow; acc: Acc }>()
  for (const r of agregados) {
    const p = porPeriodo.get(r.periodo_id) ?? { meta: r, acc: nuevoAcc() }
    suma(p.acc, r); porPeriodo.set(r.periodo_id, p)
    const c = porCurso.get(r.course_key) ?? { meta: r, acc: nuevoAcc() }
    suma(c.acc, r); porCurso.set(r.course_key, c)
  }

  const evolucion = [...porPeriodo.values()]
    .sort((a, b) => String(a.meta.fecha).localeCompare(String(b.meta.fecha)))
    .map(({ meta, acc }) => ({
      periodo_id: meta.periodo_id, periodo_nombre: meta.periodo_nombre, fecha: meta.fecha, tipo: meta.periodo_tipo,
      alumnos: acc.alumnos, promedio: promDe(acc), distribution: distDe(acc),
    }))

  const cursos = [...porCurso.values()].map(({ meta, acc }) => ({
    course_key: meta.course_key, curso_nombre: meta.curso_nombre ?? meta.course_key,
    registros: acc.alumnos, promedio: promDe(acc), distribution: distDe(acc),
  }))

  // Avance individual: cuántos suben, se mantienen o bajan respecto al diagnóstico.
  const delta = filtrados
    .filter((r) => r.promedio_actual != null && r.promedio_diagnostico != null)
    .map((r) => round2((r.promedio_actual ?? 0) - (r.promedio_diagnostico ?? 0)))
  const avance = {
    suben: delta.filter((d) => d > 0.05).length,
    estables: delta.filter((d) => Math.abs(d) <= 0.05).length,
    bajan: delta.filter((d) => d < -0.05).length,
    promedio: delta.length ? round2(delta.reduce((a, b) => a + b, 0) / delta.length) : null,
  }

  const ordenados = [...filtrados].sort((a, b) => a.alumno_nombre.localeCompare(b.alumno_nombre, 'es'))
  const offset = opts.offset ?? 0
  const limit = opts.limit ?? 50

  return {
    buckets: BUCKETS,
    total: filtrados.length,
    totals: {
      alumnos: filtrados.length,
      colegios: new Set(filtrados.map((r) => r.colegio_id)).size,
      aulas: new Set(filtrados.map((r) => r.aula_id)).size,
      promedio_actual: promedioActual,
      promedio_diagnostico: promedioDiagnostico,
      avance_promedio: avance.promedio,
    },
    distribucion: distribucionDeNiveles(filtrados.map((r) => nivelDe(r.promedio_actual))),
    evolucion,
    cursos,
    avance,
    alumnos: ordenados.slice(offset, offset + limit).map((r) => ({
      ...r,
      nivel_actual: nivelDe(r.promedio_actual),
      nivel_actual_nombre: nivelDe(r.promedio_actual) ? NIVEL_NOMBRE[nivelDe(r.promedio_actual)!] : null,
      delta: r.promedio_actual != null && r.promedio_diagnostico != null
        ? round2(r.promedio_actual - r.promedio_diagnostico) : null,
    })),
  }
}

// ── Ficha individual ─────────────────────────────────────────────────────────
export async function buildAlumnoDetalle(alumnoId: string) {
  const { data: resumen, error: e1 } = await db.from('vw_alumno_resumen').select('*').eq('alumno_id', alumnoId).maybeSingle()
  if (e1) throw e1
  if (!resumen) return null
  const r = resumen as ResumenRow

  const { data: serieData, error: e2 } = await db.from('vw_alumno_nota_periodo').select('*').eq('alumno_id', alumnoId)
  if (e2) throw e2
  const serie = (serieData ?? []) as SerieRow[]

  // Notas por competencia (todas menos GENERAL), para el desglose por área.
  const { data: notasData, error: e3 } = await db
    .from('notas')
    .select('competencia, puntaje_numerico, tipo_evaluacion, cursos(codigo, nombre), periodos_academicos(id, nombre, fecha_fin, tipo), escala_logro(codigo, nombre)')
    .eq('alumno_id', alumnoId)
    .neq('competencia', 'GENERAL')
  if (e3) throw e3
  const notas = (notasData ?? []) as any[]

  const periodos = [...new Map(serie.map((s) => [s.periodo_id, {
    periodo_id: s.periodo_id, nombre: s.periodo_nombre, tipo: s.periodo_tipo, bimestre: s.bimestre, fecha: s.fecha,
  }])).values()].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))

  const cursos = [...new Map(serie.map((s) => [s.course_key, {
    course_key: s.course_key, curso_nombre: s.curso_nombre, profesor_id: s.profesor_id, profesor_nombre: s.profesor_nombre,
  }])).values()]

  // Serie "notas vs tiempo": un punto por periodo con la nota de cada área.
  const linea = periodos.map((p) => {
    const delPeriodo = serie.filter((s) => s.periodo_id === p.periodo_id)
    const valores = delPeriodo.filter((s) => s.promedio != null).map((s) => s.promedio as number)
    const punto: Record<string, unknown> = {
      periodo_id: p.periodo_id, periodo: p.nombre, fecha: p.fecha, tipo: p.tipo,
      promedio: valores.length ? round2(valores.reduce((a, b) => a + b, 0) / valores.length) : null,
    }
    for (const c of cursos) {
      const fila = delPeriodo.find((s) => s.course_key === c.course_key)
      punto[c.course_key] = fila?.promedio ?? null
      punto[`${c.course_key}_nivel`] = fila?.nivel ?? null
    }
    return punto
  })

  // Desglose por competencia y periodo.
  const competencias = cursos.map((c) => {
    const delCurso = notas.filter((n) => n.cursos?.codigo === c.course_key)
    const codigos = [...new Set(delCurso.map((n) => n.competencia as string))].sort()
    return {
      course_key: c.course_key,
      curso_nombre: c.curso_nombre,
      competencias: codigos.map((codigo) => ({
        codigo,
        nombre: COMPETENCIAS[c.course_key]?.[codigo] ?? codigo,
        periodos: periodos.map((p) => {
          const n = delCurso.find((x) => x.competencia === codigo && x.periodos_academicos?.id === p.periodo_id)
          return {
            periodo_id: p.periodo_id, periodo: p.nombre, fecha: p.fecha,
            puntaje: n?.puntaje_numerico ?? null, nivel: n?.escala_logro?.codigo ?? null,
          }
        }),
      })),
    }
  })

  const nivelActual = nivelDe(r.promedio_actual)
  return {
    buckets: BUCKETS,
    alumno: {
      ...r,
      nivel_actual: nivelActual,
      nivel_actual_nombre: nivelActual ? NIVEL_NOMBRE[nivelActual] : null,
      delta: r.promedio_actual != null && r.promedio_diagnostico != null
        ? round2(r.promedio_actual - r.promedio_diagnostico) : null,
    },
    docentes: cursos.map((c) => ({
      course_key: c.course_key, curso_nombre: c.curso_nombre,
      profesor_id: c.profesor_id, profesor_nombre: c.profesor_nombre,
    })),
    periodos,
    serie: linea,
    detalle: serie
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || a.course_key.localeCompare(b.course_key))
      .map((s) => ({
        periodo: s.periodo_nombre, fecha: s.fecha, tipo_evaluacion: s.tipo_evaluacion,
        course_key: s.course_key, curso_nombre: s.curso_nombre,
        promedio: s.promedio, nivel: s.nivel, nivel_nombre: s.nivel_nombre,
        profesor_nombre: s.profesor_nombre,
      })),
    competencias,
  }
}
