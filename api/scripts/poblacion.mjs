// Migra la data (sintética) de UGEL 06 al MODELO UNIFICADO vía el adapter de
// ingesta. Mapea las llaves naturales externas (ugel_key, network_key,
// school_key, course_key, dni, section_key, student_key) a los uuid internos en
// `mapeo_llaves_externas`, de modo que un formato de datos nuevo se ingiera
// relacionando sus llaves contra las existentes. La data se marca es_sintetico.
//
// Fuentes:
//   data/ugel06_60_rubricas_diagnosticas.json               → estructura + secciones
//   data/ugel06_1500_evaluaciones.json                      → 1500 notas diagnósticas
//   data/ugel06_profesores_contexto_sociodemografico_30.json → contexto del colegio
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

const rubricasDoc = load('ugel06_60_rubricas_diagnosticas.json')
const evalDoc = load('ugel06_1500_evaluaciones.json')
const contextoDoc = load('ugel06_profesores_contexto_sociodemografico_30.json')
const rubrics = Object.values(rubricasDoc.rubrics)
const evaluaciones = evalDoc.evaluations
const contextoPairs = contextoDoc.professor_context_pairs

const SCORE = { C: 1, B: 2, A: 3, AD: 4 }
const ugelKey = rubricasDoc.ugel_key || 'ugel_06'

// Contexto sociodemográfico por colegio (codigo_local, address, niveles).
const ctxBySchool = new Map()
for (const { sociodemographic_context: ctx } of contextoPairs) ctxBySchool.set(ctx.school_key, ctx)

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

// ── Deduplicar entidades desde las rúbricas ─────────────────────────────────
const cursos = new Map(), canales = new Map(), colegios = new Map(), profes = new Map()
const aulas = []                       // una por rúbrica/sección
const sectionToSchool = new Map(), sectionToCourse = new Map()

for (const r of rubrics) {
  cursos.set(r.course_key, { codigo: r.course_key, nombre: r.course_name })
  if (!canales.has(r.network_key)) {
    canales.set(r.network_key, {
      codigo: r.network_key,
      numero: Number((r.network_name.match(/\d+/) || [])[0]) || null,
      nombre: r.network_name,
      distrito: r.district,
    })
  }
  if (!colegios.has(r.school_key)) {
    const ctx = ctxBySchool.get(r.school_key) || {}
    colegios.set(r.school_key, {
      codigo: r.school_key,
      network_key: r.network_key,
      codigo_local: ctx.codigo_local ?? null,
      nombre: r.school_name,
      direccion: ctx.address ?? null,
      niveles_educativos: ctx.educational_levels ?? null,
      perfil_desempeno: r.school_performance_profile ?? null,
      perfil_desempeno_label: r.school_performance_profile_label ?? null,
      _district: r.district,
    })
  }
  if (!profes.has(r.professor_dni)) {
    profes.set(r.professor_dni, { dni: r.professor_dni, nombre: r.professor_name, school_key: r.school_key, course_key: r.course_key })
  }
  aulas.push({ section_key: r.rubric_key, school_key: r.school_key, course_key: r.course_key, professor_dni: r.professor_dni, seccion: r.section })
  sectionToSchool.set(r.rubric_key, r.school_key)
  sectionToCourse.set(r.rubric_key, r.course_key)
}

// Coordenadas de colegios por distrito.
const byDistrict = new Map()
for (const c of colegios.values()) { const l = byDistrict.get(c._district) || []; l.push(c); byDistrict.set(c._district, l) }
for (const [district, list] of byDistrict) {
  list.forEach((c, i) => { const [lat, lng] = coordsFor(district, i, list.length); c.latitud = lat; c.longitud = lng; delete c._district })
}

// ── Catálogos + fuente + adapter ─────────────────────────────────────────────
const roles = await ensureRoles(db)
const escala = await ensureEscala(db, rubricasDoc.grading_scale, SCORE)
const periodoDiag = await ensurePeriodo(db, { anio: 2026, bimestre: null, tipo: 'DIAGNOSTICO', nombre: 'Evaluación Diagnóstica 2026' })
const fuenteId = await ensureFuente(db, { codigo: 'ugel06_synthetic_v1', nombre: 'UGEL 06 sintético v1', formato: 'json_ugel06', es_sintetica: true })
const ad = crearAdapter(db, fuenteId)

