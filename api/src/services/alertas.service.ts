// Motor de alertas: evalúa reglas sobre los datos ya cargados (notas por
// periodo, evidencias evaluadas) y materializa las situaciones que merecen
// atención en la tabla `alertas`.
//
// Diseño:
//   · Cada regla es declarativa (código, nombre, qué mira, umbrales) y devuelve
//     candidatas con una `clave` determinista. La clave permite reejecutar el
//     motor sin duplicar: si ya existe una alerta abierta con esa clave, se
//     omite. Si el usuario la resolvió o descartó y el problema reaparece, se
//     crea una nueva (el historial de que ocurrió otra vez es información).
//   · `evaluar({ dryRun: true })` devuelve lo que haría sin escribir nada, para
//     poder previsualizar desde la UI.
//   · El lenguaje sigue PRODUCT.md: acompaña, no acusa. Y el grano por defecto
//     es agregado (aula/colegio/docente), no el alumno individual.
import { db } from '../infra/supabase.ts'

// ── Catálogo de reglas ───────────────────────────────────────────────────────
export type SeveridadKey = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export const REGLAS = [
  {
    codigo: 'LOW_GRADE_GROUP',
    nombre: 'Aula con alta concentración en «En inicio»',
    descripcion: 'Marca las aulas donde una parte grande del grupo sigue en el nivel más bajo en la última evaluación.',
    fuente: 'vw_periodo_aula_resumen',
    umbral_default: 30,
    umbral_unidad: '% de alumnos en inicio',
  },
  {
    codigo: 'GRADE_DROP',
    nombre: 'Caída del promedio entre periodos',
    descripcion: 'Compara la última evaluación con la anterior y marca las aulas que retrocedieron.',
    fuente: 'vw_periodo_aula_resumen',
    umbral_default: 0.25,
    umbral_unidad: 'puntos de caída (escala 1-4)',
  },
  {
    codigo: 'REPEATED_INVALID_UNITS',
    nombre: 'Evidencias observadas de forma recurrente',
    descripcion: 'Docentes con varias entregas que necesitaron corrección; sugiere acompañamiento, no sanción.',
    fuente: 'evidencias + evaluaciones',
    umbral_default: 2,
    umbral_unidad: 'evidencias por corregir',
  },
  {
    codigo: 'NO_EVIDENCE',
    nombre: 'Aula sin evidencias registradas',
    descripcion: 'Dictados que no tienen ninguna evidencia subida en el año.',
    fuente: 'dictados + unidades',
    umbral_default: 0,
    umbral_unidad: 'evidencias registradas',
  },
  {
    codigo: 'COMPETENCE_GAP',
    nombre: 'Competencia rezagada en el colegio',
    descripcion: 'Competencia del CNEB cuyo promedio queda muy por debajo del resto en una institución.',
    fuente: 'notas por competencia',
    umbral_default: 2.1,
    umbral_unidad: 'promedio mínimo (escala 1-4)',
  },
] as const

export type ReglaCodigo = (typeof REGLAS)[number]['codigo']

type Candidata = {
  clave: string
  tipo: ReglaCodigo
  severidad: SeveridadKey
  colegio_id: string | null
  titulo: string
  resumen: string
  accion_sugerida: string
  evidencia: Record<string, unknown>
}

const round2 = (n: number) => Math.round(n * 100) / 100
const pct = (n: number, total: number) => (total ? Math.round((1000 * n) / total) / 10 : 0)

async function todas<T>(tabla: string, cols: string, tweak?: (q: any) => any): Promise<T[]> {
  const out: T[] = []
  for (let desde = 0; ; desde += 1000) {
    let q = db.from(tabla).select(cols)
    if (tweak) q = tweak(q)
    const { data, error } = await q.range(desde, desde + 999)
    if (error) throw new Error(`${tabla}: ${error.message}`)
    out.push(...((data ?? []) as T[]))
    if ((data?.length ?? 0) < 1000) break
  }
  return out
}

