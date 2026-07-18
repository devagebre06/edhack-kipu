import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFile, unlink, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import ws from 'ws'

const env = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`falta env ${k}`)
  return v
}
const SUPABASE_URL = env('SUPABASE_URL')
const db = createClient(SUPABASE_URL, env('SUPABASE_SERVICE_ROLE_KEY'), { realtime: { transport: ws } })
const GEMINI_KEY = env('GEMINI_API_KEY')
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const WINDOW_BEFORE_MIN = Number(process.env.SESSION_UPLOAD_WINDOW_BEFORE_MINUTES || 30)
const MAX_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 15)
const PROMPT_VERSION = 'v1'

const rubric = JSON.parse(await readFile(new URL('../config/rubrics/daily-session.v1.json', import.meta.url), 'utf8'))

const app = express()
app.use(cors())
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_MB * 1024 * 1024 } })
const ALLOWED = { '.pdf': 'application/pdf', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as Record<string, string>

const audit = (actor_id: string | null, action: string, entity_type?: string, entity_id?: string, metadata: object = {}) =>
  db.from('audit_logs').insert({ actor_id, action, entity_type, entity_id, metadata }).then(() => {})

// --- auth ---
async function getUser(req: express.Request) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return null
  const { data } = await db.auth.getUser(token)
  if (!data.user) return null
  const { data: profile } = await db.from('profiles').select('*').eq('id', data.user.id).single()
  return profile
}

// --- markitdown ---
const exec = promisify(execFile)
async function toMarkdown(buf: Buffer, filename: string) {
  const tmp = join(tmpdir(), `kipu-${Date.now()}${extname(filename)}`)
  await writeFile(tmp, buf)
  try {
    const { stdout } = await exec('markitdown', [tmp], { maxBuffer: 20 * 1024 * 1024, timeout: 60000 })
    return stdout
  } finally { unlink(tmp).catch(() => {}) }
}

// --- gemini ---
const EvalSchema = z.object({
  decision: z.enum(['APPROVED', 'NEEDS_REVISION', 'MANUAL_REVIEW']),
  overall_score: z.number(),
  confidence: z.number(),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  criteria: z.array(z.object({
    criterionCode: z.string(), criterionName: z.string(), score: z.number(), maxScore: z.number(),
    status: z.enum(['PASS', 'PARTIAL', 'FAIL']), confidence: z.number(),
    evidence: z.array(z.object({ quote: z.string(), location: z.string() })),
    feedback: z.string(),
  })),
  criticalFlags: z.array(z.string()),
})

async function evaluate(markdown: string, ctx: { type: string; subject: string; grade: string; previous?: string }) {
  const prompt = `Eres un especialista pedagógico de UGEL (Perú, CNEB). Evalúa el siguiente documento de tipo ${ctx.type} del curso "${ctx.subject}" (${ctx.grade}) contra la rúbrica. Sé específico, respetuoso y no punitivo; la retroalimentación debe ser accionable para el docente.

RÚBRICA (JSON): ${JSON.stringify(rubric.criteria)}

${ctx.previous ? `EVALUACIÓN ANTERIOR (es una corrección, compara y reconoce mejoras): ${ctx.previous}\n` : ''}
DOCUMENTO (Markdown extraído):
${markdown.slice(0, 60000)}

Responde SOLO el JSON pedido. decision: APPROVED si score>=80 sin criterio crítico en FAIL; NEEDS_REVISION si score<80 o falla un criterio crítico; MANUAL_REVIEW si el documento es ilegible o la información es insuficiente (confidence<0.75). criticalFlags: códigos MISSING_<code> por cada criterio crítico en FAIL.`

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            decision: { type: 'STRING', enum: ['APPROVED', 'NEEDS_REVISION', 'MANUAL_REVIEW'] },
            overall_score: { type: 'INTEGER' }, confidence: { type: 'NUMBER' }, summary: { type: 'STRING' },
            strengths: { type: 'ARRAY', items: { type: 'STRING' } },
            improvements: { type: 'ARRAY', items: { type: 'STRING' } },
            criteria: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
              criterionCode: { type: 'STRING' }, criterionName: { type: 'STRING' }, score: { type: 'INTEGER' }, maxScore: { type: 'INTEGER' },
              status: { type: 'STRING', enum: ['PASS', 'PARTIAL', 'FAIL'] }, confidence: { type: 'NUMBER' },
              evidence: { type: 'ARRAY', items: { type: 'OBJECT', properties: { quote: { type: 'STRING' }, location: { type: 'STRING' } }, required: ['quote', 'location'] } },
              feedback: { type: 'STRING' },
            }, required: ['criterionCode', 'criterionName', 'score', 'maxScore', 'status', 'confidence', 'evidence', 'feedback'] } },
            criticalFlags: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['decision', 'overall_score', 'confidence', 'summary', 'strengths', 'improvements', 'criteria', 'criticalFlags'],
        },
      },
    }),
  })
  const body = await res.json() as any
  if (!res.ok) throw new Error(`gemini ${res.status}: ${JSON.stringify(body).slice(0, 300)}`)
  const parsed = EvalSchema.parse(JSON.parse(body.candidates[0].content.parts[0].text))
  if (parsed.confidence < 0.75) parsed.decision = 'MANUAL_REVIEW'
  return parsed
}

// --- pipeline compartido subida/resubida ---
async function processUpload(profile: any, file: Express.Multer.File, artifact: any, version: number, previousEval?: string) {
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
      evaluation = { decision: 'MANUAL_REVIEW' as const, overall_score: 0, confidence: 0, summary: 'El documento está vacío o no se pudo leer su contenido. Un especialista lo revisará.', strengths: [], improvements: [], criteria: [], criticalFlags: ['EMPTY_DOCUMENT'] }
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
    artifact_version_id: ver.id, model_name: GEMINI_MODEL, prompt_version: PROMPT_VERSION, rubric_version: rubric.version,
    decision: status, overall_score: evaluation.overall_score, confidence: evaluation.confidence, summary: evaluation.summary,
    strengths: evaluation.strengths, improvements: evaluation.improvements, criteria: evaluation.criteria, critical_flags: evaluation.criticalFlags,
  }).select() as any
  await audit(profile.id, 'ARTIFACT_EVALUATED', 'artifact', artifact.id, { version, decision: status, score: evaluation.overall_score })
  return { artifact_id: artifact.id, version, status, evaluation: ev }
}

function validateFile(file?: Express.Multer.File) {
  if (!file) return 'Falta el archivo'
  const ext = extname(file.originalname).toLowerCase()
  if (!ALLOWED[ext]) return 'Solo se aceptan archivos PDF, PPTX o XLSX'
  return null
}

app.post('/api/v1/artifacts', upload.single('file'), async (req, res) => {
  try {
    const profile = await getUser(req)
    if (!profile || profile.role !== 'teacher') return res.status(403).json({ error: 'Solo profesores pueden subir evidencias' })
    const fileErr = validateFile(req.file)
    if (fileErr) return res.status(400).json({ error: fileErr })
    const { type, subject_id, group_id } = req.body
    if (!['DAILY_SESSION', 'MONTHLY_UNIT', 'BIMONTHLY_GRADES', 'ANNUAL_GRADE_SUMMARY'].includes(type)) return res.status(400).json({ error: 'Tipo de evidencia inválido' })

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
})

app.post('/api/v1/artifacts/:id/versions', upload.single('file'), async (req, res) => {
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
})

app.get('/health', (_req, res) => res.json({ ok: true }))

app.listen(Number(process.env.PORT || 3001), () => console.log('kipu api on', process.env.PORT || 3001))
