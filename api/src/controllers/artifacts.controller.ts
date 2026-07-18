// Controladores HTTP para las evidencias (artifacts): validación, reglas de negocio y respuesta.
import type express from 'express'
import { db, audit } from '../infra/supabase.ts'
import { getUser } from '../middleware/auth.ts'
import { WINDOW_BEFORE_MIN } from '../config/env.ts'
import { processUpload, validateFile } from '../services/artifact.service.ts'

const ARTIFACT_TYPES = ['DAILY_SESSION', 'MONTHLY_UNIT', 'BIMONTHLY_GRADES', 'ANNUAL_GRADE_SUMMARY']

// POST /api/v1/artifacts — crea una evidencia nueva (versión 1).
export async function createArtifact(req: express.Request, res: express.Response) {
  try {
    const profile = await getUser(req)
    if (!profile || profile.role !== 'teacher') return res.status(403).json({ error: 'Solo profesores pueden subir evidencias' })
    const fileErr = validateFile(req.file)
    if (fileErr) return res.status(400).json({ error: fileErr })
    const { type, subject_id, group_id } = req.body
    if (!ARTIFACT_TYPES.includes(type)) return res.status(400).json({ error: 'Tipo de evidencia inválido' })

    if (type === 'DAILY_SESSION') {
      const now = new Date()
      const { data: scheds } = await db.from('class_schedules').select('*').eq('teacher_id', profile.id).eq('group_id', group_id).eq('weekday', now.getDay())
      const hm = now.toTimeString().slice(0, 5)
      const inWindow = (scheds || []).some(s => {
        const start = new Date(`2000-01-01T${s.start_time}`)
        start.setMinutes(start.getMinutes() - WINDOW_BEFORE_MIN)
        return hm >= start.toTimeString().slice(0, 5) && hm <= s.end_time.slice(0, 5)
      })
      if (!inWindow) {
        await audit(profile.id, 'UPLOAD_OUT_OF_WINDOW', 'schedule', undefined, { group_id, at: now.toISOString() })
        return res.status(403).json({ error: `Fuera de la ventana de subida. Las sesiones diarias solo pueden subirse desde ${WINDOW_BEFORE_MIN} minutos antes del inicio de tu clase hasta su término.` })
      }
    }

    const { data: [artifact], error } = await db.from('artifacts').insert({
      teacher_id: profile.id, institution_id: profile.institution_id, subject_id, group_id, type,
    }).select() as any
    if (error) throw error
    await audit(profile.id, 'ARTIFACT_UPLOADED', 'artifact', artifact.id, { filename: req.file!.originalname })
    res.json(await processUpload(profile, req.file!, artifact, 1))
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo procesar el documento. Intenta nuevamente.', detail: String(e.message || e) })
  }
}

// POST /api/v1/artifacts/:id/versions — sube una nueva versión (corrección) de una evidencia existente.
export async function createArtifactVersion(req: express.Request, res: express.Response) {
  try {
    const profile = await getUser(req)
    if (!profile || profile.role !== 'teacher') return res.status(403).json({ error: 'Solo profesores' })
    const fileErr = validateFile(req.file)
    if (fileErr) return res.status(400).json({ error: fileErr })
    const { data: artifact } = await db.from('artifacts').select('*').eq('id', req.params.id).eq('teacher_id', profile.id).single()
    if (!artifact) return res.status(404).json({ error: 'Entrega no encontrada' })
    if (artifact.status === 'APPROVED') return res.status(403).json({ error: 'Una entrega aprobada no admite nuevas versiones' })
    const { data: prevEval } = await db.from('evaluations').select('summary,improvements,overall_score')
      .eq('artifact_version_id', (await db.from('artifact_versions').select('id').eq('artifact_id', artifact.id).eq('version', artifact.current_version).single()).data?.id).single()
    await audit(profile.id, 'ARTIFACT_RESUBMITTED', 'artifact', artifact.id, { new_version: artifact.current_version + 1 })
    res.json(await processUpload(profile, req.file!, artifact, artifact.current_version + 1, prevEval ? JSON.stringify(prevEval) : undefined))
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo procesar el documento. Intenta nuevamente.', detail: String(e.message || e) })
  }
}
