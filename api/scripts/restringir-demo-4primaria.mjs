// Convierte la PoC existente a 4.º sin recrear alumnos, notas ni cuentas.
// Guarda una copia local antes de cambiar datos o retirar pruebas de otros grados.
// Uso: npm run db:solo-4primaria -- RUTA_BACKUP --apply
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { db } from './lib/client.mjs'

const backupDir = process.argv[2] && resolve(process.argv[2])
if (!backupDir) throw new Error('Indica una carpeta de respaldo.')
if (process.argv[3] !== '--apply') throw new Error('Falta --apply: esta operación retira las entregas antiguas después de respaldarlas.')
const generated = JSON.parse(readFileSync(new URL('./data/ugel06_notas_diagnosticas_primaria.json', import.meta.url), 'utf8'))
if (generated.aulas.length !== 30 || generated.aulas.some(a => a.grado !== '4°')) {
  throw new Error('Genera primero el conjunto sintético de 4.º con npm run db:generar-notas.')
}

async function all(table, columns = '*') {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from(table).select(columns).range(offset, offset + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}
async function upsertBatches(table, rows) {
  for (let i = 0; i < rows.length; i += 250) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 250), { onConflict: 'id' })
    if (error) throw new Error(`${table} lote ${i}: ${error.message}`)
  }
}
const tables = ['aulas', 'alumnos', 'dictados', 'unidades', 'sesiones', 'evidencias', 'evidencia_versiones', 'evaluaciones', 'contextos_ia', 'mapeo_llaves_externas']
const snapshot = Object.fromEntries(await Promise.all(tables.map(async table => [table, await all(table)])))
const { aulas, alumnos, dictados, unidades, sesiones, evidencias, evidencia_versiones: versiones, mapeo_llaves_externas: mapas } = snapshot
const generatedAulas = new Map(generated.aulas.map(a => [a.section_key, a]))
const generatedStudents = new Map(generated.aulas.flatMap(a => a.students.map(s => [s.student_key, s])))
const toFourth = key => key?.replace(/_[1-6]([ab])(?=_|$)/, '_4$1')

if (aulas.length !== generated.aulas.length || alumnos.length !== generatedStudents.size) throw new Error('El tamaño de la base actual no coincide con los datos regenerados.')
for (const a of aulas) {
  const target = generatedAulas.get(toFourth(a.codigo))
  if (!target) throw new Error(`Aula incompatible: ${a.codigo}`)
}
for (const student of alumnos) {
  const target = generatedStudents.get(toFourth(student.codigo))
  if (!target || target.full_name !== student.nombre_completo || target.student_number !== student.numero) {
    throw new Error(`Alumno incompatible: ${student.codigo}`)
  }
}
const aulaById = new Map(aulas.map(a => [a.id, a]))
const dictadoById = new Map(dictados.map(d => [d.id, d]))
const unidadById = new Map(unidades.map(u => [u.id, u]))
const sesionById = new Map(sesiones.map(s => [s.id, s]))
const oldUnitIds = new Set(unidades.filter(u => !u.es_sintetico && aulaById.get(dictadoById.get(u.dictado_id)?.aula_id)?.grado !== '4°').map(u => u.id))
const oldSessionIds = new Set(sesiones.filter(s => {
  if (oldUnitIds.has(s.unidad_id)) return true
  const unit = unidadById.get(s.unidad_id)
  return !s.es_sintetico && aulaById.get(dictadoById.get(unit?.dictado_id)?.aula_id)?.grado !== '4°'
}).map(s => s.id))
const oldEvidenceIds = new Set(evidencias.filter(e => oldUnitIds.has(e.unidad_id) || oldSessionIds.has(e.sesion_id)).map(e => e.id))
const oldVersions = versiones.filter(v => oldEvidenceIds.has(v.evidencia_id))

// El respaldo se completa antes de la primera escritura remota.
mkdirSync(backupDir, { recursive: true })
for (const [table, rows] of Object.entries(snapshot)) writeFileSync(join(backupDir, `${table}.json`), JSON.stringify(rows, null, 2))
const filesDir = join(backupDir, 'archivos')
mkdirSync(filesDir, { recursive: true })
for (const version of oldVersions.filter(v => v.storage_path && !v.storage_path.startsWith('seed/'))) {
  const { data, error } = await db.storage.from('evidence').download(version.storage_path)
  if (error) throw new Error(`Respaldo incompleto: ${version.storage_path}: ${error.message}`)
  writeFileSync(join(filesDir, `${version.id}-${version.nombre_archivo.replace(/[\\/]/g, '_')}`), Buffer.from(await data.arrayBuffer()))
}
writeFileSync(join(backupDir, 'resumen.json'), JSON.stringify({ fecha: new Date().toISOString(), aulas: aulas.length, alumnos: alumnos.length, unidades_retiradas: oldUnitIds.size, archivos_resguardados: oldVersions.length }, null, 2))
console.log(`Respaldo completo en ${backupDir}. Retirando ${oldUnitIds.size} entregas de otros grados…`)

for (const id of oldUnitIds) {
  const { error } = await db.from('unidades').delete().eq('id', id)
  if (error) throw new Error(`Eliminar unidad ${id}: ${error.message}`)
}
for (const id of oldSessionIds) {
  if (oldUnitIds.has(sesionById.get(id)?.unidad_id)) continue
  const { error } = await db.from('sesiones').delete().eq('id', id)
  if (error) throw new Error(`Eliminar sesión ${id}: ${error.message}`)
}
await upsertBatches('aulas', aulas.map(a => {
  const target = generatedAulas.get(toFourth(a.codigo))
  return { ...a, grado: '4°', codigo: target.section_key, nombre: target.nombre }
}))
await upsertBatches('alumnos', alumnos.map(student => ({ ...student, codigo: toFourth(student.codigo) })))
await upsertBatches('mapeo_llaves_externas', mapas
  .filter(map => ['aula', 'dictado', 'alumno'].includes(map.entidad))
  .map(map => ({ ...map, llave_externa: toFourth(map.llave_externa) })))
// Los archivos originales quedan únicamente en el respaldo local.
for (const version of oldVersions.filter(v => v.storage_path && !v.storage_path.startsWith('seed/'))) {
  const { error } = await db.storage.from('evidence').remove([version.storage_path])
  if (error) throw new Error(`Retirar archivo ${version.storage_path}: ${error.message}`)
}
const current = await all('aulas', 'grado')
if (current.length !== 30 || current.some(a => a.grado !== '4°')) throw new Error('Verificación final de aulas fallida.')
console.log(`PoC de 4.º lista: ${current.length} aulas, ${alumnos.length} alumnos, ${dictados.length} dictados. Respaldo: ${backupDir}`)
