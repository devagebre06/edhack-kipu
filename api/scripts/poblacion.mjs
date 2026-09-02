// Migra la data (sintética) de UGEL 06 al MODELO UNIFICADO vía el adapter de
// ingesta. Mapea las llaves naturales externas (ugel_key, network_key,
// school_key, course_key, dni, section_key, student_key) a los uuid internos en
// `mapeo_llaves_externas`, de modo que un formato de datos nuevo se ingiera
// relacionando sus llaves contra las existentes. La data se marca es_sintetico.
//
// Fuentes:
//   data/ugel06_notas_diagnosticas_primaria.json            → aulas, alumnos y notas
//   data/ugel06_profesores_contexto_sociodemografico_30.json → contexto del colegio
//
// El dataset de notas replica la plantilla real de la evaluación diagnóstica de
// primaria (docs/privado/EV. DIAGNÓSTICA PRIMARIA.xlsx) y lo genera
// `scripts/generar-notas-diagnosticas.mjs`. Su unidad es el **aula** (grado +
// sección + turno, con una sola nómina de alumnos) evaluada en las dos áreas:
// cada acta (aula × área) es un `dictado` con su docente, y de cada alumno
// cuelgan las notas por competencia (matemática C1-C4, comunicación C1-C3) más
// la nota GENERAL.
//
// Orden: ugel → canal → colegio → curso → profesor(usuario) → aula → dictado →
//        alumno → matrícula → nota. Uso: npm run db:poblacion
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { db, ensureAuthUser } from './lib/client.mjs'
import { ensureFuente, crearAdapter, ensureRoles, ensureEscala, ensurePeriodo } from './lib/adapter.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const load = (f) => JSON.parse(readFileSync(join(here, 'data', f), 'utf8'))

const notasDoc = load('ugel06_notas_diagnosticas_primaria.json')
const contextoDoc = load('ugel06_profesores_contexto_sociodemografico_30.json')
const aulasDoc = notasDoc.aulas
const actas = notasDoc.actas

const SCORE = { C: 1, B: 2, A: 3, AD: 4 }
const ugelKey = notasDoc.ugel_key || 'ugel_06'

// Contexto sociodemográfico por colegio (codigo_local, address, niveles).
const ctxBySchool = new Map()
for (const { sociodemographic_context: ctx } of contextoDoc.professor_context_pairs) ctxBySchool.set(ctx.school_key, ctx)

// ── Coordenadas por distrito (centroide + jitter determinista) ───────────────
const DISTRICT_CENTROID = {
  Cieneguilla: [-12.1167, -76.8167],
  'La Molina': [-12.0787, -76.9447],
  Ate: [-12.0264, -76.9178],
}
function coordsFor(district, i, n) {
  const c = DISTRICT_CENTROID[district]
  if (!c) return [null, null]
  const radius = 0.018
  const angle = (2 * Math.PI * i) / Math.max(n, 1)
  return [c[0] + radius * Math.sin(angle), c[1] + radius * Math.cos(angle)]
}

// ── Deduplicar entidades desde las aulas y las actas ────────────────────────
const cursos = new Map(), canales = new Map(), colegios = new Map(), profes = new Map()

for (const [key, area] of Object.entries(notasDoc.areas)) {
  cursos.set(area.course_key, { codigo: area.course_key, nombre: area.course_name || key })
}

for (const a of aulasDoc) {
  if (!canales.has(a.network_key)) {
    canales.set(a.network_key, {
      codigo: a.network_key,
      numero: Number((a.network_name.match(/\d+/) || [])[0]) || null,
      nombre: a.network_name,
      distrito: a.district,
    })
  }
  if (!colegios.has(a.school_key)) {
    const ctx = ctxBySchool.get(a.school_key) || {}
    colegios.set(a.school_key, {
      codigo: a.school_key,
      network_key: a.network_key,
      codigo_local: ctx.codigo_local ?? null,
      nombre: a.school_name,
      direccion: ctx.address ?? null,
      niveles_educativos: ctx.educational_levels ?? null,
      perfil_desempeno: a.school_performance_profile ?? null,
      perfil_desempeno_label: a.school_performance_profile_label ?? null,
      _district: a.district,
    })
  }
}

