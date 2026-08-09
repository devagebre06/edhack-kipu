// Controladores de gestión de horarios (solo rol director, acotado a su colegio).
import type express from 'express'
import { getUser } from '../middleware/auth.ts'
import { audit } from '../infra/supabase.ts'
import { getHorariosPanel, createHorario, deleteHorario } from '../services/horarios.service.ts'

// Resuelve el director autenticado o responde 403. Devuelve el profile o null (ya respondido).
async function requireDirector(req: express.Request, res: express.Response) {
  const profile = await getUser(req)
  if (!profile || profile.role !== 'director') {
    res.status(403).json({ error: 'Solo el directivo puede gestionar horarios.' })
    return null
  }
  if (!profile.colegio_id) {
    res.status(400).json({ error: 'Tu perfil no tiene colegio asignado.' })
    return null
  }
  return profile
}

// GET /api/v1/horarios — profesores del colegio con sus dictados/horarios + catálogos.
export async function getHorarios(req: express.Request, res: express.Response) {
  try {
    const profile = await requireDirector(req, res)
    if (!profile) return
    res.json(await getHorariosPanel(profile.colegio_id!))
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron cargar los horarios.', detail: String(e.message || e) })
  }
}

// POST /api/v1/horarios — crea un horario (y su dictado si hace falta).
export async function postHorario(req: express.Request, res: express.Response) {
  try {
    const profile = await requireDirector(req, res)
    if (!profile) return
    const result = await createHorario(profile.colegio_id!, req.body)
    if (result.error) return res.status(400).json({ error: result.error })
    await audit(profile.id, 'HORARIO_CREADO', 'horario', result.data.id, { profesor_id: req.body?.profesor_id })
    res.status(201).json(result.data)
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo crear el horario.', detail: String(e.message || e) })
  }
}

// DELETE /api/v1/horarios/:id — elimina un horario del colegio.
export async function removeHorario(req: express.Request, res: express.Response) {
  try {
    const profile = await requireDirector(req, res)
    if (!profile) return
    const result = await deleteHorario(profile.colegio_id!, req.params.id)
    if (result.error) return res.status(result.error.includes('no encontrado') ? 404 : 400).json({ error: result.error })
    await audit(profile.id, 'HORARIO_ELIMINADO', 'horario', req.params.id)
    res.json(result.data)
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo eliminar el horario.', detail: String(e.message || e) })
  }
}
