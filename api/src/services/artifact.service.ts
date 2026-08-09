// Pipeline compartido de subida/resubida de EVIDENCIAS (polimórfico unidad/sesión):
// almacena el archivo, lo convierte a markdown, lo evalúa con Gemini y persiste
// versión + evaluación + contexto IA. La evidencia cuelga de una unidad O una sesión.
import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import { db, audit } from '../infra/supabase.ts'
import { GEMINI_MODEL, PROMPT_VERSION, RUBRIC_VERSION, ALLOWED, VALID_SCORE_MIN } from '../config/env.ts'
import { toMarkdown } from './markdown.service.ts'
import { evaluate, summarizeContext, checkSessionCoherence, type ArtifactContext } from './analysis/index.ts'

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
  let markdown = ''
  let evaluation
  let legible = true
  try {
    markdown = await toMarkdown(file.buffer, file.originalname)
    if (markdown.trim().length < 50) {
      legible = false
      evaluation = { decision: 'MANUAL_REVIEW' as const, overall_score: 0, confidence: 0, summary: 'El documento está vacío o no se pudo leer su contenido. Un especialista lo revisará.', strengths: [] as string[], improvements: [] as string[], criteria: {} as object, criticalFlags: ['EMPTY_DOCUMENT'] }
    } else {
      evaluation = await evaluate(markdown, { type: kindLabel, subject: meta.subject, grade: meta.grade, previous: previousEval })
    }
  } catch (e: any) {
    await db.from('evidencia_versiones').update({ estado: 'PROCESSING_ERROR', markdown }).eq('id', ver.id)
    await db.from('evidencias').update({ estado: 'PROCESSING_ERROR', version_actual: version }).eq('id', evidencia.id)
    throw e
  }

  // Validez: el documento SIEMPRE queda subido; la validez decide si cuenta como
  // unidad/sesión válida (umbral de puntaje y —para sesiones— coherencia con su unidad).
  const score = evaluation.overall_score
  let isValid = legible && score >= VALID_SCORE_MIN
  let invalidReason: string | null = legible
    ? (isValid ? null : `El puntaje (${score}/100) no alcanza el mínimo de ${VALID_SCORE_MIN} para contar como válida.`)
    : 'El documento está vacío o no se pudo leer su contenido.'
  let context: ArtifactContext | null = null

  if (legible) {
    try {
      context = await summarizeContext(markdown, { type: kindLabel, subject: meta.subject, grade: meta.grade })
      // Sesión: además del puntaje, debe pertenecer al área/temas de su unidad.
      if (meta.kind === 'SESION' && meta.parentUnitId) {
        const { data: uctx } = await db.from('contextos_ia').select('contexto').eq('unidad_id', meta.parentUnitId).maybeSingle() as any
        if (uctx?.contexto) {
          const coh = await checkSessionCoherence(context, uctx.contexto)
          if (!coh.coherent) {
            isValid = false
            invalidReason = coh.reason || 'La sesión no corresponde a la unidad de aprendizaje seleccionada.'
          }
        }
      }
    } catch (e) {
      console.error('context/coherence failed', e)
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
