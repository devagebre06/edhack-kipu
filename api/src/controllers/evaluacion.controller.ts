// Controlador de «Cómo se evalúa»: expone la configuración del motor.
import type express from 'express'
import { getUser } from '../middleware/auth.ts'
import { getConfiguracionEvaluacion } from '../services/evaluacion.service.ts'

// GET /api/v1/evaluacion — método, rúbrica y prompts. Requiere sesión (cualquier rol):
// documenta el proceso, no expone datos de ninguna persona.
export async function getEvaluacion(req: express.Request, res: express.Response) {
  try {
    const profile = await getUser(req)
    if (!profile) return res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' })
    res.json(getConfiguracionEvaluacion())
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo cargar la configuración de evaluación.', detail: String(e.message || e) })
  }
}
