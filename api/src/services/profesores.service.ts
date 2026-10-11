// Resumen de profesores para el panel UGEL: cruza el logro diagnóstico de sus
// secciones con su contexto sociodemográfico (vista vw_profesor_resumen) y lo
// reestructura en tarjetas listas para pintar (scores, %, distribución + card).
import { db } from '../infra/supabase.ts'
import { BUCKETS } from './mapa.service.ts'
// `nivelLogro` mapea un promedio 1-4 a C/B/A/AD; no confundir con el `nivelDe`
// local, que traduce el score compuesto 0-100 a su etiqueta de lectura.
import { COMPETENCIAS, nivelDe as nivelLogro, NIVEL_NOMBRE, type Codigo } from './alumnos.service.ts'

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
const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const round2 = (n: number) => Math.round(n * 100) / 100

function distribution(critico: number, intermedio: number, logrado: number, total: number) {
  return {
    critico: { count: critico, pct: pct(critico, total), color: BUCKETS.critico.color },
    intermedio: { count: intermedio, pct: pct(intermedio, total), color: BUCKETS.intermedio.color },
    logrado: { count: logrado, pct: pct(logrado, total), color: BUCKETS.logrado.color },
  }
}

// ── Scoring compuesto del docente ────────────────────────────────────────────
// Se calcula solo con lo que la evaluación diagnóstica ya dice de sus alumnos.
// Tres componentes en 0-100, más una lectura contextual. Las claves de la API
// se conservan; los nombres visibles están en web/src/config/scoringLabels.ts:
//   logro       — promedio diagnóstico del grupo, convertido de 1-4 a 0-100.
//   equidad     — proporción de estudiantes por encima de C (B, A o AD).
//   cobertura   — tamaño relativo del grupo evaluado frente al mayor grupo de
//                 profesor-área en la consulta; no es % de matrícula evaluada.
//   valor_agregado — su promedio menos el de su distrito (escala 1-4). Positivo =
//                 rinde por encima de lo esperable en su entorno. No entra en el
//                 global: es contexto, no mérito.
// global = 55% promedio diagnóstico + 30% estudiantes por encima de C
//        + 15% tamaño relativo del grupo evaluado.
const PESOS = { logro: 0.55, equidad: 0.3, cobertura: 0.15 } as const

// Etiquetas de lectura (acompañan, no sancionan — ver PRODUCT.md).
const NIVELES = [
  { key: 'destacado', label: 'Desempeño destacado', min: 75, color: '#2E7D32' },
  { key: 'esperado', label: 'Desempeño esperado', min: 60, color: '#43A047' },
  { key: 'en_progreso', label: 'En progreso', min: 45, color: '#FBC02D' },
  { key: 'acompanamiento', label: 'Prioridad de acompañamiento', min: 0, color: '#D32F2F' },
] as const

const nivelDe = (global: number) => NIVELES.find((n) => global >= n.min) ?? NIVELES[NIVELES.length - 1]

