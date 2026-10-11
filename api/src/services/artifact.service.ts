// Pipeline compartido de subida/resubida de EVIDENCIAS (polimórfico unidad/sesión):
// almacena el archivo, lo convierte a markdown, lo evalúa con Gemini y persiste
// versión + evaluación + contexto IA. La evidencia cuelga de una unidad O una sesión.
import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import type { Express } from 'express'
import type {} from 'multer'
import { db, audit } from '../infra/supabase.ts'
import { GEMINI_MODEL, PROMPT_VERSION, RUBRIC_VERSION, ALLOWED, VALID_SCORE_MIN } from '../config/env.ts'
import { toMarkdown } from './markdown.service.ts'
import { evaluate, summarizeContext, type ArtifactContext } from './analysis/index.ts'

export function validateFile(file?: Express.Multer.File) {
  if (!file) return 'Falta el archivo'
  const ext = extname(file.originalname).toLowerCase()
  if (!ALLOWED[ext]) return 'Solo se aceptan archivos PDF, PPTX o XLSX'
  return null
}

// Evidencia: { id, unidad_id | sesion_id, profesor_id }. meta: { kind, subject, grade, parentUnitId? }.
export interface EvidenciaMeta { kind: 'UNIDAD' | 'SESION'; subject: string; grade: string; parentUnitId?: string | null }

export async function processUpload(
  profile: any,
  file: Express.Multer.File,
  evidencia: any,
  meta: EvidenciaMeta,
  version: number,
  previousEval?: string,
) {
  const sha256 = createHash('sha256').update(file.buffer).digest('hex')
  const path = `${evidencia.id}/v${version}/${Date.now()}-${file.originalname}`
  const { error: upErr } = await db.storage.from('evidence').upload(path, file.buffer, { contentType: file.mimetype })
  if (upErr) throw new Error(`storage: ${upErr.message}`)

  const { data: [ver] } = await db.from('evidencia_versiones').insert({
    evidencia_id: evidencia.id, version, nombre_archivo: file.originalname, storage_path: path, sha256,
  }).select() as any

  const kindLabel = meta.kind === 'UNIDAD' ? 'unidad de aprendizaje' : 'sesión de aprendizaje'
  let unitContext: string | undefined
  let markdown = ''
  let evaluation
  let legible = true
  try {
    markdown = await toMarkdown(file.buffer, file.originalname)
    if (markdown.trim().length < 50) {
      legible = false
      evaluation = { decision: 'MANUAL_REVIEW' as const, overall_score: 0, confidence: 0, summary: 'El documento está vacío o no se pudo leer su contenido. Un especialista lo revisará.', strengths: [] as string[], improvements: [] as string[], criteria: {} as object, criticalFlags: ['EMPTY_DOCUMENT'] }
    } else {
      if (meta.kind === 'SESION' && meta.parentUnitId) {
        const { data: uctx, error: uctxError } = await db.from('contextos_ia').select('contexto').eq('unidad_id', meta.parentUnitId).maybeSingle() as any
        if (uctxError) throw new Error(`contexto de la unidad: ${uctxError.message}`)
        if (uctx?.contexto) unitContext = JSON.stringify(uctx.contexto)
      }
      evaluation = await evaluate(markdown, { type: kindLabel, subject: meta.subject, grade: meta.grade, previous: previousEval, unitContext })
      if (evaluation.decision === 'MANUAL_REVIEW') legible = false
    }
  } catch (e: any) {
    await db.from('evidencia_versiones').update({ estado: 'PROCESSING_ERROR', markdown }).eq('id', ver.id)
    await db.from('evidencias').update({ estado: 'PROCESSING_ERROR', version_actual: version }).eq('id', evidencia.id)
    throw e
  }

  // La entrega siempre queda registrada. Una evaluación completada cuenta como
  // válida si llega a 75/100; la coherencia de una sesión ya integra la rúbrica.
  const score = evaluation.overall_score
  const isValid = legible && evaluation.decision === 'APPROVED' && score >= VALID_SCORE_MIN
  const invalidReason: string | null = legible
    ? (isValid ? null : `El puntaje (${score}/100) no alcanza el mínimo de ${VALID_SCORE_MIN} para contar como válida.`)
    : 'El documento está vacío o no se pudo leer su contenido; queda sin calificar.'
  let context: ArtifactContext | null = null

  if (legible) {
    try {
      context = await summarizeContext(markdown, { type: kindLabel, subject: meta.subject, grade: meta.grade })
    } catch (e) {
      console.error('context summary failed', e)
    }
  }

  const estado = evaluation.decision
  await db.from('evidencia_versiones').update({ estado, markdown, es_valida: isValid, motivo_invalidez: invalidReason }).eq('id', ver.id)
  await db.from('evidencias').update({ estado, version_actual: version, updated_at: new Date().toISOString() }).eq('id', evidencia.id)
  await db.from('evaluaciones').insert({
    version_id: ver.id, modelo: GEMINI_MODEL, prompt_version: PROMPT_VERSION, rubrica_version: RUBRIC_VERSION,
    decision: estado, puntaje_total: evaluation.overall_score, confianza: evaluation.confidence, resumen: evaluation.summary,
    fortalezas: evaluation.strengths, mejoras: evaluation.improvements, criterios: evaluation.criteria, flags_criticos: evaluation.criticalFlags,
  })

  if (context) {
    const target = evidencia.unidad_id ? { unidad_id: evidencia.unidad_id } : { sesion_id: evidencia.sesion_id }
    const onConflict = evidencia.unidad_id ? 'unidad_id' : 'sesion_id'
    await db.from('contextos_ia').upsert({ ...target, contexto: context }, { onConflict })
  }
  await audit(profile.id, 'EVIDENCIA_EVALUADA', 'evidencia', evidencia.id, { version, decision: estado, score: evaluation.overall_score, is_valid: isValid })
  // Devuelve la evaluación en la forma de dominio del front (overall_score, no puntaje_total).
  return {
    artifact_id: evidencia.id,
    status: estado,
    version,
    is_valid: isValid,
    invalid_reason: invalidReason,
    evaluation: {
      overall_score: evaluation.overall_score,
      decision: estado,
      summary: evaluation.summary,
      strengths: evaluation.strengths,
      improvements: evaluation.improvements,
      criteria: evaluation.criteria,
    },
  }
}
