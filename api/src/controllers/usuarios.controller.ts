// Controladores de gestión de usuarios (solo rol UGEL). Permite crear cuentas
// de UGEL, director y profesor, y listar los usuarios existentes.
import type express from 'express'
import { getUser } from '../middleware/auth.ts'
import { audit } from '../infra/supabase.ts'
import {
  getUsuariosPanel, createUsuario, updateUsuarioPassword, updateUsuarioEmail,
  softDeleteUsuario, restoreUsuario, hardDeleteUsuario,
} from '../services/usuarios.service.ts'

// Resuelve el especialista UGEL autenticado o responde 403. Devuelve el profile o null (ya respondido).
async function requireUgel(req: express.Request, res: express.Response) {
  const profile = await getUser(req)
  if (!profile || profile.role !== 'ugel') {
    res.status(403).json({ error: 'Solo UGEL puede gestionar usuarios.' })
    return null
  }
  return profile
}

// GET /api/v1/usuarios — instituciones (catálogo) + usuarios existentes.
export async function getUsuarios(req: express.Request, res: express.Response) {
  try {
    const profile = await requireUgel(req, res)
    if (!profile) return
    res.json(await getUsuariosPanel())
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron cargar los usuarios.', detail: String(e.message || e) })
  }
}

// POST /api/v1/usuarios — crea una cuenta de acceso y su perfil.
export async function postUsuario(req: express.Request, res: express.Response) {
  try {
    const profile = await requireUgel(req, res)
    if (!profile) return
    const result = await createUsuario(req.body)
    if (result.error) return res.status(400).json({ error: result.error })
    await audit(profile.id, 'USER_CREATED', 'profile', result.data.id, { role: result.data.role })
    res.status(201).json(result.data)
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo crear el usuario.', detail: String(e.message || e) })
  }
}

// PATCH /api/v1/usuarios/:id — actualiza contraseña y/o correo.
export async function patchUsuario(req: express.Request, res: express.Response) {
  try {
    const profile = await requireUgel(req, res)
    if (!profile) return
    const { id } = req.params
    const { password, email } = req.body ?? {}
    if (password == null && email == null) return res.status(400).json({ error: 'Nada que actualizar: envía password y/o email.' })

    if (password != null) {
      const r = await updateUsuarioPassword(id, password)
      if (r.error) return res.status(400).json({ error: r.error })
      await audit(profile.id, 'USER_PASSWORD_UPDATED', 'profile', id)
    }
    if (email != null) {
      const r = await updateUsuarioEmail(id, email)
      if (r.error) return res.status(400).json({ error: r.error })
      await audit(profile.id, 'USER_EMAIL_UPDATED', 'profile', id, { email: r.data.email })
    }
    res.json({ id })
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo actualizar el usuario.', detail: String(e.message || e) })
  }
}

// POST /api/v1/usuarios/:id/restore — reactiva un usuario dado de baja lógica.
export async function restoreUsuarioCtrl(req: express.Request, res: express.Response) {
  try {
    const profile = await requireUgel(req, res)
    if (!profile) return
    const result = await restoreUsuario(req.params.id)
    if (result.error) return res.status(400).json({ error: result.error })
    await audit(profile.id, 'USER_RESTORED', 'profile', req.params.id)
    res.json(result.data)
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo reactivar el usuario.', detail: String(e.message || e) })
  }
}

// DELETE /api/v1/usuarios/:id — baja lógica (por defecto) o definitiva (?hard=true).
export async function deleteUsuario(req: express.Request, res: express.Response) {
  try {
    const profile = await requireUgel(req, res)
    if (!profile) return
    const hard = req.query.hard === 'true'
    const result = hard
      ? await hardDeleteUsuario(req.params.id, profile.id)
      : await softDeleteUsuario(req.params.id, profile.id)
    if (result.error) return res.status(result.error.includes('no encontrado') ? 404 : 400).json({ error: result.error })
    await audit(profile.id, hard ? 'USER_DELETED' : 'USER_SOFT_DELETED', 'profile', req.params.id)
    res.json(result.data)
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo eliminar el usuario.', detail: String(e.message || e) })
  }
}