// Devuelve los profesores ordenados por score global (desc), con su distribución
// de niveles, los scorings derivados y la card de contexto sociodemográfico.
// `limit` acota cuántas tarjetas devolver (el mapa muestra 4 por defecto); el
// ranking y las referencias se calculan SIEMPRE sobre el total.
export async function buildProfesores(courseKey?: string, limit?: number) {
  let query = db.from('vw_profesor_resumen').select('*')
  if (courseKey) query = query.eq('course_key', courseKey)
  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as Row[]

  // Referencias para el valor agregado: promedio de la UGEL y de cada distrito,
  // ponderados por número de alumnos (no por docente).
  const alumnos = rows.reduce((n, r) => n + r.total, 0)
  const promedioUgel = alumnos ? round2(rows.reduce((s, r) => s + (r.promedio ?? 0) * r.total, 0) / alumnos) : null
  const porDistrito = new Map<string, { suma: number; total: number }>()
  for (const r of rows) {
    const d = r.district ?? '—'
    const acc = porDistrito.get(d) ?? { suma: 0, total: 0 }
    acc.suma += (r.promedio ?? 0) * r.total
    acc.total += r.total
    porDistrito.set(d, acc)
  }
  const promedioDistrito = new Map([...porDistrito].map(([d, a]) => [d, a.total ? round2(a.suma / a.total) : null]))
  const maxAlumnos = rows.reduce((m, r) => Math.max(m, r.total), 0)

  const profesores = rows
    .map((r) => {
      const promedio = r.promedio ?? 0
      const refDistrito = promedioDistrito.get(r.district ?? '—') ?? null
      // (promedio − 1) / 3: la escala de logro va de 1 (C) a 4 (AD).
      const logro = clamp100(((promedio - 1) / 3) * 100)
      const equidad = clamp100(100 - pct(r.critico, r.total))
      const cobertura = maxAlumnos ? clamp100((100 * r.total) / maxAlumnos) : 0
      const global = clamp100(PESOS.logro * logro + PESOS.equidad * equidad + PESOS.cobertura * cobertura)
      const nivel = nivelDe(global)
      return {
        dni: r.dni,
        full_name: r.full_name,
        course_key: r.course_key,
        course_name: r.course_name,
        total_evaluaciones: r.total,
        average_score_1_to_4: r.promedio,
        // % de estudiantes en nivel logrado (A/AD): indicador principal de la tarjeta.
        pct_logrado: pct(r.logrado, r.total),
        pct_critico: pct(r.critico, r.total),
        distribution: distribution(r.critico, r.intermedio, r.logrado, r.total),
        scores: {
          logro,
          equidad,
          cobertura,
          global,
          valor_agregado: refDistrito != null && r.promedio != null ? round2(r.promedio - refDistrito) : null,
          referencia_distrito: refDistrito,
          nivel: nivel.key,
          nivel_label: nivel.label,
          nivel_color: nivel.color,
        },
        contexto: {
          school_key: r.school_key,
          school_name: r.school_name,
          codigo_local: r.codigo_local,
          address: r.address,
          district: r.district,
          network_name: r.network_name,
          educational_levels: r.educational_levels ?? [],
        },
      }
    })
    .sort((a, b) => b.scores.global - a.scores.global || (b.average_score_1_to_4 ?? 0) - (a.average_score_1_to_4 ?? 0))
    .map((p, i) => ({ ...p, ranking: i + 1 }))

  return {
    course: courseKey ?? 'all',
    buckets: BUCKETS,
    total: profesores.length,
    // Cómo se compone el score, para poder explicarlo en la UI sin hardcodearlo.
    scoring: {
      pesos: PESOS,
      niveles: NIVELES,
      referencias: {
        promedio_ugel: promedioUgel,
        alumnos_evaluados: alumnos,
        max_alumnos_por_docente: maxAlumnos,
        promedio_por_distrito: Object.fromEntries(promedioDistrito),
      },
    },
    profesores: limit ? profesores.slice(0, limit) : profesores,
  }
}

// ── Ficha individual del docente ─────────────────────────────────────────────
// Todo lo que cuelga de él: aulas que dicta, evolución de las notas de sus
// alumnos, desglose por competencia, y sus unidades/sesiones/evidencias con el
// puntaje de cada evaluación. El scoring general es el mismo del listado, para
// que la ficha y el ranking no se contradigan.
type SerieProfRow = {
  alumno_id: string
  aula_id: string | null
  aula_nombre: string | null
  grado: string | null
  seccion: string | null
  turno: string | null
  colegio_nombre: string | null
  course_key: string
  curso_nombre: string | null
  dictado_id: string | null
  periodo_id: string
  periodo_nombre: string
  periodo_tipo: string
  fecha: string | null
  promedio: number | null
  nivel: Codigo | null
}

const media = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

function distribucionDeNiveles(niveles: (Codigo | null)[]) {
  const c = { critico: 0, intermedio: 0, logrado: 0 }
  for (const n of niveles) {
    if (n === 'C') c.critico += 1
    else if (n === 'B') c.intermedio += 1
    else if (n) c.logrado += 1
  }
  const total = c.critico + c.intermedio + c.logrado
  return distribution(c.critico, c.intermedio, c.logrado, total)
}