// Un profesor por (dni): dicta su área en las aulas de su colegio.
for (const acta of actas) {
  if (!profes.has(acta.professor_dni)) {
    profes.set(acta.professor_dni, {
      dni: acta.professor_dni, nombre: acta.professor_name,
      school_key: acta.school_key, course_key: acta.course_key,
    })
  }
}

// Coordenadas de colegios por distrito.
const byDistrict = new Map()
for (const c of colegios.values()) { const l = byDistrict.get(c._district) || []; l.push(c); byDistrict.set(c._district, l) }
for (const [district, list] of byDistrict) {
  list.forEach((c, i) => { const [lat, lng] = coordsFor(district, i, list.length); c.latitud = lat; c.longitud = lng; delete c._district })
}

// ── Catálogos + fuente + adapter ─────────────────────────────────────────────
const roles = await ensureRoles(db)
const escala = await ensureEscala(db, notasDoc.grading_scale, SCORE)
// Periodos de la línea de tiempo del dataset: diagnóstico + bimestres de
// seguimiento. Las notas de cada periodo cuelgan del MISMO dictado (la
// asignación docente del año), y se distinguen por `periodo_id` y
// `tipo_evaluacion`; el dictado se ancla al periodo diagnóstico, que es el que
// usan las vistas agregadas del panel UGEL.
const periodoId = new Map()
for (const p of notasDoc.periodos ?? []) {
  const id = await ensurePeriodo(db, {
    anio: p.anio, bimestre: p.bimestre, tipo: p.tipo, nombre: p.nombre,
    fecha_inicio: p.fecha ?? null, fecha_fin: p.fecha ?? null,
  })
  // `fecha_fin` = fecha de cierre de la evaluación: es el eje temporal de la
  // serie "notas vs tiempo". Se fija aunque el periodo ya existiera (lo crea el
  // seed sin fecha para el diagnóstico).
  if (p.fecha) {
    const { data: row } = await db.from('periodos_academicos').select('fecha_inicio').eq('id', id).single()
    await db.from('periodos_academicos')
      .update({ fecha_fin: p.fecha, fecha_inicio: row?.fecha_inicio ?? p.fecha })
      .eq('id', id)
  }
  periodoId.set(p.key, id)
}
const periodoDiag = periodoId.get('diagnostico')
  ?? await ensurePeriodo(db, { anio: 2026, bimestre: null, tipo: 'DIAGNOSTICO', nombre: 'Evaluación Diagnóstica 2026' })
const fuenteId = await ensureFuente(db, { codigo: 'ugel06_synthetic_v1', nombre: 'UGEL 06 sintético v1', formato: 'json_ugel06', es_sintetica: true })
const ad = crearAdapter(db, fuenteId)