// ── Limpieza idempotente (solo lo mapeado por esta fuente) ───────────────────
console.log('Limpiando data previa de la fuente…')
const { data: mapped } = await db.from('mapeo_llaves_externas').select('entidad,id_interno').eq('fuente_id', fuenteId)
const idsDe = (ent) => (mapped || []).filter((m) => m.entidad === ent).map((m) => m.id_interno)
const delIn = async (table, ids) => { if (ids.length) { const { error } = await db.from(table).delete().in('id', ids); if (error) throw new Error(`wipe ${table}: ${error.message}`) } }
if (mapped?.length) {
  // hijos → padres
  const alumnoIds = idsDe('alumno')
  if (alumnoIds.length) { for (const t of ['notas', 'matriculas']) { const { error } = await db.from(t).delete().in('alumno_id', alumnoIds); if (error) throw new Error(`wipe ${t}: ${error.message}`) } }
  await delIn('dictados', idsDe('dictado'))
  await delIn('aulas', idsDe('aula'))
  await delIn('alumnos', alumnoIds)
  await delIn('usuarios', idsDe('profesor'))     // datos_personales cae por cascade
  await delIn('colegios', idsDe('colegio'))
  await delIn('canales', idsDe('canal'))
  await delIn('cursos', idsDe('curso'))
  await delIn('ugels', idsDe('ugel'))
  await db.from('mapeo_llaves_externas').delete().eq('fuente_id', fuenteId)
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
  if (!id) {
    id = await ensureAuthUser(`profe.${p.dni}@kipu.demo`)
    const { error } = await db.from('usuarios').insert({ id, rol_id: roles.profesor, colegio_id: colegioId.get(p.school_key), nombre_completo: p.nombre, es_sintetico: true })
    if (error) throw new Error(`usuarios ${p.dni}: ${error.message}`)
    await db.from('datos_personales').insert({ usuario_id: id, dni: p.dni })
    await ad.mapear('profesor', p.dni, id)
  }
  profesorId.set(p.dni, id)
}

const aulaId = new Map()
for (const a of aulas) aulaId.set(a.section_key, await ad.resolverOCrear('aula', a.section_key, 'aulas', () => ({
  colegio_id: colegioId.get(a.school_key), codigo: a.section_key, grado: null, seccion: a.seccion, nombre: `Sección ${a.seccion}`, es_sintetico: true,
})))

const dictadoId = new Map()
for (const a of aulas) dictadoId.set(a.section_key, await ad.resolverOCrear('dictado', a.section_key, 'dictados', () => ({
  aula_id: aulaId.get(a.section_key), curso_id: cursoId.get(a.course_key), profesor_id: profesorId.get(a.professor_dni), periodo_id: periodoDiag, es_sintetico: true,
})))

// Alumnos (lote) → Map student_key → uuid. Colegio del alumno = colegio de su sección.
const alumnoId = await ad.crearLote('alumno', 'alumnos', evaluaciones.map((e) => ({
  llave: e.student_key,
  fila: { colegio_id: colegioId.get(sectionToSchool.get(e.section_key)), codigo: e.student_key, numero: e.student_number, nombre_completo: e.student_name, es_sintetico: true },
})))

// Inserción en lote sin mapeo (matriculas, notas).
async function insertLote(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).insert(rows.slice(i, i + 500))
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

// Matrículas: alumno ⋈ aula(sección) en el periodo diagnóstico.
await insertLote('matriculas', evaluaciones.map((e) => ({
  alumno_id: alumnoId.get(e.student_key), aula_id: aulaId.get(e.section_key), periodo_id: periodoDiag, es_sintetico: true,
})))

// Notas: 4 competencias (C1-C4) + 1 GENERAL por alumno.
const notasRows = []
for (const e of evaluaciones) {
  const base = { alumno_id: alumnoId.get(e.student_key), curso_id: cursoId.get(sectionToCourse.get(e.section_key)), periodo_id: periodoDiag, dictado_id: dictadoId.get(e.section_key), tipo_evaluacion: 'DIAGNOSTICO', es_sintetico: true }
  for (const comp of ['C1', 'C2', 'C3', 'C4']) {
    notasRows.push({ ...base, competencia: comp, escala_id: escala[e[comp]], puntaje_numerico: SCORE[e[comp]] })
  }
  notasRows.push({ ...base, competencia: 'GENERAL', escala_id: escala[e.overall_grade], puntaje_numerico: e.average_score_1_to_4, descripcion: e.overall_level })
}
await insertLote('notas', notasRows)

console.log(`\n✔ Migración ugel_06 completa:`,
  `${canales.size} canales · ${colegios.size} colegios · ${profes.size} profesores · ${aulas.length} aulas/dictados · ${alumnoId.size} alumnos · ${notasRows.length} notas`)
console.log('  (marcado es_sintetico=true; fuente ugel06_synthetic_v1)')
