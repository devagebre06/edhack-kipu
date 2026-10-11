// Evaluación documental de unidades y sesiones. Gemini valora; el servidor calcula.
import { readFile } from 'node:fs/promises'
import { RUBRIC_VERSION } from '../../config/env.ts'
import { gemini } from './gemini.client.ts'
import { extract } from './extraction.service.ts'
import { CRITERIOS, EvaluacionSchema, PUNTAJE_MAX, calcularNota } from './rubric.ts'

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

export const promptEvaluacion = (ctx: EvaluationContext, extraccion: string, documento: string) =>
  `CONTEXTO DE LA ENTREGA: tipo ${ctx.type}, curso "${ctx.subject}", grado ${ctx.grade}.

EXTRACCIÓN PREVIA (datos detectados; contrástalos con el documento, no los tomes como prueba de calidad):
${extraccion}

${ctx.unitContext ? `CONTEXTO DE LA UNIDAD VINCULADA (solo para valorar la coherencia de esta sesión dentro del criterio 3; no es un veto independiente):\n${ctx.unitContext}\n` : ''}
${ctx.previous ? `EVALUACIÓN ANTERIOR (esta entrega es una corrección; reconoce las mejoras visibles sin repetir la nota anterior):\n${ctx.previous}\n` : ''}
DOCUMENTO DEL DOCENTE (texto extraído):
${documento}

Responde SOLO el JSON pedido:
- items: exactamente los ocho criterios, números 1 a 8, una vez cada uno. Para cada uno devuelve puntaje entero 0, 1, 2 o 3; evidencia localizable del documento o «No evidenciado en el documento»; recomendacion breve y concreta.
- resumen: 2-4 frases formativas sobre la calidad de esta planificación, nunca sobre la ejecución real en aula.
- fortalezas y oportunidades: listas específicas sustentadas en el archivo.
- recomendaciones_priorizadas: hasta cinco mejoras accionables, de mayor a menor impacto.
- confidence: número entre 0 y 1 que expresa la certeza del análisis, sin cambiar la nota.`

export async function evaluate(markdown: string, ctx: EvaluationContext) {
  const extraction = await extract(markdown)
  if (!extraction.legible) {
    return {
      decision: 'MANUAL_REVIEW' as const, overall_score: 0, confidence: 0,
      summary: `El documento no pudo leerse con claridad (${extraction.observaciones}). Un especialista lo revisará.`,
      strengths: [] as string[], improvements: [] as string[], criteria: { extraccion: extraction } as object,
      criticalFlags: ['ILLEGIBLE_DOCUMENT'],
    }
  }

  const parsed = EvaluacionSchema.parse(await gemini({
    systemInstruction: { parts: [{ text: rubricaPrompt }] },
    contents: [{ parts: [{ text: promptEvaluacion(ctx, JSON.stringify(extraction), markdown.slice(0, 60000)) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          confidence: { type: 'NUMBER' }, resumen: { type: 'STRING' },
          fortalezas: { type: 'ARRAY', items: { type: 'STRING' } },
          oportunidades: { type: 'ARRAY', items: { type: 'STRING' } },
          items: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
            numero: { type: 'INTEGER' }, puntaje: { type: 'INTEGER' },
            evidencia: { type: 'STRING' }, recomendacion: { type: 'STRING' },
          }, required: ['numero', 'puntaje', 'evidencia', 'recomendacion'] } },
          recomendaciones_priorizadas: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['confidence', 'resumen', 'fortalezas', 'oportunidades', 'items', 'recomendaciones_priorizadas'],
      },
    },
  }))

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
