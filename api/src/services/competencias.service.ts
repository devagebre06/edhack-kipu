// Competencias del docente: cómo va su grupo en cada una y cómo las está
// trabajando.
//
// Dos capas distintas:
//   · El DESEMPEÑO se calcula desde `notas` — es la única fuente de verdad de
//     las calificaciones y nunca se duplica aquí.
//   · El SEGUIMIENTO (estado de trabajo y plan) vive en `competencias_dictado`,
//     que es lo único que el docente gestiona (migración 015).
import { db } from '../infra/supabase.ts'
import { COMPETENCIAS, nivelDe, NIVEL_NOMBRE, type Codigo } from './alumnos.service.ts'
import { BUCKETS } from './mapa.service.ts'

export const ESTADOS = [
  { key: 'PENDIENTE', label: 'Sin empezar', descripcion: 'Aún no la has trabajado en el periodo.' },
  { key: 'FOCO', label: 'En foco', descripcion: 'Es la prioridad de tus sesiones ahora.' },
  { key: 'REFORZANDO', label: 'Reforzando', descripcion: 'La trabajaste y estás cerrando brechas.' },
  { key: 'CONSOLIDADA', label: 'Consolidada', descripcion: 'El grupo la alcanzó; solo mantenimiento.' },
] as const

const pct = (n: number, total: number) => (total ? Math.round((1000 * n) / total) / 10 : 0)
const round2 = (n: number) => Math.round(n * 100) / 100
const media = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

type NotaRow = {
  competencia: string
  puntaje_numerico: number | null
  dictado_id: string | null
  escala_logro: { codigo: Codigo } | null
  periodos_academicos: { id: string; nombre: string; tipo: string; fecha_fin: string | null } | null
}