// ── Reglas ───────────────────────────────────────────────────────────────────
type PeriodoAula = {
  periodo_id: string; periodo_nombre: string; fecha: string | null
  colegio_id: string | null; colegio_nombre: string | null
  aula_id: string | null; aula_nombre: string | null; turno: string | null
  course_key: string; curso_nombre: string | null
  profesor_id: string | null; profesor_nombre: string | null
  alumnos: number; en_inicio: number; en_proceso: number; logrado: number; promedio: number | null
}

// R1 · Aulas donde demasiados alumnos siguen en el nivel más bajo.
function reglaBajoLogro(filas: PeriodoAula[], umbral: number): Candidata[] {
  const fechaMax = filas.reduce((m, f) => (f.fecha && f.fecha > m ? f.fecha : m), '')
  return filas
    .filter((f) => f.fecha === fechaMax && f.alumnos > 0 && pct(f.en_inicio, f.alumnos) >= umbral)
    .map((f) => {
      const porcentaje = pct(f.en_inicio, f.alumnos)
      return {
        clave: `LOW_GRADE_GROUP|${f.aula_id}|${f.course_key}|${f.periodo_id}`,
        tipo: 'LOW_GRADE_GROUP' as const,
        severidad: (porcentaje >= 45 ? 'HIGH' : 'MEDIUM') as SeveridadKey,
        colegio_id: f.colegio_id,
        titulo: `${f.aula_nombre ?? 'Aula'} necesita refuerzo en ${f.curso_nombre ?? f.course_key}`,
        resumen: `En ${f.periodo_nombre}, ${f.en_inicio} de ${f.alumnos} estudiantes (${porcentaje}%) de ${f.aula_nombre ?? 'el aula'} están en nivel «En inicio» en ${f.curso_nombre ?? f.course_key}. El promedio del grupo es ${f.promedio ?? '—'}/4.`,
        accion_sugerida: 'Coordinar con el docente un plan de refuerzo focalizado y revisar las estrategias de retroalimentación en las próximas sesiones.',
        evidencia: {
          aula_id: f.aula_id, aula: f.aula_nombre, turno: f.turno, course_key: f.course_key,
          periodo: f.periodo_nombre, alumnos: f.alumnos, en_inicio: f.en_inicio,
          pct_en_inicio: porcentaje, promedio: f.promedio,
          profesor_id: f.profesor_id, profesor: f.profesor_nombre,
        },
      }
    })
}

// R2 · Aulas cuyo promedio bajó respecto de la evaluación anterior.
function reglaCaida(filas: PeriodoAula[], umbral: number): Candidata[] {
  const fechas = [...new Set(filas.map((f) => f.fecha).filter(Boolean) as string[])].sort()
  if (fechas.length < 2) return []
  const [anterior, ultima] = [fechas[fechas.length - 2], fechas[fechas.length - 1]]
  const previas = new Map(filas.filter((f) => f.fecha === anterior).map((f) => [`${f.aula_id}|${f.course_key}`, f]))

  const out: Candidata[] = []
  for (const f of filas.filter((x) => x.fecha === ultima)) {
    const prev = previas.get(`${f.aula_id}|${f.course_key}`)
    if (!prev || f.promedio == null || prev.promedio == null) continue
    const caida = round2(prev.promedio - f.promedio)
    if (caida < umbral) continue
    out.push({
      clave: `GRADE_DROP|${f.aula_id}|${f.course_key}|${f.periodo_id}`,
      tipo: 'GRADE_DROP',
      severidad: (caida >= 0.5 ? 'HIGH' : 'MEDIUM') as SeveridadKey,
      colegio_id: f.colegio_id,
      titulo: `Retroceso en ${f.curso_nombre ?? f.course_key} · ${f.aula_nombre ?? 'aula'}`,
      resumen: `El promedio de ${f.aula_nombre ?? 'el aula'} en ${f.curso_nombre ?? f.course_key} bajó de ${prev.promedio} a ${f.promedio} (−${caida}) entre ${prev.periodo_nombre} y ${f.periodo_nombre}.`,
      accion_sugerida: 'Revisar con el docente qué cambió en el periodo (contenidos, asistencia, instrumentos) antes de definir el acompañamiento.',
      evidencia: {
        aula_id: f.aula_id, aula: f.aula_nombre, course_key: f.course_key,
        periodo_anterior: prev.periodo_nombre, promedio_anterior: prev.promedio,
        periodo_actual: f.periodo_nombre, promedio_actual: f.promedio, caida,
        profesor_id: f.profesor_id, profesor: f.profesor_nombre,
      },
    })
  }
  return out
}

