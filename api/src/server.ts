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
const PROMPT_VERSION = 'v2'
const RUBRIC_VERSION = 'ficha-monitoreo-ugel06.v1'

const fichaPrompt = await readFile(new URL('../config/prompts/ficha-monitoreo-ugel06.v1.md', import.meta.url), 'utf8')

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

// --- gemini: paso 1 extracción, paso 2 evaluación con la ficha UGEL 06 ---
async function gemini(payload: object) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })
  const body = await res.json() as any
  if (!res.ok) throw new Error(`gemini ${res.status}: ${JSON.stringify(body).slice(0, 300)}`)
  return JSON.parse(body.candidates[0].content.parts[0].text)
}

const DOC_KEYS = ['insumos', 'planificacion_anual', 'unidad_didactica', 'sesion_aprendizaje', 'instrumentos_evaluacion'] as const
const ID_KEYS = ['ie', 'docente', 'nivel', 'area', 'grado_seccion', 'competencia', 'unidad', 'sesion'] as const

const ExtractionSchema = z.object({
  documentos_presentes: z.record(z.string(), z.boolean()),
  identificacion: z.record(z.string(), z.string()),
  observaciones: z.string(),
  legible: z.boolean(),
})

async function extract(markdown: string) {
  const parsed = ExtractionSchema.parse(await gemini({
    contents: [{ parts: [{ text: `Eres un asistente de la UGEL 06 que prepara documentos de planificación docente para su evaluación. Analiza el siguiente documento extraído de la carpeta pedagógica de un docente y responde SOLO el JSON pedido, sin evaluar todavía.

1. documentos_presentes: marca true/false qué documentos contiene: insumos (informe psicopedagógico/PEP o caracterización de estudiantes), planificacion_anual, unidad_didactica, sesion_aprendizaje, instrumentos_evaluacion (rúbricas, listas de cotejo, etc.).
2. identificacion: extrae ie, docente, nivel, area, grado_seccion, competencia, unidad (título de la unidad), sesion (título de la sesión). Si un dato no aparece escribe exactamente "No consignado".
3. observaciones: 1-3 frases sobre estructura, secciones presentes y calidad del texto extraído (tablas rotas, texto ilegible, etc.).
4. legible: false solo si el contenido es mayormente ilegible o vacío.

DOCUMENTO:
${markdown.slice(0, 60000)}` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          documentos_presentes: { type: 'OBJECT', properties: Object.fromEntries(DOC_KEYS.map(k => [k, { type: 'BOOLEAN' }])), required: [...DOC_KEYS] },
          identificacion: { type: 'OBJECT', properties: Object.fromEntries(ID_KEYS.map(k => [k, { type: 'STRING' }])), required: [...ID_KEYS] },
          observaciones: { type: 'STRING' },
          legible: { type: 'BOOLEAN' },
        },
        required: ['documentos_presentes', 'identificacion', 'observaciones', 'legible'],
      },
    },
  }))
  return parsed
}

// Ítems oficiales de la Sección II (dimensión y nombre fijos; el modelo solo valora)
const ITEMS: [string, string][] = [
  ['A', 'Informe psicopedagógico y PEP de estudiantes con discapacidad'], ['A', 'Caracterización de la población estudiantil'],
  ['B', 'Organización de los propósitos de aprendizaje'], ['B', 'Uso de materiales y recursos educativos'], ['B', 'Evaluación para y del aprendizaje'],
  ['C', 'Coherencia interna de la unidad'], ['C', 'Situación significativa'], ['C', 'Criterios de evaluación'], ['C', 'Secuencia de sesiones'],
  ['C', 'Evidencias de aprendizaje'], ['C', 'Instrumento de evaluación'], ['C', 'Prevención ante emergencias/desastres'],
  ['D', 'Coherencia con la unidad didáctica'], ['D', 'Enfoque del área y propósito'], ['D', 'Acompañamiento socioemocional'],
  ['D', 'Uso de materiales del MINEDU'], ['D', 'Atención a la diversidad'],
]
const DESEMPENOS = [
  'Involucra activamente a los estudiantes en el proceso de aprendizaje',
  'Promueve el razonamiento, la creatividad y/o el pensamiento crítico',
  'Evalúa el progreso de los aprendizajes para retroalimentar y adecuar la enseñanza',
  'Propicia un ambiente de respeto y proximidad',
  'Regula positivamente el comportamiento de los estudiantes',
]
const VAL = ['LOGRADO', 'PROCESO', 'INICIO', 'NO_APLICA', 'NO_EVIDENCIADO'] as const
// NO_EVIDENCIADO no puntúa: la ficha lo trata como oportunidad de mejora, no como juicio final
const PUNTAJE: Record<string, number | null> = { LOGRADO: 3, PROCESO: 2, INICIO: 1, NO_EVIDENCIADO: null, NO_APLICA: null }

const FichaSchema = z.object({
  confidence: z.number(),
  resumen: z.string(),
  fortalezas: z.array(z.string()),
  oportunidades: z.array(z.string()),
  items: z.array(z.object({
    numero: z.number(), valoracion: z.enum(VAL), evidencia: z.string(), recomendacion: z.string(),
  })).length(17),
  desempenos: z.array(z.object({
    numero: z.number(), valoracion: z.enum(VAL.filter(v => v !== 'NO_APLICA') as ['LOGRADO', 'PROCESO', 'INICIO', 'NO_EVIDENCIADO']),
    evidencia_diseno: z.string(), recomendacion: z.string(),
  })).length(5),
  recomendaciones_priorizadas: z.array(z.string()).max(5),
  compromisos_docente: z.array(z.string()),
  compromisos_especialista: z.array(z.string()),
})

export async function evaluate(markdown: string, ctx: { type: string; subject: string; grade: string; previous?: string }) {
  const extraction = await extract(markdown)
  if (!extraction.legible) {
    return {
      decision: 'MANUAL_REVIEW' as const, overall_score: 0, confidence: 0,
      summary: `El documento no pudo leerse con claridad (${extraction.observaciones}). Un especialista lo revisará.`,
      strengths: [] as string[], improvements: [] as string[], criteria: { extraccion: extraction } as object, criticalFlags: ['ILLEGIBLE_DOCUMENT'],
    }
  }

  const parsed = FichaSchema.parse(await gemini({
    systemInstruction: { parts: [{ text: fichaPrompt }] },
    contents: [{ parts: [{ text: `CONTEXTO DE LA ENTREGA: tipo ${ctx.type}, curso "${ctx.subject}", grado ${ctx.grade}.

RESULTADO DE LA EXTRACCIÓN PREVIA (documentos presentes y datos de identificación ya verificados; úsalo para decidir "No evidenciado" y "No aplica"):
${JSON.stringify(extraction)}

${ctx.previous ? `EVALUACIÓN ANTERIOR (esta entrega es una corrección: compara y reconoce explícitamente las mejoras): ${ctx.previous}\n` : ''}
DOCUMENTO DEL DOCENTE (Markdown extraído):
${markdown.slice(0, 60000)}

Aplica tu flujo de trabajo interno y responde SOLO el JSON pedido:
- items: los 17 ítems de la Sección II en orden (numero 1 a 17). valoracion: LOGRADO/PROCESO/INICIO según la rúbrica; NO_EVIDENCIADO si el documento requerido no está presente; NO_APLICA solo en el ítem 1 sin estudiantes con discapacidad. evidencia: cita textual o referencia de sección del documento ("No evidenciado en el documento" si falta). recomendacion: breve y accionable.
- desempenos: los 5 desempeños de la Sección III en orden (numero 1 a 5), valorando SOLO el diseño de la sesión. evidencia_diseno: qué prevé (o no) la sesión.
- resumen: 3-5 frases formativas dirigidas al docente (fortalezas, dificultades y siguiente paso), recordando que la valoración de la Sección III requiere observación de aula.
- fortalezas y oportunidades: listas específicas.
- recomendaciones_priorizadas: máximo 5, accionables, en orden de prioridad.
- compromisos_docente y compromisos_especialista: 2-3 compromisos sugeridos cada uno.
- confidence: 0-1, tu certeza global (baja si el texto extraído está incompleto o ambiguo).` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          confidence: { type: 'NUMBER' }, resumen: { type: 'STRING' },
          fortalezas: { type: 'ARRAY', items: { type: 'STRING' } },
          oportunidades: { type: 'ARRAY', items: { type: 'STRING' } },
          items: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
            numero: { type: 'INTEGER' }, valoracion: { type: 'STRING', enum: [...VAL] },
            evidencia: { type: 'STRING' }, recomendacion: { type: 'STRING' },
          }, required: ['numero', 'valoracion', 'evidencia', 'recomendacion'] } },
          desempenos: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
            numero: { type: 'INTEGER' }, valoracion: { type: 'STRING', enum: VAL.filter(v => v !== 'NO_APLICA') },
            evidencia_diseno: { type: 'STRING' }, recomendacion: { type: 'STRING' },
          }, required: ['numero', 'valoracion', 'evidencia_diseno', 'recomendacion'] } },
          recomendaciones_priorizadas: { type: 'ARRAY', items: { type: 'STRING' } },
          compromisos_docente: { type: 'ARRAY', items: { type: 'STRING' } },
          compromisos_especialista: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['confidence', 'resumen', 'fortalezas', 'oportunidades', 'items', 'desempenos', 'recomendaciones_priorizadas', 'compromisos_docente', 'compromisos_especialista'],
      },
    },
  }))

  // Puntajes calculados en el servidor: no se confía en la aritmética del modelo
  const items = parsed.items
    .sort((a, b) => a.numero - b.numero)
    .map((it, i) => ({ ...it, dimension: ITEMS[i][0], nombre: ITEMS[i][1], puntaje: PUNTAJE[it.valoracion] }))
  const aplicables = items.filter(it => it.puntaje !== null)
  const puntaje_total = aplicables.reduce((s, it) => s + it.puntaje!, 0)
  const puntaje_max = aplicables.length * 3
  const promedio = puntaje_max ? puntaje_total / (aplicables.length) : 0
  const nivel_global = promedio >= 2.34 ? 'LOGRADO' : promedio >= 1.67 ? 'PROCESO' : 'INICIO'
  const desempenos = parsed.desempenos
    .sort((a, b) => a.numero - b.numero)
    .map((d, i) => ({ ...d, nombre: DESEMPENOS[i] }))

  const decision = parsed.confidence < 0.75 ? 'MANUAL_REVIEW' as const
    : nivel_global === 'LOGRADO' ? 'APPROVED' as const : 'NEEDS_REVISION' as const

  const ficha = {
    version: RUBRIC_VERSION,
    extraccion: extraction,
    items, desempenos,
    puntaje_total, puntaje_max, promedio: Math.round(promedio * 100) / 100, nivel_global,
    recomendaciones_priorizadas: parsed.recomendaciones_priorizadas,
    compromisos_docente: parsed.compromisos_docente,
    compromisos_especialista: parsed.compromisos_especialista,
  }

  return {
    decision, confidence: parsed.confidence, summary: parsed.resumen,
    overall_score: puntaje_max ? Math.round((puntaje_total / puntaje_max) * 100) : 0,
    strengths: parsed.fortalezas, improvements: parsed.oportunidades,
    criteria: ficha as object,
    criticalFlags: items.filter(it => it.valoracion === 'NO_EVIDENCIADO').map(it => `NO_EVIDENCIADO_ITEM_${it.numero}`),
  }
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