// ── Limpieza idempotente (solo la capa académica de esta fuente) ─────────────
// Se re-siembra lo que el dataset regenera —aulas, dictados, alumnos,
// matrículas y notas— y se CONSERVA la capa institucional (ugel, canales,
// colegios, cursos) y los docentes: de ellos cuelgan usuarios demo, evidencias y
// otros datos ajenos a esta fuente. El adapter los reutiliza por su mapeo.
console.log('Limpiando data previa de la fuente…')
const ENTIDADES_VOLATILES = ['dictado', 'aula', 'alumno']
// PostgREST devuelve como máximo 1000 filas por consulta: hay que paginar o la
// limpieza deja huérfanos (los mapeos de esta fuente pasan de mil con los alumnos).
const mapped = []
for (let desde = 0; ; desde += 1000) {
  const { data, error } = await db.from('mapeo_llaves_externas')
    .select('entidad,id_interno').eq('fuente_id', fuenteId).range(desde, desde + 999)
  if (error) throw new Error(`mapeo_llaves_externas: ${error.message}`)
  mapped.push(...data)
  if (data.length < 1000) break
}
const idsDe = (ent) => mapped.filter((m) => m.entidad === ent).map((m) => m.id_interno)
const delIn = async (table, ids) => {
  for (let i = 0; i < ids.length; i += 500) {
    const { error } = await db.from(table).delete().in('id', ids.slice(i, i + 500))
    if (error) throw new Error(`wipe ${table}: ${error.message}`)
  }
}
if (mapped?.length) {
  // hijos → padres
  const alumnoIds = idsDe('alumno')
  for (const t of ['notas', 'matriculas']) {
    for (let i = 0; i < alumnoIds.length; i += 500) {
      const { error } = await db.from(t).delete().in('alumno_id', alumnoIds.slice(i, i + 500))
      if (error) throw new Error(`wipe ${t}: ${error.message}`)
    }
  }
  await delIn('dictados', idsDe('dictado'))
  await delIn('aulas', idsDe('aula'))
  await delIn('alumnos', alumnoIds)
  await db.from('mapeo_llaves_externas').delete().eq('fuente_id', fuenteId).in('entidad', ENTIDADES_VOLATILES)
}

// ── Ingesta en orden de FK ───────────────────────────────────────────────────
console.log('Migrando data ugel_06 al modelo unificado…')
const ugelId = await ad.resolverOCrear('ugel', ugelKey, 'ugels', () => ({ codigo: ugelKey, nombre: 'UGEL 06', es_sintetico: true }))

const cursoId = new Map()
for (const c of cursos.values()) cursoId.set(c.codigo, await ad.resolverOCrear('curso', c.codigo, 'cursos', () => ({ codigo: c.codigo, nombre: c.nombre, es_sintetico: true })))

const canalId = new Map()
for (const c of canales.values()) canalId.set(c.codigo, await ad.resolverOCrear('canal', c.codigo, 'canales', () => ({ ugel_id: ugelId, codigo: c.codigo, numero: c.numero, nombre: c.nombre, distrito: c.distrito, es_sintetico: true })))

const colegioId = new Map()
for (const c of colegios.values()) colegioId.set(c.codigo, await ad.resolverOCrear('colegio', c.codigo, 'colegios', () => ({
  canal_id: canalId.get(c.network_key), codigo: c.codigo, codigo_local: c.codigo_local, nombre: c.nombre, direccion: c.direccion,
  niveles_educativos: c.niveles_educativos, latitud: c.latitud, longitud: c.longitud,
  perfil_desempeno: c.perfil_desempeno, perfil_desempeno_label: c.perfil_desempeno_label, es_sintetico: true,
})))

const profesorId = new Map()
for (const p of profes.values()) {
  let id = await ad.resolver('profesor', p.dni)
  if (id) {
    // Mapeo huérfano (el usuario fue borrado por otro script): se descarta y recrea.
    const { data: row } = await db.from('usuarios').select('id').eq('id', id).maybeSingle()
    if (!row) {
      await db.from('mapeo_llaves_externas').delete()
        .eq('fuente_id', fuenteId).eq('entidad', 'profesor').eq('llave_externa', p.dni)
      id = null
    }
  }
  if (!id) {
    id = await ensureAuthUser(`profe.${p.dni}@kipu.demo`)
    const { error } = await db.from('usuarios').insert({ id, rol_id: roles.profesor, colegio_id: colegioId.get(p.school_key), nombre_completo: p.nombre, es_sintetico: true })
    if (error) throw new Error(`usuarios ${p.dni}: ${error.message}`)
    await db.from('datos_personales').insert({ usuario_id: id, dni: p.dni })
    await ad.mapear('profesor', p.dni, id)
  }
  profesorId.set(p.dni, id)
}

