// Evaluación documental de unidades y sesiones. Gemini valora; el servidor calcula.
import { readFile } from 'node:fs/promises'
import { RUBRIC_VERSION } from '../../config/env.ts'
import { geminiWithModel } from './gemini.client.ts'
import { ContextSchema } from './context.service.ts'
import { CRITERIOS, DOC_KEYS, ID_KEYS, ExtractionSchema, EvaluacionSchema, PUNTAJE_MAX, calcularNota } from './rubric.ts'

const rubricaPrompt = await readFile(
  new URL('../../../config/prompts/planificacion-4primaria.v1.md', import.meta.url),
  'utf8',
)

export interface EvaluationContext {
  type: string
  subject: string
  grade: string
  previous?: string
  unitContext?: string
}

/** Instrucción exacta que recibe el modelo y se expone en «Cómo se evalúa». */
export const systemPromptRubrica = () => rubricaPrompt

export const promptEvaluacion = (ctx: EvaluationContext, documento: string) =>
  `CONTEXTO DE LA ENTREGA: tipo ${ctx.type}, curso "${ctx.subject}", grado ${ctx.grade}.

${ctx.unitContext ? `CONTEXTO DE LA UNIDAD VINCULADA (solo para valorar la coherencia de esta sesión dentro del criterio 3; no es un veto independiente):\n${ctx.unitContext}\n` : ''}
${ctx.previous ? `EVALUACIÓN ANTERIOR (esta entrega es una corrección; reconoce las mejoras visibles sin repetir la nota anterior):\n${ctx.previous}\n` : ''}
DOCUMENTO DEL DOCENTE (texto extraído):
${documento}

Analiza el documento en una sola respuesta. Primero identifica su contenido y legibilidad; después valora la planificación con la rúbrica. No inventes datos ausentes ni confundas la presencia de una sección con su calidad.
Responde SOLO el JSON pedido:
- extraccion.documentos_presentes: true/false para insumos, planificacion_anual, unidad_didactica, sesion_aprendizaje e instrumentos_evaluacion.
- extraccion.identificacion: ie, docente, nivel, area, grado_seccion, competencia, unidad y sesion. Escribe «No consignado» si falta un dato.
- extraccion.observaciones: 1-3 frases sobre estructura y calidad del texto extraído; extraccion.legible: false solo si está mayormente ilegible o vacío.
- contexto: area inferida del CONTENIDO (no de los metadatos), titulo, resumen de 2-4 frases sobre el tema y los aprendizajes, temas principales, grado y periodo. Usa «No consignado» para grado o periodo ausentes.
- items: exactamente los ocho criterios, números 1 a 8, una vez cada uno. Para cada uno devuelve puntaje entero 0, 1, 2 o 3; evidencia localizable del documento o «No evidenciado en el documento»; recomendacion breve y concreta.
- resumen: 2-4 frases formativas sobre la calidad de esta planificación, nunca sobre la ejecución real en aula.
- fortalezas y oportunidades: listas específicas sustentadas en el archivo.
- recomendaciones_priorizadas: hasta cinco mejoras accionables, de mayor a menor impacto.
- confidence: número entre 0 y 1 que expresa la certeza del análisis, sin cambiar la nota.
Si extraccion.legible es false, deja items y las listas vacías; el servidor enviará la entrega a revisión sin asignar puntajes.`

