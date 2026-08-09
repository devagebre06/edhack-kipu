// Ingesta de los 151 colegios reales de la UGEL 06 (coordenadas MINEDU).
// Fuente: api/scripts/data/ugel_06_coordenadas.csv (cod_institucion, cod_mod,
// nombre, distrito, latitud, longitud, altitud).
//
// Estrategia (acordada): match-first, luego aditivo.
//   - Si el colegio ya existe en la DB (match por nombre normalizado), se
//     ACTUALIZAN sus coordenadas/distrito (no se duplica).
//   - Si no existe, se INSERTA como colegio real (es_sintetico=false) colgado
//     de un canal por distrito. Nunca se borra data ajena.
// Idempotente: reejecutar vuelve a dejar el mismo estado (limpia solo lo suyo).
//
// Uso: node --env-file=.env scripts/colegios-reales.mjs   (o npm run db:colegios)
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { db } from './lib/client.mjs'
import { ensureFuente, crearAdapter } from './lib/adapter.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CSV = join(HERE, 'data', 'ugel_06_coordenadas.csv')

// Distrito del CSV (MAYÚSCULAS) → etiqueta Title-case (alineada con el demo) + clave de canal.
const DISTRITOS = {
  ATE: { label: 'Ate', key: 'ate' },
  CHACLACAYO: { label: 'Chaclacayo', key: 'chaclacayo' },
  CIENEGUILLA: { label: 'Cieneguilla', key: 'cieneguilla' },
  'LA MOLINA': { label: 'La Molina', key: 'la_molina' },
  LURIGANCHO: { label: 'Lurigancho', key: 'lurigancho' },
  'SANTA ANITA': { label: 'Santa Anita', key: 'santa_anita' },
}
const norm = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

// ── Parseo del CSV (el nombre puede traer comas → tomar el centro) ────────────
const lines = fs.readFileSync(CSV, 'utf8').trim().split(/\r?\n/).slice(1)
const rows = lines.map((l) => {
  const p = l.split(',')
  return {
    cod_institucion: p[0],
    cod_mod: p[1],
    nombre: p.slice(2, p.length - 4).join(','),
    distrito: p[p.length - 4],
    latitud: Number(p[p.length - 3]),
    longitud: Number(p[p.length - 2]),
    altitud: Number(p[p.length - 1]),
  }
})
for (const r of rows) if (!DISTRITOS[r.distrito]) throw new Error(`distrito no esperado en CSV: "${r.distrito}"`)
console.log(`CSV: ${rows.length} colegios reales`)

// ── Fuente + adapter (real, no sintético) ────────────────────────────────────
const fuenteId = await ensureFuente(db, { codigo: 'ugel06_minedu_v1', nombre: 'UGEL 06 MINEDU (coordenadas reales)', formato: 'csv_minedu', es_sintetica: false })
const ad = crearAdapter(db, fuenteId)

// ── Limpieza idempotente: solo lo que esta fuente creó (colegios sin hijos + canales) ──
const { data: mapped } = await db.from('mapeo_llaves_externas').select('entidad,id_interno').eq('fuente_id', fuenteId)
const idsDe = (ent) => (mapped || []).filter((m) => m.entidad === ent).map((m) => m.id_interno)
const delIn = async (table, ids) => { if (ids.length) { const { error } = await db.from(table).delete().in('id', ids); if (error) throw new Error(`wipe ${table}: ${error.message}`) } }
if (mapped?.length) {
  await delIn('colegios', idsDe('colegio'))
  await delIn('canales', idsDe('canal'))
  await db.from('mapeo_llaves_externas').delete().eq('fuente_id', fuenteId)
  console.log('· limpieza previa de esta fuente ok')
}

// ── UGEL 06 (reusar la existente si ya la creó otro script) ──────────────────
const { data: ugelRow } = await db.from('ugels').select('id').eq('codigo', 'ugel_06').maybeSingle()
const ugelId = ugelRow?.id ?? await ad.resolverOCrear('ugel', 'ugel_06', 'ugels', () => ({ codigo: 'ugel_06', nombre: 'UGEL 06', es_sintetico: false }))

// ── Un canal por distrito ────────────────────────────────────────────────────
const canalId = {}
for (const [up, d] of Object.entries(DISTRITOS)) {
  canalId[up] = await ad.resolverOCrear('canal', `dist_${d.key}`, 'canales', () => ({
    ugel_id: ugelId, codigo: `ugel06_dist_${d.key}`, numero: null, nombre: d.label, distrito: d.label, es_sintetico: false,
  }))
}

// ── Match contra colegios existentes (por nombre normalizado) ────────────────
const { data: existing } = await db.from('colegios').select('id,nombre')
const byName = new Map((existing || []).map((c) => [norm(c.nombre), c.id]))

// ── UPDATE los que matchean · INSERT (lote) los nuevos ───────────────────────
let updated = 0
const nuevos = []
for (const r of rows) {
  const hit = byName.get(norm(r.nombre))
  const canal = canalId[r.distrito]
  if (hit) {
    const { error } = await db.from('colegios').update({
      canal_id: canal, latitud: r.latitud, longitud: r.longitud, es_sintetico: false,
    }).eq('id', hit)
    if (error) throw new Error(`update ${r.nombre}: ${error.message}`)
    await ad.mapear('colegio', r.cod_mod, hit)
    updated++
  } else {
    nuevos.push({ llave: r.cod_mod, fila: {
      canal_id: canal, codigo: r.cod_mod, codigo_local: null, nombre: r.nombre, direccion: null,
      niveles_educativos: ['Primaria'], latitud: r.latitud, longitud: r.longitud, es_sintetico: false,
    } })
  }
}
if (nuevos.length) await ad.crearLote('colegio', 'colegios', nuevos)

console.log(`\n✅ colegios reales: ${updated} actualizados · ${nuevos.length} nuevos`)
console.log(`   canales por distrito: ${Object.keys(DISTRITOS).length}`)
console.log('   (fuente ugel06_minedu_v1 · es_sintetico=false)')
