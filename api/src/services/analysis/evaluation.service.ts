// Paso 2 del análisis del PDF: evaluación del documento contra la ficha de monitoreo UGEL 06.
// Orquesta la extracción previa, la valoración con Gemini y el cálculo de puntajes en el servidor.
import { readFile } from 'node:fs/promises'
import { RUBRIC_VERSION } from '../../config/env.ts'
import { gemini } from './gemini.client.ts'
import { extract } from './extraction.service.ts'
import { ITEMS, DESEMPENOS, VAL, PUNTAJE, FichaSchema, EXCLUDED_ITEMS } from './rubric.ts'

// System prompt con la rúbrica completa (cargado una sola vez al iniciar).
const fichaPrompt = await readFile(
  new URL('../../../config/prompts/ficha-monitoreo-ugel06.v1.md', import.meta.url),
  'utf8',
)

export interface EvaluationContext {
  type: string
  subject: string
  grade: string
  previous?: string
}

/** El system prompt con la rúbrica completa (se expone en «Cómo se evalúa»). */
export const systemPromptFicha = () => fichaPrompt

/** Mensaje de usuario del paso 2: contexto + extracción + documento + instrucciones. */
export const promptEvaluacion = (ctx: EvaluationContext, extraccion: string, documento: string) =>
  `CONTEXTO DE LA ENTREGA: tipo ${ctx.type}, curso "${ctx.subject}", grado ${ctx.grade}.

RESULTADO DE LA EXTRACCIÓN PREVIA (documentos presentes y datos de identificación ya verificados; úsalo para decidir "No evidenciado" y "No aplica"):
${extraccion}

${ctx.previous ? `EVALUACIÓN ANTERIOR (esta entrega es una corrección: compara y reconoce explícitamente las mejoras): ${ctx.previous}\n` : ''}
DOCUMENTO DEL DOCENTE (Markdown extraído):
${documento}

Aplica tu flujo de trabajo interno y responde SOLO el JSON pedido:
- items: los 17 ítems de la Sección II en orden (numero 1 a 17). IMPORTANTE: los ítems 1, 2, 3, 4, 5 y 11 están EXCLUIDOS de la evaluación actual; devuélvelos igual (para conservar los 17) con valoracion NO_APLICA, evidencia "Ítem excluido de la evaluación" y recomendacion "". Para los demás ítems: valoracion LOGRADO/PROCESO/INICIO según la rúbrica; NO_EVIDENCIADO si el documento requerido no está presente. evidencia: cita textual o referencia de sección del documento ("No evidenciado en el documento" si falta). recomendacion: breve y accionable.
- desempenos: los 5 desempeños de la Sección III en orden (numero 1 a 5), valorando SOLO el diseño de la sesión. evidencia_diseno: qué prevé (o no) la sesión.
- resumen: 3-5 frases formativas dirigidas al docente (fortalezas, dificultades y siguiente paso), recordando que la valoración de la Sección III requiere observación de aula.
- fortalezas y oportunidades: listas específicas.
- recomendaciones_priorizadas: máximo 5, accionables, en orden de prioridad.
- compromisos_docente y compromisos_especialista: 2-3 compromisos sugeridos cada uno.
- confidence: 0-1, tu certeza global (baja si el texto extraído está incompleto o ambiguo).`

export async function evaluate(markdown: string, ctx: EvaluationContext) {
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

  // Puntajes calculados en el servidor: no se confía en la aritmética del modelo.
  // Los ítems excluidos se fuerzan a NO_APLICA aquí (defensivo), sin importar lo que devuelva el modelo:
  // así nunca puntúan ni generan flags, aunque el modelo ignore la instrucción del prompt.
  const items = parsed.items
    .sort((a, b) => a.numero - b.numero)
    .map((it, i) => {
      const excluido = EXCLUDED_ITEMS.has(it.numero)
      const valoracion = excluido ? 'NO_APLICA' as const : it.valoracion
      return {
        ...it, valoracion,
        evidencia: excluido ? 'Ítem excluido de la evaluación' : it.evidencia,
        recomendacion: excluido ? '' : it.recomendacion,
        dimension: ITEMS[i][0], nombre: ITEMS[i][1], puntaje: PUNTAJE[valoracion], excluido,
      }
    })
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

export type Evaluation = Awaited<ReturnType<typeof evaluate>>
