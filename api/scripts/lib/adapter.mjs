// Adapter de ingesta: mapea llaves externas (school_key, dni, student_key, …) a
// los uuid internos de la DB vía la tabla `mapeo_llaves_externas`. Permite meter
// un formato de datos nuevo relacionando sus llaves contra las existentes, sin
// duplicar filas: la reimportación es idempotente.
//
// Uso:
//   const fuenteId = await ensureFuente(db, { codigo:'ugel06_synthetic_v1', ... })
//   const ad = crearAdapter(db, fuenteId)
//   const colegioId = await ad.resolverOCrear('colegio', school_key, 'colegios', () => ({ ... }))

// ── Fuente de datos (procedencia) ────────────────────────────────────────────
export async function ensureFuente(db, { codigo, nombre, formato = null, es_sintetica = true }) {
  const { data: found } = await db.from('fuentes_datos').select('id').eq('codigo', codigo).maybeSingle()
  if (found) return found.id
  const { data, error } = await db
    .from('fuentes_datos')
    .insert({ codigo, nombre, formato, es_sintetica })
    .select('id')
    .single()
  if (error) throw new Error(`fuentes_datos: ${error.message}`)
  return data.id
}

// ── Adapter ──────────────────────────────────────────────────────────────────
export function crearAdapter(db, fuenteId) {
  const cache = new Map() // `${entidad}|${llave}` -> id_interno

  async function resolver(entidad, llave) {
    const k = `${entidad}|${llave}`
    if (cache.has(k)) return cache.get(k)
    const { data } = await db
      .from('mapeo_llaves_externas')
      .select('id_interno')
      .eq('fuente_id', fuenteId).eq('entidad', entidad).eq('llave_externa', String(llave))
      .maybeSingle()
    if (data) { cache.set(k, data.id_interno); return data.id_interno }
    return null
  }

  // Devuelve el id interno de (entidad, llave); lo crea en `table` con buildRow() la 1ª vez.
  async function resolverOCrear(entidad, llave, table, buildRow) {
    const hit = await resolver(entidad, llave)
    if (hit) return hit
    const { data, error } = await db.from(table).insert(buildRow()).select('id').single()
    if (error) throw new Error(`${table} (${entidad} ${llave}): ${error.message}`)
    await mapear(entidad, llave, data.id)
    return data.id
  }

  // Registra un mapeo llave_externa → id_interno (para inserts en lote).
  async function mapear(entidad, llave, idInterno) {
    const { error } = await db
      .from('mapeo_llaves_externas')
      .insert({ fuente_id: fuenteId, entidad, llave_externa: String(llave), id_interno: idInterno })
    if (error) throw new Error(`mapeo ${entidad} ${llave}: ${error.message}`)
    cache.set(`${entidad}|${llave}`, idInterno)
    return idInterno
  }

  // Inserta filas en lote y registra sus mapeos. `rows` = [{ llave, fila }]; devuelve Map(llave→id).
  async function crearLote(entidad, table, rows) {
    const out = new Map()
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const { data, error } = await db.from(table).insert(chunk.map((r) => r.fila)).select('id')
      if (error) throw new Error(`${table} (${entidad}): ${error.message}`)
      const mapeos = data.map((d, j) => ({
        fuente_id: fuenteId, entidad, llave_externa: String(chunk[j].llave), id_interno: d.id,
      }))
      const { error: mErr } = await db.from('mapeo_llaves_externas').insert(mapeos)
      if (mErr) throw new Error(`mapeo lote ${entidad}: ${mErr.message}`)
      data.forEach((d, j) => { const k = chunk[j].llave; out.set(k, d.id); cache.set(`${entidad}|${k}`, d.id) })
    }
    return out
  }

  return { resolver, resolverOCrear, mapear, crearLote }
}

// ── Catálogos idempotentes (por si el orden de scripts varía) ─────────────────
export async function ensureRoles(db) {
  const roles = [
    { key: 'ugel', nombre: 'Especialista UGEL' },
    { key: 'director', nombre: 'Director' },
    { key: 'profesor', nombre: 'Profesor' },
  ]
  const out = {}
  for (const r of roles) {
    const { data: f } = await db.from('roles').select('id').eq('key', r.key).maybeSingle()
    if (f) { out[r.key] = f.id; continue }
    const { data, error } = await db.from('roles').insert(r).select('id').single()
    if (error) throw new Error(`roles ${r.key}: ${error.message}`)
    out[r.key] = data.id
  }
  return out // { ugel, director, profesor }
}

export async function ensureEscala(db, gradingScale, scoreByCode) {
  const out = {}
  for (const [codigo, nombre] of Object.entries(gradingScale)) {
    const { data: f } = await db.from('escala_logro').select('id').eq('codigo', codigo).maybeSingle()
    if (f) { out[codigo] = f.id; continue }
    const { data, error } = await db
      .from('escala_logro')
      .insert({ codigo, nombre, valor_numerico: scoreByCode[codigo] })
      .select('id').single()
    if (error) throw new Error(`escala_logro ${codigo}: ${error.message}`)
    out[codigo] = data.id
  }
  return out // { C, B, A, AD } -> id
}

export async function ensurePeriodo(db, { anio, bimestre = null, tipo, nombre, fecha_inicio = null, fecha_fin = null }) {
  let q = db.from('periodos_academicos').select('id').eq('anio', anio).eq('tipo', tipo)
  q = bimestre === null ? q.is('bimestre', null) : q.eq('bimestre', bimestre)
  const { data: f } = await q.maybeSingle()
  if (f) return f.id
  const { data, error } = await db
    .from('periodos_academicos')
    .insert({ anio, bimestre, tipo, nombre, fecha_inicio, fecha_fin })
    .select('id').single()
  if (error) throw new Error(`periodos_academicos ${nombre}: ${error.message}`)
  return data.id
}