// Aulas: grado + sección + turno + nivel (cabecera del acta diagnóstica).
const aulaId = new Map()
for (const a of aulasDoc) aulaId.set(a.section_key, await ad.resolverOCrear('aula', a.section_key, 'aulas', () => ({
  colegio_id: colegioId.get(a.school_key), codigo: a.section_key, grado: a.grado, seccion: a.seccion,
  turno: a.turno, nivel: a.nivel_educativo, nombre: a.nombre, es_sintetico: true,
})))

// Dictados: uno por acta (aula × área) con el docente de esa área.
const dictadoId = new Map()
for (const acta of actas) dictadoId.set(acta.acta_key, await ad.resolverOCrear('dictado', acta.acta_key, 'dictados', () => ({
  aula_id: aulaId.get(acta.section_key), curso_id: cursoId.get(acta.course_key),
  profesor_id: profesorId.get(acta.professor_dni), periodo_id: periodoDiag, es_sintetico: true,
})))

// Alumnos (lote) → Map student_key → uuid. El alumno pertenece al colegio de su aula.
const alumnoId = await ad.crearLote('alumno', 'alumnos', aulasDoc.flatMap((a) => a.students.map((s) => ({
  llave: s.student_key,
  fila: { colegio_id: colegioId.get(a.school_key), codigo: s.student_key, numero: s.student_number, nombre_completo: s.full_name, es_sintetico: true },
}))))

// Inserción en lote sin mapeo (matriculas, notas).
async function insertLote(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).insert(rows.slice(i, i + 500))
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

// Matrículas: alumno ⋈ aula en el periodo diagnóstico (una por alumno).
await insertLote('matriculas', aulasDoc.flatMap((a) => a.students.map((s) => ({
  alumno_id: alumnoId.get(s.student_key), aula_id: aulaId.get(a.section_key), periodo_id: periodoDiag, es_sintetico: true,
}))))

// Notas: por acta, las competencias del área (mate C1-C4, comu C1-C3) + GENERAL.
// Se emiten para el diagnóstico y para cada periodo de seguimiento bimestral.
const competenciasDe = new Map(actas.map((a) => [a.acta_key, a.competencias.map((c) => c.codigo)]))
const cursoDe = new Map(actas.map((a) => [a.acta_key, a.course_key]))
const notasRows = []
function emitirNotas(actaKey, filas, periodo, tipoEvaluacion) {
  const base = {
    curso_id: cursoId.get(cursoDe.get(actaKey)), periodo_id: periodo,
    dictado_id: dictadoId.get(actaKey), tipo_evaluacion: tipoEvaluacion, es_sintetico: true,
  }
  for (const e of filas) {
    const fila = { ...base, alumno_id: alumnoId.get(e.student_key) }
    for (const comp of competenciasDe.get(actaKey)) {
      notasRows.push({ ...fila, competencia: comp, escala_id: escala[e[comp]], puntaje_numerico: SCORE[e[comp]] })
    }
    notasRows.push({ ...fila, competencia: 'GENERAL', escala_id: escala[e.overall_grade], puntaje_numerico: e.average_score_1_to_4, descripcion: e.overall_level })
  }
}
for (const acta of actas) emitirNotas(acta.acta_key, acta.students, periodoDiag, 'DIAGNOSTICO')
for (const s of notasDoc.seguimiento ?? []) {
  const periodo = periodoId.get(s.periodo)
  if (!periodo) throw new Error(`periodo no resuelto: ${s.periodo}`)
  emitirNotas(s.acta_key, s.students, periodo, s.tipo_evaluacion)
}
await insertLote('notas', notasRows)

console.log(`\n✔ Migración ugel_06 completa:`,
  `${canales.size} canales · ${colegios.size} colegios · ${profes.size} profesores · ${aulasDoc.length} aulas ·`,
  `${actas.length} dictados (actas) · ${alumnoId.size} alumnos · ${notasRows.length} notas`)
console.log('  (marcado es_sintetico=true; fuente ugel06_synthetic_v1)')