// R3 · Docentes con varias evidencias que necesitaron corrección.
async function reglaEvidenciasObservadas(umbral: number): Promise<Candidata[]> {
  const evidencias = await todas<any>('evidencias', 'id, estado, profesor_id, created_at, usuarios(nombre_completo, colegio_id, colegios(nombre))')
  const porDocente = new Map<string, { nombre: string; colegio_id: string | null; colegio: string | null; total: number; observadas: number }>()
  for (const e of evidencias) {
    if (!e.profesor_id) continue
    const acc = porDocente.get(e.profesor_id) ?? {
      nombre: e.usuarios?.nombre_completo ?? '—',
      colegio_id: e.usuarios?.colegio_id ?? null,
      colegio: e.usuarios?.colegios?.nombre ?? null,
      total: 0, observadas: 0,
    }
    acc.total += 1
    if (e.estado === 'NEEDS_REVISION') acc.observadas += 1
    porDocente.set(e.profesor_id, acc)
  }
  return [...porDocente.entries()]
    .filter(([, a]) => a.observadas >= umbral)
    .map(([profesorId, a]) => ({
      clave: `REPEATED_INVALID_UNITS|${profesorId}|${a.observadas}`,
      tipo: 'REPEATED_INVALID_UNITS' as const,
      severidad: (a.observadas >= 4 ? 'HIGH' : 'MEDIUM') as SeveridadKey,
      colegio_id: a.colegio_id,
      titulo: `${a.nombre} acumula entregas por corregir`,
      resumen: `${a.observadas} de sus ${a.total} evidencias quedaron observadas por la evaluación. Suele indicar una dificultad concreta de planificación, no falta de trabajo.`,
      accion_sugerida: 'Programar acompañamiento pedagógico sobre los criterios que se repiten en las observaciones.',
      evidencia: { profesor_id: profesorId, profesor: a.nombre, colegio: a.colegio, evidencias: a.total, observadas: a.observadas },
    }))
}

// R4 · Aulas sin ninguna evidencia registrada, AGRUPADAS POR INSTITUCIÓN.
// Una alerta por dictado daría decenas de avisos idénticos y ahogaría el panel;
// además el grano que le sirve a la UGEL es la institución (ver PRODUCT.md).
async function reglaSinEvidencia(): Promise<Candidata[]> {
  const dictados = await todas<any>('dictados', 'id, cursos(codigo, nombre), aulas(id, nombre, grado, seccion, colegio_id, colegios(nombre)), usuarios:profesor_id(id, nombre_completo), unidades(id, evidencias(id))')
  const vacios = dictados.filter((d) => (d.unidades ?? []).every((u: any) => (u.evidencias ?? []).length === 0))

  type ItemVacio = { dictado_id: string; aula: string | null; curso: string | null; profesor_id: string | null; profesor: string | null }
  const porColegio = new Map<string, { colegio: string | null; items: ItemVacio[] }>()
  for (const d of vacios) {
    const colegioId = d.aulas?.colegio_id
    if (!colegioId) continue
    const acc = porColegio.get(colegioId) ?? { colegio: d.aulas?.colegios?.nombre ?? null, items: [] }
    acc.items.push({
      dictado_id: d.id, aula: d.aulas?.nombre, curso: d.cursos?.nombre,
      profesor_id: d.usuarios?.id, profesor: d.usuarios?.nombre_completo,
    })
    porColegio.set(colegioId, acc)
  }

  return [...porColegio.entries()].map(([colegioId, a]) => {
    const docentes = new Set(a.items.map((i: any) => i.profesor).filter(Boolean))
    return {
      clave: `NO_EVIDENCE|${colegioId}|${a.items.length}`,
      tipo: 'NO_EVIDENCE' as const,
      severidad: (a.items.length >= 4 ? 'MEDIUM' : 'LOW') as SeveridadKey,
      colegio_id: colegioId,
      titulo: `${a.items.length} aula${a.items.length !== 1 ? 's' : ''} sin evidencias en ${a.colegio ?? 'la institución'}`,
      resumen: `${a.items.length} dictado${a.items.length !== 1 ? 's' : ''} de ${a.colegio ?? 'la institución'} (${docentes.size} docente${docentes.size !== 1 ? 's' : ''}) todavía no registran evidencias este año. Sin entregas no hay retroalimentación que devolver.`,
      accion_sugerida: 'Confirmar con la dirección que los docentes tienen acceso a la plataforma y recordar el calendario de entregas.',
      evidencia: { colegio_id: colegioId, colegio: a.colegio, aulas_sin_evidencia: a.items.length, docentes: [...docentes], detalle: a.items },
    }
  })
}

