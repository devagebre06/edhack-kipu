// Registro de notas del docente: leer la nómina de un aula para un periodo y
// guardar las calificaciones por competencia.
//
// El docente solo puede tocar sus propios dictados: toda operación verifica que
// el dictado le pertenece antes de leer o escribir. Las escrituras van por aquí
// (service_role) porque `notas` no tiene policy de INSERT: el front nunca
// escribe directo.
//
// La nota GENERAL no se pide al docente: se calcula como el promedio de las
// competencias que registró, igual que en la data diagnóstica.
import { db } from '../infra/supabase.ts'
import { COMPETENCIAS, nivelDe, NIVEL_NOMBRE, type Codigo } from './alumnos.service.ts'

const VALOR: Record<Codigo, number> = { C: 1, B: 2, A: 3, AD: 4 }
export const CODIGOS_VALIDOS = Object.keys(VALOR) as Codigo[]

/** Tipo de evaluación que corresponde al periodo (la columna es libre en la DB). */
const tipoDe = (tipoPeriodo: string) => (tipoPeriodo === 'DIAGNOSTICO' ? 'DIAGNOSTICO' : 'BIMESTRAL')

/** Verifica que el dictado existe y es del docente; devuelve su contexto. */
async function dictadoDelDocente(profesorId: string, dictadoId: string) {
  const { data, error } = await db
    .from('dictados')
    .select('id, profesor_id, periodo_id, cursos(id, codigo, nombre), aulas(id, nombre, grado, seccion, turno, colegio_id, colegios(nombre))')
    .eq('id', dictadoId)
    .maybeSingle() as any
  if (error) throw new Error(`dictados: ${error.message}`)
  if (!data) return { error: 'El dictado no existe.' as const }
  if (data.profesor_id !== profesorId) return { error: 'Ese dictado no te pertenece.' as const }
  return { dictado: data }
}

/** Periodos disponibles para registrar (los del año, del más reciente al inicio). */
export async function listarPeriodos() {
  const { data, error } = await db
    .from('periodos_academicos')
    .select('id, nombre, tipo, bimestre, anio, fecha_inicio, fecha_fin')
    .order('anio', { ascending: false })
    .order('fecha_fin', { ascending: true, nullsFirst: true })
  if (error) throw new Error(`periodos_academicos: ${error.message}`)
  return data ?? []
}

// ── Lectura: nómina + competencias + lo ya registrado ────────────────────────
export async function getRegistro(profesorId: string, dictadoId: string, periodoId?: string) {
  const chequeo = await dictadoDelDocente(profesorId, dictadoId)
  if ('error' in chequeo) return chequeo
  const { dictado } = chequeo

  const periodos = await listarPeriodos()
  const periodo = periodos.find((p) => p.id === periodoId) ?? periodos.find((p) => p.id === dictado.periodo_id) ?? periodos[0]
  if (!periodo) return { error: 'No hay periodos académicos registrados.' as const }

  const courseKey: string = dictado.cursos?.codigo ?? ''
  const competencias = Object.entries(COMPETENCIAS[courseKey] ?? {}).map(([codigo, nombre]) => ({ codigo, nombre }))

  // Nómina: matriculados en el aula. Se busca en el periodo pedido y, si ahí no
  // hay matrícula (lo normal cuando solo se matriculó en el diagnóstico), se cae
  // al periodo del propio dictado.
  const alumnosDe = async (pid: string) => {
    const { data, error } = await db
      .from('matriculas')
      .select('alumno_id, alumnos(id, codigo, numero, nombre_completo)')
      .eq('aula_id', dictado.aulas?.id)
      .eq('periodo_id', pid) as any
    if (error) throw new Error(`matriculas: ${error.message}`)
    return data ?? []
  }
  let matriculas = await alumnosDe(periodo.id)
  if (!matriculas.length && periodo.id !== dictado.periodo_id) matriculas = await alumnosDe(dictado.periodo_id)

  const alumnos = matriculas
    .map((m: any) => m.alumnos)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.numero ?? 0) - (b.numero ?? 0) || a.nombre_completo.localeCompare(b.nombre_completo, 'es'))

  // Notas ya registradas para ese curso y periodo.
  const { data: notas, error: nErr } = await db
    .from('notas')
    .select('alumno_id, competencia, puntaje_numerico, escala_logro(codigo)')
    .eq('curso_id', dictado.cursos?.id)
    .eq('periodo_id', periodo.id)
    .in('alumno_id', alumnos.map((a: any) => a.id).length ? alumnos.map((a: any) => a.id) : ['00000000-0000-0000-0000-000000000000']) as any
  if (nErr) throw new Error(`notas: ${nErr.message}`)

  const registradas: Record<string, Record<string, string>> = {}
  for (const n of notas ?? []) {
    const codigo = n.escala_logro?.codigo
    if (!codigo || n.competencia === 'GENERAL') continue
    ;(registradas[n.alumno_id] ??= {})[n.competencia] = codigo
  }

  return {
    dictado: {
      id: dictado.id,
      curso: dictado.cursos?.nombre ?? null,
      course_key: courseKey,
      aula: dictado.aulas?.nombre ?? [dictado.aulas?.grado, dictado.aulas?.seccion].filter(Boolean).join(' '),
      grado: dictado.aulas?.grado ?? null,
      seccion: dictado.aulas?.seccion ?? null,
      turno: dictado.aulas?.turno ?? null,
      colegio: dictado.aulas?.colegios?.nombre ?? null,
    },
    periodo,
    periodos,
    escala: CODIGOS_VALIDOS.map((c) => ({ codigo: c, nombre: NIVEL_NOMBRE[c], valor: VALOR[c] })),
    competencias,
    alumnos: alumnos.map((a: any) => ({
      id: a.id, codigo: a.codigo, numero: a.numero, nombre: a.nombre_completo,
      notas: registradas[a.id] ?? {},
    })),
  }
}

