// Pipeline compartido de subida/resubida: almacena el archivo, lo convierte, lo evalúa y persiste el resultado.
import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import { db, audit } from '../infra/supabase.ts'
import { GEMINI_MODEL, PROMPT_VERSION, RUBRIC_VERSION, ALLOWED } from '../config/env.ts'
import { toMarkdown } from './markdown.service.ts'
import { evaluate } from './analysis/index.ts'

export function validateFile(file?: Express.Multer.File) {
  if (!file) return 'Falta el archivo'
  const ext = extname(file.originalname).toLowerCase()
  if (!ALLOWED[ext]) return 'Solo se aceptan archivos PDF, PPTX o XLSX'
  return null
}

export async function processUpload(
  profile: any,
  file: Express.Multer.File,
  artifact: any,
  version: number,
  previousEval?: string,
) {
  const sha256 = createHash('sha256').update(file.buffer).digest('hex')
  const path = `${artifact.id}/v${version}/${Date.now()}-${file.originalname}`
  const { error: upErr } = await db.storage.from('evidence').upload(path, file.buffer, { contentType: file.mimetype })
  if (upErr) throw new Error(`storage: ${upErr.message}`)

  const { data: [ver] } = await db.from('artifact_versions').insert({
    artifact_id: artifact.id, version, original_filename: file.originalname, storage_path: path, sha256,
  }).select() as any

  let markdown = ''
  let evaluation
  try {
    markdown = await toMarkdown(file.buffer, file.originalname)
    if (markdown.trim().length < 50) {
      evaluation = { decision: 'MANUAL_REVIEW' as const, overall_score: 0, confidence: 0, summary: 'El documento está vacío o no se pudo leer su contenido. Un especialista lo revisará.', strengths: [] as string[], improvements: [] as string[], criteria: {} as object, criticalFlags: ['EMPTY_DOCUMENT'] }
    } else {
      const { data: subj } = await db.from('subjects').select('name').eq('id', artifact.subject_id).single()
      const { data: grp } = await db.from('student_groups').select('grade').eq('id', artifact.group_id).single()
      evaluation = await evaluate(markdown, { type: artifact.type, subject: subj?.name || '', grade: grp?.grade || '', previous: previousEval })
    }
  } catch (e: any) {
    await db.from('artifact_versions').update({ status: 'PROCESSING_ERROR', markdown }).eq('id', ver.id)
    await db.from('artifacts').update({ status: 'PROCESSING_ERROR', current_version: version }).eq('id', artifact.id)
    throw e
  }

  const status = evaluation.decision
  await db.from('artifact_versions').update({ status, markdown }).eq('id', ver.id)
  await db.from('artifacts').update({ status, current_version: version, updated_at: new Date().toISOString() }).eq('id', artifact.id)
  const { data: [ev] } = await db.from('evaluations').insert({
    artifact_version_id: ver.id, model_name: GEMINI_MODEL, prompt_version: PROMPT_VERSION, rubric_version: RUBRIC_VERSION,
    decision: status, overall_score: evaluation.overall_score, confidence: evaluation.confidence, summary: evaluation.summary,
    strengths: evaluation.strengths, improvements: evaluation.improvements, criteria: evaluation.criteria, critical_flags: evaluation.criticalFlags,
  }).select() as any
  await audit(profile.id, 'ARTIFACT_EVALUATED', 'artifact', artifact.id, { version, decision: status, score: evaluation.overall_score })
  return { artifact_id: artifact.id, version, status, evaluation: ev }
}
