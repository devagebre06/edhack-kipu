// Controlador del registro de notas del docente.
import type express from 'express'
import { z } from 'zod'
import { getUser } from '../middleware/auth.ts'
import { audit } from '../infra/supabase.ts'
import { getRegistro, guardarRegistro } from '../services/notas.service.ts'

// GET /api/v1/notas/registro?dictado_id=&periodo_id=
export async function getRegistroNotas(req: express.Request, res: express.Response) {
  try {
    const profile = await getUser(req)
    if (!profile) return res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' })
    if (profile.role !== 'profesor') {
      return res.status(403).json({ error: 'Solo los docentes pueden registrar notas.' })
    }
    const dictadoId = typeof req.query.dictado_id === 'string' ? req.query.dictado_id : ''
    if (!dictadoId) return res.status(400).json({ error: 'Indica el dictado (curso y aula).' })
    const periodoId = typeof req.query.periodo_id === 'string' ? req.query.periodo_id : undefined

    const out = await getRegistro(profile.id, dictadoId, periodoId)
    if ('error' in out) return res.status(400).json(out)
    res.json(out)
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo cargar el registro de notas.', detail: String(e.message || e) })
  }
}

const guardarSchema = z.object({
  dictado_id: z.string().uuid(),
  periodo_id: z.string().uuid(),
  filas: z.array(z.object({
    alumno_id: z.string().uuid(),
    notas: z.record(z.string(), z.string()),
  })).min(1).max(500),
})

// POST /api/v1/notas/registro — guarda (o corrige) el registro completo.
export async function postRegistroNotas(req: express.Request, res: express.Response) {
  try {
    const profile = await getUser(req)
    if (!profile) return res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' })
    if (profile.role !== 'profesor') {
      return res.status(403).json({ error: 'Solo los docentes pueden registrar notas.' })
    }
    const parsed = guardarSchema.safeParse(req.body ?? {})
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos.', detail: parsed.error.issues })

    const out = await guardarRegistro(profile.id, parsed.data)
    if ('error' in out) return res.status(400).json(out)

    await audit(profile.id, 'NOTAS_REGISTRADAS', 'dictado', parsed.data.dictado_id, {
      periodo: out.periodo, alumnos: out.alumnos, notas: out.guardadas,
    })
    res.json(out)
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron guardar las notas.', detail: String(e.message || e) })
  }
}