/** Competencias de cada dictado del docente, con desempeño y seguimiento. */
export async function getCompetenciasDocente(profesorId: string) {
  const { data: dictados, error } = await db
    .from('dictados')
    .select('id, cursos(codigo, nombre), aulas(id, nombre, grado, seccion, turno, colegios(nombre))')
    .eq('profesor_id', profesorId) as any
  if (error) throw new Error(`dictados: ${error.message}`)
  const lista = (dictados ?? []) as any[]
  if (!lista.length) return { estados: ESTADOS, buckets: BUCKETS, dictados: [] }

  const ids = lista.map((d) => d.id)

  // Notas por competencia de esos dictados (sin GENERAL: aquí interesa el detalle).
  const notas: NotaRow[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error: nErr } = await db
      .from('notas')
      .select('competencia, puntaje_numerico, dictado_id, escala_logro(codigo), periodos_academicos(id, nombre, tipo, fecha_fin)')
      .in('dictado_id', ids)
      .neq('competencia', 'GENERAL')
      .range(desde, desde + 999) as any
    if (nErr) throw new Error(`notas: ${nErr.message}`)
    notas.push(...((data ?? []) as NotaRow[]))
    if ((data?.length ?? 0) < 1000) break
  }

  // Seguimiento guardado.
  const { data: seguimiento } = await db
    .from('competencias_dictado').select('dictado_id, competencia, estado, nota, updated_at').in('dictado_id', ids)
  const guardado = new Map(
    (seguimiento ?? []).map((s: any) => [`${s.dictado_id}|${s.competencia}`, s]),
  )

  // Último periodo evaluado (para leer «cómo va ahora» y compararlo con el inicio).
  const fechaMax = notas.reduce((m, n) => {
    const f = n.periodos_academicos?.fecha_fin
    return f && f > m ? f : m
  }, '')

  const salida = lista.map((d) => {
    const courseKey: string = d.cursos?.codigo ?? ''
    const delDictado = notas.filter((n) => n.dictado_id === d.id)

    const competencias = Object.entries(COMPETENCIAS[courseKey] ?? {}).map(([codigo, nombre]) => {
      const propias = delDictado.filter((n) => n.competencia === codigo)
      const actual = propias.filter((n) => n.periodos_academicos?.fecha_fin === fechaMax)
      const diagnostico = propias.filter((n) => n.periodos_academicos?.tipo === 'DIAGNOSTICO')

      const valores = actual.map((n) => Number(n.puntaje_numerico)).filter((v) => !Number.isNaN(v))
      const promedio = media(valores)
      const promedioDiag = media(diagnostico.map((n) => Number(n.puntaje_numerico)).filter((v) => !Number.isNaN(v)))

      const conteo = { critico: 0, intermedio: 0, logrado: 0 }
      for (const n of actual) {
        const c = n.escala_logro?.codigo
        if (c === 'C') conteo.critico += 1
        else if (c === 'B') conteo.intermedio += 1
        else if (c) conteo.logrado += 1
      }
      const total = conteo.critico + conteo.intermedio + conteo.logrado
      const s = guardado.get(`${d.id}|${codigo}`)

      return {
        codigo,
        nombre,
        alumnos: total,
        promedio,
        promedio_diagnostico: promedioDiag,
        avance: promedio != null && promedioDiag != null ? round2(promedio - promedioDiag) : null,
        nivel: nivelDe(promedio),
        nivel_nombre: nivelDe(promedio) ? NIVEL_NOMBRE[nivelDe(promedio)!] : null,
        distribution: {
          critico: { count: conteo.critico, pct: pct(conteo.critico, total), color: BUCKETS.critico.color },
          intermedio: { count: conteo.intermedio, pct: pct(conteo.intermedio, total), color: BUCKETS.intermedio.color },
          logrado: { count: conteo.logrado, pct: pct(conteo.logrado, total), color: BUCKETS.logrado.color },
        },
        // Lo que el docente gestiona.
        estado: s?.estado ?? 'PENDIENTE',
        nota: s?.nota ?? '',
        actualizado: s?.updated_at ?? null,
      }
    })

    return {
      dictado_id: d.id,
      curso: d.cursos?.nombre ?? null,
      course_key: courseKey,
      aula: d.aulas?.nombre ?? [d.aulas?.grado, d.aulas?.seccion].filter(Boolean).join(' '),
      turno: d.aulas?.turno ?? null,
      colegio: d.aulas?.colegios?.nombre ?? null,
      competencias,
    }
  })

  return { estados: ESTADOS, buckets: BUCKETS, dictados: salida }
}

/** Guarda el seguimiento de una competencia (estado y/o plan). */
export async function guardarCompetencia(profesorId: string, input: {
  dictado_id: string; competencia: string; estado?: string; nota?: string
}) {
  const { data: dictado } = await db
    .from('dictados').select('id, profesor_id, cursos(codigo)').eq('id', input.dictado_id).maybeSingle() as any
  if (!dictado) return { error: 'El dictado no existe.' as const }
  if (dictado.profesor_id !== profesorId) return { error: 'Ese dictado no te pertenece.' as const }

  const validas = Object.keys(COMPETENCIAS[dictado.cursos?.codigo ?? ''] ?? {})
  if (!validas.includes(input.competencia)) return { error: 'Esa competencia no es de este curso.' as const }
  if (input.estado && !ESTADOS.some((e) => e.key === input.estado)) {
    return { error: 'Estado inválido.' as const }
  }

  const fila: Record<string, unknown> = { dictado_id: input.dictado_id, competencia: input.competencia }
  if (input.estado !== undefined) fila.estado = input.estado
  if (input.nota !== undefined) fila.nota = input.nota.trim() || null

  const { data, error } = await db
    .from('competencias_dictado')
    .upsert(fila, { onConflict: 'dictado_id,competencia' })
    .select('dictado_id, competencia, estado, nota, updated_at')
    .single()
  if (error) throw new Error(`competencias_dictado: ${error.message}`)
  return { ok: true as const, competencia: data }
}