export async function evaluate(markdown: string, ctx: EvaluationContext) {
  const result = await geminiWithModel({
    systemInstruction: { parts: [{ text: rubricaPrompt }] },
    contents: [{ parts: [{ text: promptEvaluacion(ctx, markdown.slice(0, 60000)) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          extraccion: { type: 'OBJECT', properties: {
            documentos_presentes: { type: 'OBJECT', properties: Object.fromEntries(DOC_KEYS.map(k => [k, { type: 'BOOLEAN' }])), required: [...DOC_KEYS] },
            identificacion: { type: 'OBJECT', properties: Object.fromEntries(ID_KEYS.map(k => [k, { type: 'STRING' }])), required: [...ID_KEYS] },
            observaciones: { type: 'STRING' }, legible: { type: 'BOOLEAN' },
          }, required: ['documentos_presentes', 'identificacion', 'observaciones', 'legible'] },
          contexto: { type: 'OBJECT', properties: {
            area: { type: 'STRING' }, titulo: { type: 'STRING' }, resumen: { type: 'STRING' },
            temas: { type: 'ARRAY', items: { type: 'STRING' } },
            grado: { type: 'STRING' }, periodo: { type: 'STRING' },
          }, required: ['area', 'titulo', 'resumen', 'temas', 'grado', 'periodo'] },
          confidence: { type: 'NUMBER' }, resumen: { type: 'STRING' },
          fortalezas: { type: 'ARRAY', items: { type: 'STRING' } },
          oportunidades: { type: 'ARRAY', items: { type: 'STRING' } },
          items: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
            numero: { type: 'INTEGER' }, puntaje: { type: 'INTEGER' },
            evidencia: { type: 'STRING' }, recomendacion: { type: 'STRING' },
          }, required: ['numero', 'puntaje', 'evidencia', 'recomendacion'] } },
          recomendaciones_priorizadas: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['extraccion', 'contexto', 'confidence', 'resumen', 'fortalezas', 'oportunidades', 'items', 'recomendaciones_priorizadas'],
      },
    },
  })
  const extraction = ExtractionSchema.parse(result.data.extraccion)
  if (!extraction.legible) {
    return {
      decision: 'MANUAL_REVIEW' as const, overall_score: 0, confidence: 0,
      summary: `El documento no pudo leerse con claridad (${extraction.observaciones}). Un especialista lo revisará.`,
      strengths: [] as string[], improvements: [] as string[], criteria: { extraccion: extraction } as object,
      model: result.model,
      criticalFlags: ['ILLEGIBLE_DOCUMENT'],
    }
  }

  const parsed = EvaluacionSchema.parse(result.data)
  const context = ContextSchema.safeParse(result.data.contexto)
  const savedContext = context.success ? context.data : {
    area: extraction.identificacion.area || ctx.subject,
    titulo: extraction.identificacion[ctx.type.startsWith('unidad') ? 'unidad' : 'sesion'] || 'No consignado',
    resumen: parsed.resumen,
    temas: extraction.identificacion.competencia && extraction.identificacion.competencia !== 'No consignado'
      ? [extraction.identificacion.competencia] : [],
    grado: extraction.identificacion.grado_seccion || ctx.grade,
    periodo: 'No consignado',
  }

  const items = parsed.items
    .sort((a, b) => a.numero - b.numero)
    .map(item => ({
      ...item,
      nombre: CRITERIOS[item.numero - 1].nombre,
      fuente: CRITERIOS[item.numero - 1].fuente,
      nivel: ['Sin evidencia', 'Inicio', 'En proceso', 'Logrado'][item.puntaje],
    }))
  const { puntos: puntaje_total, nota: overall_score, satisfactoria } = calcularNota(items)

  return {
    decision: satisfactoria ? 'APPROVED' as const : 'NEEDS_REVISION' as const,
    overall_score, confidence: parsed.confidence, summary: parsed.resumen,
    model: result.model,
    context: savedContext,
    strengths: parsed.fortalezas, improvements: parsed.oportunidades,
    criteria: {
      version: RUBRIC_VERSION,
      tipo: ctx.type,
      extraccion: extraction,
      items,
      puntaje_total,
      puntaje_max: PUNTAJE_MAX,
      recomendaciones_priorizadas: parsed.recomendaciones_priorizadas,
    },
    criticalFlags: [] as string[],
  }
}

export type Evaluation = Awaited<ReturnType<typeof evaluate>>