// R5 · Competencias rezagadas dentro de un colegio.
async function reglaCompetencia(umbral: number): Promise<Candidata[]> {
  const notas = await todas<any>('notas', 'competencia, puntaje_numerico, curso_id, cursos(codigo, nombre), alumnos(colegio_id, colegios(nombre))', (q: any) =>
    q.neq('competencia', 'GENERAL').eq('tipo_evaluacion', 'DIAGNOSTICO'))
  const acc = new Map<string, { colegio_id: string; colegio: string | null; curso: string | null; course_key: string; competencia: string; suma: number; n: number }>()
  for (const n of notas) {
    const colegioId = n.alumnos?.colegio_id
    if (!colegioId || n.puntaje_numerico == null) continue
    const key = `${colegioId}|${n.cursos?.codigo}|${n.competencia}`
    const a = acc.get(key) ?? {
      colegio_id: colegioId, colegio: n.alumnos?.colegios?.nombre ?? null,
      curso: n.cursos?.nombre ?? null, course_key: n.cursos?.codigo ?? '', competencia: n.competencia, suma: 0, n: 0,
    }
    a.suma += Number(n.puntaje_numerico); a.n += 1
    acc.set(key, a)
  }
  return [...acc.values()]
    .map((a) => ({ ...a, promedio: round2(a.suma / a.n) }))
    .filter((a) => a.n >= 20 && a.promedio <= umbral)
    .map((a) => ({
      clave: `COMPETENCE_GAP|${a.colegio_id}|${a.course_key}|${a.competencia}`,
      tipo: 'COMPETENCE_GAP' as const,
      severidad: (a.promedio <= 1.8 ? 'HIGH' : 'MEDIUM') as SeveridadKey,
      colegio_id: a.colegio_id,
      titulo: `${a.competencia} de ${a.curso ?? ''} rezagada en ${a.colegio ?? 'la institución'}`.trim(),
      resumen: `La competencia ${a.competencia} de ${a.curso ?? 'el área'} promedia ${a.promedio}/4 sobre ${a.n} evaluaciones en el diagnóstico de la institución.`,
      accion_sugerida: 'Priorizar esta competencia en la planificación del siguiente bimestre y compartir materiales de apoyo con el equipo docente.',
      evidencia: { colegio_id: a.colegio_id, colegio: a.colegio, curso: a.curso, competencia: a.competencia, promedio: a.promedio, evaluaciones: a.n },
    }))
}

// ── Evaluación del motor ─────────────────────────────────────────────────────
export type OpcionesEvaluacion = {
  dryRun?: boolean
  reglas?: ReglaCodigo[]
  umbrales?: Partial<Record<ReglaCodigo, number>>
}

const ABIERTOS = ['NEW', 'UNDER_REVIEW', 'ESCALATED']

