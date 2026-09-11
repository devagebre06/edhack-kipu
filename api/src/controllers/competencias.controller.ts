// Controlador de competencias del docente.
import type express from 'express'
import { z } from 'zod'
import { getUser } from '../middleware/auth.ts'
import { getCompetenciasDocente, guardarCompetencia, ESTADOS } from '../services/competencias.service.ts'

const soloDocente = async (req: express.Request, res: express.Response) => {
  const profile = await getUser(req)
  if (!profile) { res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }); return null }
  if (profile.role !== 'profesor') { res.status(403).json({ error: 'Esta sección es del docente.' }); return null }
  return profile
}

// GET /api/v1/competencias — las de todos sus dictados, con desempeño y seguimiento.
export async function getCompetencias(req: express.Request, res: express.Response) {
  try {
    const profile = await soloDocente(req, res)
    if (!profile) return
    res.json(await getCompetenciasDocente(profile.id))
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron cargar tus competencias.', detail: String(e.message || e) })
  }
}

const guardarSchema = z.object({
  dictado_id: z.string().uuid(),
  competencia: z.string().min(2).max(8),
  estado: z.enum(ESTADOS.map((e) => e.key) as [string, ...string[]]).optional(),
  nota: z.string().max(2000).optional(),
})

// PUT /api/v1/competencias — guarda estado y/o plan de una competencia.
export async function putCompetencia(req: express.Request, res: express.Response) {
  try {
    const profile = await soloDocente(req, res)
    if (!profile) return
    const parsed = guardarSchema.safeParse(req.body ?? {})
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos.', detail: parsed.error.issues })

    const out = await guardarCompetencia(profile.id, parsed.data)
    if ('error' in out) return res.status(400).json(out)
    res.json(out)
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo guardar la competencia.', detail: String(e.message || e) })
  }
}