export async function buildProfesorDetalle(dni: string) {
  // El docente, con su scoring y ranking calculados sobre TODOS sus pares.
  const todos = await buildProfesores()
  const profesor = todos.profesores.find((p) => p.dni === dni)
  if (!profesor) return null

  const { data: usuarioRow } = await db
    .from('datos_personales').select('usuario_id, telefono').eq('dni', dni).maybeSingle()
  const profesorId = usuarioRow?.usuario_id as string | undefined
  if (!profesorId) return { ...emptyDetalle(), profesor, scoring: todos.scoring }

  // Serie de notas de sus alumnos (vista 012, filtrada por el docente).
  const serie: SerieProfRow[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db
      .from('vw_alumno_nota_periodo')
      .select('alumno_id, aula_id, aula_nombre, grado, seccion, turno, colegio_nombre, course_key, curso_nombre, dictado_id, periodo_id, periodo_nombre, periodo_tipo, fecha, promedio, nivel')
      .eq('profesor_id', profesorId)
      .range(desde, desde + 999)
    if (error) throw error
    serie.push(...((data ?? []) as SerieProfRow[]))
    if ((data?.length ?? 0) < 1000) break
  }

  // Aulas que dicta, con su scoring propio (logro + equidad del aula).
  const { data: dictadosData, error: dErr } = await db
    .from('dictados')
    .select('id, cursos(codigo, nombre), aulas(id, codigo, grado, seccion, turno, nivel, nombre, colegios(id, nombre)), periodos_academicos(nombre)')
    .eq('profesor_id', profesorId)
  if (dErr) throw dErr

  const aulas = ((dictadosData ?? []) as any[]).map((d) => {
    const delAula = serie.filter((s) => s.dictado_id === d.id)
    const diag = delAula.filter((s) => s.periodo_tipo === 'DIAGNOSTICO')
    const fechaMax = delAula.reduce((m, s) => (s.fecha && s.fecha > m ? s.fecha : m), '')
    const actual = delAula.filter((s) => s.fecha === fechaMax)
    const promedioActual = media(actual.map((s) => s.promedio ?? 0).filter(Boolean))
    const promedioDiag = media(diag.map((s) => s.promedio ?? 0).filter(Boolean))
    const dist = distribucionDeNiveles(actual.map((s) => s.nivel))
    const totalActual = actual.length
    return {
      dictado_id: d.id,
      aula_id: d.aulas?.id ?? null,
      aula_nombre: d.aulas?.nombre ?? [d.aulas?.grado, d.aulas?.seccion].filter(Boolean).join(' '),
      grado: d.aulas?.grado ?? null,
      seccion: d.aulas?.seccion ?? null,
      turno: d.aulas?.turno ?? null,
      nivel: d.aulas?.nivel ?? null,
      colegio_id: d.aulas?.colegios?.id ?? null,
      colegio_nombre: d.aulas?.colegios?.nombre ?? null,
      course_key: d.cursos?.codigo ?? null,
      curso_nombre: d.cursos?.nombre ?? null,
      periodo: d.periodos_academicos?.nombre ?? null,
      alumnos: new Set(delAula.map((s) => s.alumno_id)).size,
      promedio_diagnostico: promedioDiag,
      promedio_actual: promedioActual,
      avance: promedioActual != null && promedioDiag != null ? round2(promedioActual - promedioDiag) : null,
      distribution: dist,
      scores: {
        logro: promedioActual != null ? clamp100(((promedioActual - 1) / 3) * 100) : 0,
        equidad: clamp100(100 - pct(dist.critico.count, totalActual)),
      },
    }
  })

  // Evolución agregada de sus alumnos.
  const porPeriodo = new Map<string, { periodo_id: string; nombre: string; tipo: string; fecha: string | null; promedios: number[]; niveles: (Codigo | null)[] }>()
  for (const s of serie) {
    const p = porPeriodo.get(s.periodo_id)
      ?? { periodo_id: s.periodo_id, nombre: s.periodo_nombre, tipo: s.periodo_tipo, fecha: s.fecha, promedios: [], niveles: [] }
    if (s.promedio != null) p.promedios.push(s.promedio)
    p.niveles.push(s.nivel)
    porPeriodo.set(s.periodo_id, p)
  }
  const evolucion = [...porPeriodo.values()]
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
    .map((p) => ({
      periodo_id: p.periodo_id, periodo: p.nombre, tipo: p.tipo, fecha: p.fecha,
      alumnos: p.promedios.length, promedio: media(p.promedios), distribution: distribucionDeNiveles(p.niveles),
    }))

  // Desglose por competencia (todas las notas de sus dictados menos GENERAL).
  const dictadoIds = (dictadosData ?? []).map((d: any) => d.id)
  const notas: any[] = []
  if (dictadoIds.length) {
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await db
        .from('notas')
        .select('competencia, puntaje_numerico, cursos(codigo), periodos_academicos(id, nombre, fecha_fin, tipo), escala_logro(codigo)')
        .in('dictado_id', dictadoIds)
        .neq('competencia', 'GENERAL')
        .range(desde, desde + 999)
      if (error) throw error
      notas.push(...(data ?? []))
      if ((data?.length ?? 0) < 1000) break
    }
  }
  const porComp = new Map<string, { codigo: string; course_key: string; puntajes: number[]; niveles: (Codigo | null)[] }>()
  for (const n of notas) {
    const key = `${n.cursos?.codigo}|${n.competencia}`
    const c = porComp.get(key) ?? { codigo: n.competencia, course_key: n.cursos?.codigo ?? '', puntajes: [], niveles: [] }
    if (n.puntaje_numerico != null) c.puntajes.push(Number(n.puntaje_numerico))
    c.niveles.push((n.escala_logro?.codigo ?? null) as Codigo | null)
    porComp.set(key, c)
  }
  const competencias = [...porComp.values()]
    .sort((a, b) => a.course_key.localeCompare(b.course_key) || a.codigo.localeCompare(b.codigo))
    .map((c) => {
      const promedio = media(c.puntajes)
      return {
        codigo: c.codigo,
        course_key: c.course_key,
        nombre: COMPETENCIAS[c.course_key]?.[c.codigo] ?? c.codigo,
        registros: c.puntajes.length,
        promedio,
        nivel: nivelLogro(promedio),
        nivel_nombre: nivelLogro(promedio) ? NIVEL_NOMBRE[nivelLogro(promedio)!] : null,
        distribution: distribucionDeNiveles(c.niveles),
      }
    })

  // Unidades → sesiones → evidencias con el puntaje de su evaluación.
  const { data: unidadesData, error: uErr } = await db
    .from('unidades')
    .select(`id, nombre, orden, created_at, dictado_id,
             dictados(cursos(nombre), aulas(grado, seccion, nombre)),
             sesiones(id, nombre, fecha, orden),
             evidencias(id, estado, version_actual, created_at,
                        evidencia_versiones(version, estado, es_valida, created_at,
                                            evaluaciones(puntaje_total, decision, resumen)))`)
    .in('dictado_id', dictadoIds.length ? dictadoIds : ['00000000-0000-0000-0000-000000000000'])
  if (uErr) throw uErr

  const unidades = ((unidadesData ?? []) as any[]).map((u) => {
    const evidencias = (u.evidencias ?? []).map((e: any) => {
      const versiones = [...(e.evidencia_versiones ?? [])].sort((a: any, b: any) => b.version - a.version)
      const evaluacion = versiones.flatMap((v: any) => v.evaluaciones ?? [])[0] ?? null
      return {
        id: e.id, estado: e.estado, version_actual: e.version_actual, created_at: e.created_at,
        puntaje: evaluacion?.decision === 'MANUAL_REVIEW' ? null : evaluacion?.puntaje_total ?? null,
        decision: evaluacion?.decision ?? null,
        resumen: evaluacion?.resumen ?? null,
        versiones: versiones.length,
      }
    })
    const puntajes = evidencias.map((e: any) => e.puntaje).filter((p: number | null) => p != null) as number[]
    return {
      id: u.id, nombre: u.nombre, orden: u.orden, created_at: u.created_at,
      curso_nombre: u.dictados?.cursos?.nombre ?? null,
      aula_nombre: u.dictados?.aulas?.nombre ?? [u.dictados?.aulas?.grado, u.dictados?.aulas?.seccion].filter(Boolean).join(' '),
      sesiones: (u.sesiones ?? []).map((s: any) => ({ id: s.id, nombre: s.nombre, fecha: s.fecha, orden: s.orden })),
      evidencias,
      puntaje: puntajes.length ? Math.round(puntajes.reduce((a, b) => a + b, 0) / puntajes.length) : null,
    }
  }).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  const puntajesEvidencia = unidades.flatMap((u) => u.evidencias.map((e: any) => e.puntaje)).filter((p) => p != null) as number[]
  const totalEvidencias = unidades.reduce((n, u) => n + u.evidencias.length, 0)
  const observadas = unidades.flatMap((u) => u.evidencias).filter((e: any) => e.estado === 'NEEDS_REVISION').length

  return {
    profesor,
    scoring: todos.scoring,
    contacto: { dni, telefono: usuarioRow?.telefono ?? null },
    totales: {
      aulas: aulas.length,
      alumnos: new Set(serie.map((s) => s.alumno_id)).size,
      notas: serie.length,
      periodos: porPeriodo.size,
      unidades: unidades.length,
      sesiones: unidades.reduce((n, u) => n + u.sesiones.length, 0),
      evidencias: totalEvidencias,
      evidencias_observadas: observadas,
      puntaje_evidencias: puntajesEvidencia.length
        ? Math.round(puntajesEvidencia.reduce((a, b) => a + b, 0) / puntajesEvidencia.length) : null,
    },
    aulas,
    evolucion,
    competencias,
    unidades,
  }
}

function emptyDetalle() {
  return {
    contacto: { dni: '', telefono: null as string | null },
    totales: { aulas: 0, alumnos: 0, notas: 0, periodos: 0, unidades: 0, sesiones: 0, evidencias: 0, evidencias_observadas: 0, puntaje_evidencias: null as number | null },
    aulas: [] as unknown[], evolucion: [] as unknown[], competencias: [] as unknown[], unidades: [] as unknown[],
  }
}