export async function evaluarAlertas(opts: OpcionesEvaluacion = {}) {
  const activas = opts.reglas?.length ? new Set<string>(opts.reglas) : new Set(REGLAS.map((r) => r.codigo))
  const umbral = (codigo: ReglaCodigo) =>
    opts.umbrales?.[codigo] ?? REGLAS.find((r) => r.codigo === codigo)!.umbral_default

  const necesitaPeriodos = activas.has('LOW_GRADE_GROUP') || activas.has('GRADE_DROP')
  const periodos = necesitaPeriodos ? await todas<PeriodoAula>('vw_periodo_aula_resumen', '*') : []

  const candidatas: Candidata[] = []
  const porRegla: Record<string, number> = {}
  const registrar = (codigo: string, lista: Candidata[]) => {
    porRegla[codigo] = lista.length
    candidatas.push(...lista)
  }

  if (activas.has('LOW_GRADE_GROUP')) registrar('LOW_GRADE_GROUP', reglaBajoLogro(periodos, umbral('LOW_GRADE_GROUP')))
  if (activas.has('GRADE_DROP')) registrar('GRADE_DROP', reglaCaida(periodos, umbral('GRADE_DROP')))
  if (activas.has('REPEATED_INVALID_UNITS')) registrar('REPEATED_INVALID_UNITS', await reglaEvidenciasObservadas(umbral('REPEATED_INVALID_UNITS')))
  if (activas.has('NO_EVIDENCE')) registrar('NO_EVIDENCE', await reglaSinEvidencia())
  if (activas.has('COMPETENCE_GAP')) registrar('COMPETENCE_GAP', await reglaCompetencia(umbral('COMPETENCE_GAP')))

  // Deduplicación: no se recrea una alerta cuya clave ya está abierta.
  const existentes = await todas<any>('alertas', 'id, estado, evidencia')
  const abiertas = new Set(
    existentes.filter((a) => ABIERTOS.includes(a.estado)).map((a) => a.evidencia?.clave).filter(Boolean),
  )
  const nuevas = candidatas.filter((c) => !abiertas.has(c.clave))
  const omitidas = candidatas.length - nuevas.length

  let creadas: any[] = []
  if (!opts.dryRun && nuevas.length) {
    const filas = nuevas.map((c) => ({
      tipo: c.tipo, severidad: c.severidad, estado: 'NEW', colegio_id: c.colegio_id,
      titulo: c.titulo, resumen: c.resumen, accion_sugerida: c.accion_sugerida,
      evidencia: { ...c.evidencia, clave: c.clave, regla: c.tipo, generada_por: 'motor' },
      historial: [{ estado: 'NEW', motivo: 'Generada por el motor de alertas', at: new Date().toISOString() }],
      es_sintetico: false,
    }))
    for (let i = 0; i < filas.length; i += 200) {
      const { data, error } = await db.from('alertas').insert(filas.slice(i, i + 200)).select('id, tipo, severidad, titulo')
      if (error) throw new Error(`alertas: ${error.message}`)
      creadas = creadas.concat(data ?? [])
    }
  }

  return {
    dry_run: !!opts.dryRun,
    evaluadas: [...activas],
    umbrales: Object.fromEntries([...activas].map((c) => [c, umbral(c as ReglaCodigo)])),
    candidatas: candidatas.length,
    por_regla: porRegla,
    omitidas_por_duplicado: omitidas,
    creadas: opts.dryRun ? 0 : creadas.length,
    // En dry run se devuelve el detalle para poder previsualizarlo en la UI.
    detalle: nuevas.map((c) => ({
      tipo: c.tipo, severidad: c.severidad, titulo: c.titulo, resumen: c.resumen,
      accion_sugerida: c.accion_sugerida, colegio_id: c.colegio_id, evidencia: c.evidencia,
    })),
  }
}

