// Cuentas demo con logins simples sobre el modelo unificado (migración 008).
// Idempotente. Uso: node --env-file=.env scripts/demo-users.mjs  (o npm run db:demo-users)
//
// Qué hace:
//   1. Elimina las cuentas javier.*@kipu.demo (auth + usuarios cae por cascade).
//   2. Garantiza tres logins fáciles con la misma contraseña demo:
//        · ugel@kipu.demo      → rol ugel (ve todo, sin colegio)
//        · director@kipu.demo  → rol director, ligado a un colegio CON datos
//        · profesor@kipu.demo  → un profesor real (con dictados/notas) renombrado,
//                                 para que su panel no salga vacío
//   No toca a los 30 profesores restantes (son carga estructural de dictados/notas).
import { db, DEMO_PASS as PASS } from './lib/client.mjs'

const DOMAIN = '@kipu.demo'
const authUsers = async () => (await db.auth.admin.listUsers({ perPage: 1000 })).data.users
const byEmail = (users, email) => users.find((u) => u.email === email)

// ── roles ────────────────────────────────────────────────────────────────────
const { data: rolesRows, error: rErr } = await db.from('roles').select('id,key')
if (rErr) throw new Error(`roles: ${rErr.message}`)
const roles = Object.fromEntries(rolesRows.map((r) => [r.key, r.id]))
for (const k of ['ugel', 'director', 'profesor']) if (!roles[k]) throw new Error(`falta el rol '${k}' (¿corriste las migraciones?)`)

// ── 1) borrar javier.* ───────────────────────────────────────────────────────
let users = await authUsers()
const javier = users.filter((u) => u.email?.startsWith('javier.') && u.email.endsWith(DOMAIN))
for (const u of javier) {
  const { error } = await db.auth.admin.deleteUser(u.id)
  if (error) throw new Error(`borrar ${u.email}: ${error.message}`)
  console.log('🗑️  borrado', u.email)
}
if (!javier.length) console.log('· sin cuentas javier.* que borrar')

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

// ── 2) ugel@ ─────────────────────────────────────────────────────────────────
const ugelId = await ensureAuth('ugel' + DOMAIN)
await db.from('usuarios').upsert({ id: ugelId, rol_id: roles.ugel, colegio_id: null, nombre_completo: 'Especialista UGEL', es_sintetico: true })
console.log('✅ ugel' + DOMAIN)

// ── 3) elegir un colegio CON datos (un dictado; preferir uno con evidencias) ──
const { data: evid } = await db.from('evidencias').select('profesor_id').limit(1)
let profesorId = evid?.[0]?.profesor_id ?? null
if (!profesorId) {
  const { data: d } = await db.from('dictados').select('profesor_id').limit(1)
  profesorId = d?.[0]?.profesor_id ?? null
}
if (!profesorId) {
  console.log('\n⚠️  No hay dictados/evidencias en la DB todavía.')
  console.log('   Corre primero:  npm run db:poblacion  &&  npm run db:seed')
  console.log('   Luego vuelve a correr este script para ligar director@ y profesor@.')
  console.log(`\n🔑 Contraseña demo: ${PASS}`)
  process.exit(0)
}

// colegio del profesor elegido (dictado → aula → colegio)
const { data: dRow } = await db.from('dictados').select('aulas(colegio_id)').eq('profesor_id', profesorId).limit(1).single()
const colegioId = dRow?.aulas?.colegio_id
if (!colegioId) throw new Error('no pude resolver el colegio del profesor elegido')

// ── 4) profesor@ : renombrar el email del profesor elegido ───────────────────
users = await authUsers()
const yaProfesor = byEmail(users, 'profesor' + DOMAIN)
if (yaProfesor && yaProfesor.id !== profesorId) {
  // ya existe un profesor@ distinto: liberamos el email borrándolo (no ancla datos si no tiene dictado)
  const { data: suyos } = await db.from('dictados').select('id', { count: 'exact', head: true }).eq('profesor_id', yaProfesor.id)
  if (suyos) { /* tiene datos: lo dejamos y usamos ese en vez de renombrar */ profesorId = yaProfesor.id }
  else { await db.auth.admin.deleteUser(yaProfesor.id) }
}
if (!byEmail(await authUsers(), 'profesor' + DOMAIN)) {
  const { error } = await db.auth.admin.updateUserById(profesorId, { email: 'profesor' + DOMAIN, password: PASS, email_confirm: true })
  if (error) throw new Error(`renombrar a profesor${DOMAIN}: ${error.message}`)
}
console.log('✅ profesor' + DOMAIN, '· colegio con datos')

// ── 5) director@ : rol director en ese mismo colegio ─────────────────────────
const directorId = await ensureAuth('director' + DOMAIN)
await db.from('usuarios').upsert({ id: directorId, rol_id: roles.director, colegio_id: colegioId, nombre_completo: 'Director(a)', es_sintetico: true })
console.log('✅ director' + DOMAIN, '· mismo colegio que profesor@')

console.log(`\n🔑 Contraseña (las tres): ${PASS}`)
console.log('   ugel@kipu.demo · director@kipu.demo · profesor@kipu.demo')