// ── Escritura: guarda el registro completo de un dictado × periodo ───────────
export type FilaNotas = { alumno_id: string; notas: Record<string, string> }

export async function guardarRegistro(profesorId: string, input: {
  dictado_id: string; periodo_id: string; filas: FilaNotas[]
}) {
  const chequeo = await dictadoDelDocente(profesorId, input.dictado_id)
  if ('error' in chequeo) return chequeo
  const { dictado } = chequeo

  const { data: periodo } = await db.from('periodos_academicos').select('id, tipo, nombre').eq('id', input.periodo_id).maybeSingle()
  if (!periodo) return { error: 'El periodo no existe.' as const }

  const courseKey: string = dictado.cursos?.codigo ?? ''
  const validas = new Set(Object.keys(COMPETENCIAS[courseKey] ?? {}))

  // Los alumnos deben estar matriculados en el aula del dictado.
  const { data: matriculas } = await db.from('matriculas').select('alumno_id').eq('aula_id', dictado.aulas?.id) as any
  const permitidos = new Set((matriculas ?? []).map((m: any) => m.alumno_id))

  const { data: escalaRows } = await db.from('escala_logro').select('id, codigo')
  const escalaId = new Map((escalaRows ?? []).map((e: any) => [e.codigo, e.id]))

  const filas: any[] = []
  const errores: string[] = []
  for (const fila of input.filas) {
    if (!permitidos.has(fila.alumno_id)) { errores.push(`Un alumno no pertenece a esta aula.`); continue }
    const puntajes: number[] = []
    for (const [competencia, codigo] of Object.entries(fila.notas ?? {})) {
      if (!codigo) continue                                   // celda vacía: no se registra
      if (!validas.has(competencia)) { errores.push(`Competencia inválida: ${competencia}.`); continue }
      if (!CODIGOS_VALIDOS.includes(codigo as Codigo)) { errores.push(`Nivel inválido: ${codigo}.`); continue }
      puntajes.push(VALOR[codigo as Codigo])
      filas.push({
        alumno_id: fila.alumno_id, curso_id: dictado.cursos?.id, periodo_id: periodo.id,
        dictado_id: dictado.id, tipo_evaluacion: tipoDe(periodo.tipo), competencia,
        escala_id: escalaId.get(codigo), puntaje_numerico: VALOR[codigo as Codigo], es_sintetico: false,
      })
    }
    // GENERAL: promedio de lo registrado (no se le pide al docente).
    if (puntajes.length) {
      const promedio = puntajes.reduce((a, b) => a + b, 0) / puntajes.length
      const nivel = nivelDe(promedio)!
      filas.push({
        alumno_id: fila.alumno_id, curso_id: dictado.cursos?.id, periodo_id: periodo.id,
        dictado_id: dictado.id, tipo_evaluacion: tipoDe(periodo.tipo), competencia: 'GENERAL',
        escala_id: escalaId.get(nivel), puntaje_numerico: Math.round(promedio * 100) / 100,
        descripcion: NIVEL_NOMBRE[nivel], es_sintetico: false,
      })
    }
  }

  if (errores.length) return { error: [...new Set(errores)].join(' ') }
  if (!filas.length) return { error: 'No hay notas que guardar.' as const }

  // La unique (alumno, curso, periodo, tipo, competencia) permite reenviar el
  // registro corregido: se actualiza en vez de duplicar.
  let guardadas = 0
  for (let i = 0; i < filas.length; i += 500) {
    const lote = filas.slice(i, i + 500)
    const { error } = await db.from('notas').upsert(lote, {
      onConflict: 'alumno_id,curso_id,periodo_id,tipo_evaluacion,competencia',
    })
    if (error) throw new Error(`notas: ${error.message}`)
    guardadas += lote.length
  }

  return {
    ok: true as const,
    guardadas,
    alumnos: input.filas.length,
    periodo: periodo.nombre,
    curso: dictado.cursos?.nombre ?? null,
    aula: dictado.aulas?.nombre ?? null,
  }
}