// ── Listado con estadísticas ─────────────────────────────────────────────────
export async function buildAlertas(opts: { estado?: string; severidad?: string; tipo?: string; colegio?: string } = {}) {
  const filas = await todas<any>('alertas', '*, colegios(id, nombre)')

  const cuenta = <T extends string>(campo: (a: any) => T) => {
    const m: Record<string, number> = {}
    for (const a of filas) m[campo(a)] = (m[campo(a)] ?? 0) + 1
    return m
  }

  const filtradas = filas.filter((a) => {
    if (opts.estado && a.estado !== opts.estado) return false
    if (opts.severidad && a.severidad !== opts.severidad) return false
    if (opts.tipo && a.tipo !== opts.tipo) return false
    if (opts.colegio && a.colegio_id !== opts.colegio) return false
    return true
  })

  return {
    total: filas.length,
    totals: {
      total: filas.length,
      abiertas: filas.filter((a) => ABIERTOS.includes(a.estado)).length,
      nuevas: filas.filter((a) => a.estado === 'NEW').length,
      criticas: filas.filter((a) => ['HIGH', 'CRITICAL'].includes(a.severidad) && ABIERTOS.includes(a.estado)).length,
      colegios: new Set(filas.map((a) => a.colegio_id).filter(Boolean)).size,
    },
    por_estado: cuenta((a) => a.estado),
    por_severidad: cuenta((a) => a.severidad),
    por_tipo: cuenta((a) => a.tipo),
    reglas: REGLAS,
    alertas: filtradas
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((a) => ({
        id: a.id, tipo: a.tipo, severidad: a.severidad, estado: a.estado,
        titulo: a.titulo, resumen: a.resumen, accion_sugerida: a.accion_sugerida,
        colegio_id: a.colegio_id, colegio_nombre: a.colegios?.nombre ?? null,
        evidencia: a.evidencia ?? {}, historial: a.historial ?? [],
        origen: a.evidencia?.generada_por === 'motor' ? 'motor' : a.es_sintetico ? 'seed' : 'manual',
        created_at: a.created_at,
      })),
  }
}

// ── Alta manual (probar el sistema) y cambio de estado ───────────────────────
export async function crearAlerta(input: {
  tipo: string; severidad: SeveridadKey; colegio_id?: string | null
  titulo: string; resumen: string; accion_sugerida: string; evidencia?: Record<string, unknown>
}) {
  const { data, error } = await db.from('alertas').insert({
    tipo: input.tipo, severidad: input.severidad, estado: 'NEW', colegio_id: input.colegio_id ?? null,
    titulo: input.titulo, resumen: input.resumen, accion_sugerida: input.accion_sugerida,
    evidencia: { ...(input.evidencia ?? {}), generada_por: 'manual' },
    historial: [{ estado: 'NEW', motivo: 'Alerta creada manualmente', at: new Date().toISOString() }],
    es_sintetico: false,
  }).select('*').single()
  if (error) throw new Error(`alertas: ${error.message}`)
  return data
}

// El trigger `alertas_audit` ya registra el cambio en logs_auditoria; aquí se
// añade además al `historial` de la propia alerta, que hasta ahora nunca se
// llenaba y es lo que la UI puede mostrar.
export async function cambiarEstadoAlerta(id: string, estado: string, motivo?: string) {
  const { data: actual, error: e1 } = await db.from('alertas').select('historial, estado').eq('id', id).maybeSingle()
  if (e1) throw new Error(`alertas: ${e1.message}`)
  if (!actual) return null
  const historial = [...(actual.historial ?? []), {
    estado, desde: actual.estado, motivo: motivo ?? null, at: new Date().toISOString(),
  }]
  const { data, error } = await db.from('alertas').update({ estado, historial }).eq('id', id).select('*').single()
  if (error) throw new Error(`alertas: ${error.message}`)
  return data
}

// Borra las alertas generadas por el motor o manualmente (limpieza de pruebas).
export async function limpiarAlertas(origen: 'motor' | 'manual' | 'todas') {
  const filas = await todas<any>('alertas', 'id, evidencia, es_sintetico')
  const objetivo = filas.filter((a) => {
    const gen = a.evidencia?.generada_por
    if (origen === 'todas') return !a.es_sintetico
    return gen === origen
  })
  if (!objetivo.length) return { borradas: 0 }
  const ids = objetivo.map((a) => a.id)
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db.from('alertas').delete().in('id', ids.slice(i, i + 200))
    if (error) throw new Error(`alertas: ${error.message}`)
  }
  return { borradas: ids.length }
}
