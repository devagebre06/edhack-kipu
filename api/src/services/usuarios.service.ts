// Alta y gestión de usuarios de la plataforma (rol UGEL). Crea la cuenta de
// acceso en Supabase Auth (service-role) y su fila en `usuarios` (con rol y
// colegio); si `usuarios` falla, revierte la cuenta de Auth para no dejar
// cuentas huérfanas. El control de acceso (solo rol ugel) lo hace el controlador.
import { db } from '../infra/supabase.ts'

export const ROLES = ['ugel', 'director', 'profesor'] as const
export type NewUserRole = (typeof ROLES)[number]

// Roles que operan dentro de un colegio (requieren colegio_id).
const COLEGIO_ROLES: NewUserRole[] = ['director', 'profesor']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BAN_FOREVER = '876000h' // ~100 años

// Cache de roles.key → id.
let rolesCache: Record<string, string> | null = null
async function roleId(key: NewUserRole) {
  if (!rolesCache) {
    const { data } = await db.from('roles').select('id, key')
    rolesCache = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.id]))
  }
  return rolesCache[key]
}

// ── Catálogo: colegios + usuarios ya registrados (para el panel de UGEL) ──────
export async function getUsuariosPanel() {
  const [{ data: colegios }, { data: usuarios }, authList] = await Promise.all([
    db.from('colegios').select('id, nombre').order('nombre'),
    db.from('usuarios').select('id, nombre_completo, colegio_id, deleted_at, roles(key), colegios(nombre)').order('nombre_completo'),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ])
  const emailById = new Map((authList.data?.users ?? []).map((u: any) => [u.id, u.email]))
  const users = (usuarios ?? []).map((p: any) => ({
    id: p.id,
    full_name: p.nombre_completo,
    role: p.roles?.key ?? null,
    email: emailById.get(p.id) ?? null,
    colegio_id: p.colegio_id,
    colegio_name: p.colegios?.nombre ?? null,
    deleted_at: p.deleted_at ?? null,
    active: !p.deleted_at,
  }))
  return { colegios: colegios ?? [], users }
}

async function findUsuario(id: string) {
  const { data } = await db.from('usuarios').select('id, deleted_at').eq('id', id).maybeSingle()
  return data
}

// ── Crear un usuario (cuenta de acceso + fila usuarios) ───────────────────────
export async function createUsuario(body: any) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const full_name = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
  const role = body?.role as NewUserRole
  const colegio_id = body?.colegio_id || null

  if (!email || !EMAIL_RE.test(email)) return { error: 'Correo inválido.' }
  if (!password || password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  if (!full_name) return { error: 'El nombre completo es obligatorio.' }
  if (!ROLES.includes(role)) return { error: `Rol inválido. Use uno de: ${ROLES.join(', ')}.` }

  if (COLEGIO_ROLES.includes(role)) {
    if (!colegio_id) return { error: 'Los usuarios director y profesor requieren un colegio.' }
    const { data: col } = await db.from('colegios').select('id').eq('id', colegio_id).maybeSingle()
    if (!col) return { error: 'El colegio seleccionado no existe.' }
  }

  const { data: created, error: authError } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (authError || !created?.user) {
    const msg = authError?.message || ''
    if (/already been registered|already exists/i.test(msg)) return { error: 'Ya existe un usuario con ese correo.' }
    return { error: msg || 'No se pudo crear la cuenta de acceso.' }
  }

  const { error: insErr } = await db.from('usuarios').insert({
    id: created.user.id,
    rol_id: await roleId(role),
    colegio_id: COLEGIO_ROLES.includes(role) ? colegio_id : null,
    nombre_completo: full_name,
  })
  if (insErr) {
    await db.auth.admin.deleteUser(created.user.id)
    return { error: insErr.message }
  }
  return { data: { id: created.user.id, email, full_name, role, colegio_id: COLEGIO_ROLES.includes(role) ? colegio_id : null } }
}

// ── Actualizar contraseña ─────────────────────────────────────────────────────
export async function updateUsuarioPassword(id: string, password: string) {
  if (!password || password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  if (!(await findUsuario(id))) return { error: 'Usuario no encontrado.' }
  const { error } = await db.auth.admin.updateUserById(id, { password })
  if (error) return { error: error.message }
  return { data: { id } }
}

// ── Actualizar correo ─────────────────────────────────────────────────────────
export async function updateUsuarioEmail(id: string, emailRaw: string) {
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : ''
  if (!email || !EMAIL_RE.test(email)) return { error: 'Correo inválido.' }
  if (!(await findUsuario(id))) return { error: 'Usuario no encontrado.' }
  const { error } = await db.auth.admin.updateUserById(id, { email, email_confirm: true })
  if (error) {
    if (/already been registered|already exists/i.test(error.message)) return { error: 'Ya existe un usuario con ese correo.' }
    return { error: error.message }
  }
  return { data: { id, email } }
}

// ── Baja lógica ───────────────────────────────────────────────────────────────
export async function softDeleteUsuario(id: string, actorId: string) {
  if (id === actorId) return { error: 'No puedes darte de baja a ti mismo.' }
  if (!(await findUsuario(id))) return { error: 'Usuario no encontrado.' }
  const { error } = await db.from('usuarios').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  await db.auth.admin.updateUserById(id, { ban_duration: BAN_FOREVER })
  return { data: { id } }
}

// ── Reactivar ─────────────────────────────────────────────────────────────────
export async function restoreUsuario(id: string) {
  if (!(await findUsuario(id))) return { error: 'Usuario no encontrado.' }
  const { error } = await db.from('usuarios').update({ deleted_at: null }).eq('id', id)
  if (error) return { error: error.message }
  await db.auth.admin.updateUserById(id, { ban_duration: 'none' })
  return { data: { id } }
}

// ── Baja definitiva ───────────────────────────────────────────────────────────
export async function hardDeleteUsuario(id: string, actorId: string) {
  if (id === actorId) return { error: 'No puedes eliminar tu propia cuenta.' }
  if (!(await findUsuario(id))) return { error: 'Usuario no encontrado.' }
  const { error } = await db.from('usuarios').delete().eq('id', id)  // datos_personales cae por cascade
  if (error) return { error: error.message }
  const { error: authError } = await db.auth.admin.deleteUser(id)
  if (authError) return { error: authError.message }
  return { data: { id } }
}
