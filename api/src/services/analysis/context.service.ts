// Contexto de contenido del PDF (oculto para el docente) y coherencia sesión↔unidad.
//
//  · summarizeContext(): resume de qué trata el documento (área, temas, periodo).
//    Se calcula tanto para unidades como para sesiones y se guarda por versión.
//  · checkSessionCoherence(): compara el contexto de una sesión contra el de su
//    unidad para decidir si la sesión pertenece realmente a esa unidad (p. ej. una
//    sesión de comunicación NO debe registrarse en una unidad de matemática).
import { z } from 'zod'
import { gemini } from './gemini.client.ts'

export const ContextSchema = z.object({
  area: z.string(),          // curso/área inferida del CONTENIDO (no de los metadatos)
  titulo: z.string(),        // título de la unidad o sesión
  resumen: z.string(),       // 2-4 frases de qué trata
  temas: z.array(z.string()),// temas/competencias principales abordados
  grado: z.string(),         // grado/nivel si se infiere ("No consignado" si no)
  periodo: z.string(),       // periodo escolar (mes/bimestre) si aplica ("No consignado" si no)
})
export type ArtifactContext = z.infer<typeof ContextSchema>

export interface ContextMeta { type: string; subject: string; grade: string }

/** Genera el contexto de contenido de un documento (unidad o sesión). */
export async function summarizeContext(markdown: string, meta: ContextMeta): Promise<ArtifactContext> {
  return ContextSchema.parse(await gemini({
    contents: [{ parts: [{ text: `Eres un analista curricular de la UGEL 06. Resume DE QUÉ TRATA el siguiente documento de planificación docente (tipo ${meta.type}, curso declarado "${meta.subject}", grado ${meta.grade}). Basa el "area" en el CONTENIDO real del documento, no en los metadatos declarados. Responde SOLO el JSON pedido:
- area: el área o curso al que corresponde el contenido (p. ej. "Matemática", "Comunicación", "Ciencia y Tecnología").
- titulo: título de la unidad o sesión.
- resumen: 2-4 frases sobre el contenido y los aprendizajes que aborda.
- temas: lista de los temas o competencias principales.
- grado: grado/nivel si se infiere; "No consignado" si no.
- periodo: periodo escolar (mes o bimestre) si aparece; "No consignado" si no.

DOCUMENTO:
${markdown.slice(0, 60000)}` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          area: { type: 'STRING' }, titulo: { type: 'STRING' }, resumen: { type: 'STRING' },
          temas: { type: 'ARRAY', items: { type: 'STRING' } },
          grado: { type: 'STRING' }, periodo: { type: 'STRING' },
        },
        required: ['area', 'titulo', 'resumen', 'temas', 'grado', 'periodo'],
      },
    },
  }))
}

const CoherenceSchema = z.object({
  coherent: z.boolean(),
  confidence: z.number(),
  reason: z.string(), // explicación breve, apta para mostrar al docente
})
export type Coherence = z.infer<typeof CoherenceSchema>

/** Decide si una sesión pertenece a la unidad, comparando ambos contextos de contenido. */
export async function checkSessionCoherence(session: ArtifactContext, unit: ArtifactContext): Promise<Coherence> {
  return CoherenceSchema.parse(await gemini({
    contents: [{ parts: [{ text: `Eres un especialista de la UGEL 06 que verifica que una SESIÓN de aprendizaje corresponda a su UNIDAD didáctica. Una sesión NO es coherente si es de otra área/curso (p. ej. una sesión de Comunicación dentro de una unidad de Matemática) o si aborda temas ajenos a los de la unidad. Sé estricto con el área; sé flexible con los temas (una sesión cubre solo una parte de la unidad).

CONTEXTO DE LA UNIDAD:
${JSON.stringify(unit)}

CONTEXTO DE LA SESIÓN:
${JSON.stringify(session)}

Responde SOLO el JSON pedido:
- coherent: true si la sesión pertenece razonablemente a la unidad; false si es de otra área o claramente ajena.
- confidence: 0-1, tu certeza.
- reason: 1-2 frases explicando la decisión, en tono formativo para el docente (sin mencionar puntajes).` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          coherent: { type: 'BOOLEAN' }, confidence: { type: 'NUMBER' }, reason: { type: 'STRING' },
        },
        required: ['coherent', 'confidence', 'reason'],
      },
    },
  }))
}
