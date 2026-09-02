// Deja la demo con UN SOLO LOGIN POR ROL y purga las cuentas sobrantes.
// Idempotente. Uso: node --env-file=.env scripts/demo-users.mjs  (o npm run db:demo-users)
//
// Estado final garantizado:
//   · ugel@kipu.demo      → rol ugel (ve todo, sin colegio)
//   · director@kipu.demo  → rol director, ligado al colegio del docente demo
//   · profesor@kipu.demo  → el docente de menor dni, con sus dictados y notas
//
// Purga: cualquier otra cuenta de rol ugel o director se borra de Auth (la fila
// de `usuarios` cae por cascade) y sus referencias en logs_auditoria se anulan.
//
// Los 30 docentes `profe.<dni>@kipu.demo` NO se tocan: sostienen los 60 dictados
// y las tarjetas de docentes del panel UGEL. El login de la demo es profesor@;
// los demás existen como carga estructural de datos, no como cuentas de trabajo.
import { db, DEMO_PASS as PASS } from './lib/client.mjs'

const DOMAIN = '@kipu.demo'
const CUENTAS = { ugel: 'ugel' + DOMAIN, director: 'director' + DOMAIN, profesor: 'profesor' + DOMAIN }
const authUsers = async () => (await db.auth.admin.listUsers({ perPage: 1000 })).data.users
const byEmail = (users, email) => users.find((u) => u.email === email)

// ── roles ────────────────────────────────────────────────────────────────────
const { data: rolesRows, error: rErr } = await db.from('roles').select('id,key')
if (rErr) throw new Error(`roles: ${rErr.message}`)
const roles = Object.fromEntries(rolesRows.map((r) => [r.key, r.id]))
const rolKey = Object.fromEntries(rolesRows.map((r) => [r.id, r.key]))
for (const k of ['ugel', 'director', 'profesor']) if (!roles[k]) throw new Error(`falta el rol '${k}' (¿corriste las migraciones?)`)

// borra una cuenta de Auth y limpia las referencias que no tienen FK
async function borrarCuenta(id, etiqueta) {
  await db.from('logs_auditoria').update({ actor_id: null }).eq('actor_id', id)
  const { error } = await db.auth.admin.deleteUser(id)
  if (error) throw new Error(`borrar ${etiqueta}: ${error.message}`)
  console.log('🗑️  borrado', etiqueta)
}

// crea o actualiza un auth user con la contraseña demo; devuelve su id
async function ensureAuth(email) {
  const ex = byEmail(await authUsers(), email)
  if (ex) {
    await db.auth.admin.updateUserById(ex.id, { password: PASS, email_confirm: true })
    return ex.id
  }
  const { data, error } = await db.auth.admin.createUser({ email, password: PASS, email_confirm: true })
  if (error) throw new Error(`crear ${email}: ${error.message}`)
  return data.user.id
}

// ── 1) elegir el docente demo: el de menor dni, con dictados ─────────────────
const { data: docentes } = await db
  .from('datos_personales')
  .select('usuario_id, dni, usuarios!inner(rol_id, colegio_id, nombre_completo)')
  .order('dni')
const docente = (docentes ?? []).find((d) => d.usuarios?.rol_id === roles.profesor)
if (!docente) {
  console.log('\n⚠️  No hay docentes en la DB todavía.')
  console.log('   Corre primero:  npm run db:poblacion  &&  npm run db:seed')
  console.log(`\n🔑 Contraseña demo: ${PASS}`)
  process.exit(0)
}
const colegioDemo = docente.usuarios.colegio_id

// ── 2) profesor@ : renombrar el email del docente elegido ────────────────────
// Si ya existe un profesor@ que NO es él (p. ej. quedó de una corrida anterior),
// se borra solo cuando no ancla dictados; si los ancla, ese pasa a ser el docente.
let profesorId = docente.usuario_id
const yaProfesor = byEmail(await authUsers(), CUENTAS.profesor)
if (yaProfesor && yaProfesor.id !== profesorId) {
  const { count } = await db.from('dictados').select('*', { count: 'exact', head: true }).eq('profesor_id', yaProfesor.id)
  if (count) profesorId = yaProfesor.id
  else await borrarCuenta(yaProfesor.id, `${CUENTAS.profesor} (huérfano)`)
}
if (!byEmail(await authUsers(), CUENTAS.profesor)) {
  const { error } = await db.auth.admin.updateUserById(profesorId, { email: CUENTAS.profesor, password: PASS, email_confirm: true })
  if (error) throw new Error(`renombrar a ${CUENTAS.profesor}: ${error.message}`)
} else {
  await db.auth.admin.updateUserById(profesorId, { password: PASS, email_confirm: true })
}
const { data: profRow } = await db.from('usuarios').select('nombre_completo').eq('id', profesorId).single()
console.log('✅', CUENTAS.profesor, `· ${profRow?.nombre_completo ?? '—'}`)

// ── 3) ugel@ y director@ ─────────────────────────────────────────────────────
const ugelId = await ensureAuth(CUENTAS.ugel)
await db.from('usuarios').upsert({ id: ugelId, rol_id: roles.ugel, colegio_id: null, nombre_completo: 'Especialista UGEL 06', es_sintetico: true })
console.log('✅', CUENTAS.ugel)

const directorId = await ensureAuth(CUENTAS.director)
await db.from('usuarios').upsert({ id: directorId, rol_id: roles.director, colegio_id: colegioDemo, nombre_completo: 'Director(a)', es_sintetico: true })
console.log('✅', CUENTAS.director, '· mismo colegio que profesor@')

// ── 4) purga: un solo usuario por rol para ugel y director ───────────────────
const conservar = new Set([ugelId, directorId, profesorId])
const { data: todos } = await db.from('usuarios').select('id, rol_id, nombre_completo')
const auth = await authUsers()
let purgados = 0
for (const u of todos ?? []) {
  if (conservar.has(u.id)) continue
  if (rolKey[u.rol_id] === 'profesor') continue        // los docentes sostienen dictados y notas
  await borrarCuenta(u.id, `${auth.find((a) => a.id === u.id)?.email ?? u.id} (${rolKey[u.rol_id]})`)
  purgados++
}

// Cuentas de Auth sin fila en `usuarios` (huérfanas de corridas anteriores).
const { data: vigentes } = await db.from('usuarios').select('id')
const idsVigentes = new Set((vigentes ?? []).map((u) => u.id))
for (const a of await authUsers()) {
  if (!idsVigentes.has(a.id)) { await borrarCuenta(a.id, `${a.email} (sin fila en usuarios)`); purgados++ }
}

const { count: nUsuarios } = await db.from('usuarios').select('*', { count: 'exact', head: true })
const { count: nProfes } = await db.from('usuarios').select('*', { count: 'exact', head: true }).eq('rol_id', roles.profesor)
console.log(`\n🧹 ${purgados} cuentas purgadas · quedan ${nUsuarios} usuarios: 1 ugel + 1 director + ${nProfes} docentes (uno de ellos es profesor@)`)
console.log(`🔑 Contraseña (las tres): ${PASS}`)
console.log(`   ${CUENTAS.ugel} · ${CUENTAS.director} · ${CUENTAS.profesor}`)
