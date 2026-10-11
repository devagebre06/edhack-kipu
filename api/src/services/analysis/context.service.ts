// Contexto de contenido del documento (oculto para el docente).
// Se guarda por versión; en sesiones, el contexto de la unidad vinculada se
// entrega al evaluador para valorar la coherencia dentro de la rúbrica.
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

/** Prompt del contexto de contenido (exportado para la pantalla «Cómo se evalúa»). */
export const promptContexto = (meta: ContextMeta, documento: string) => `Eres un analista curricular de la UGEL 06. Resume DE QUÉ TRATA el siguiente documento de planificación docente (tipo ${meta.type}, curso declarado "${meta.subject}", grado ${meta.grade}). Basa el "area" en el CONTENIDO real del documento, no en los metadatos declarados. Responde SOLO el JSON pedido:
- area: el área o curso al que corresponde el contenido (p. ej. "Matemática", "Comunicación", "Ciencia y Tecnología").
- titulo: título de la unidad o sesión.
- resumen: 2-4 frases sobre el contenido y los aprendizajes que aborda.
- temas: lista de los temas o competencias principales.
- grado: grado/nivel si se infiere; "No consignado" si no.
- periodo: periodo escolar (mes o bimestre) si aparece; "No consignado" si no.

DOCUMENTO:
${documento}`

/** Genera el contexto de contenido de un documento (unidad o sesión). */
export async function summarizeContext(markdown: string, meta: ContextMeta): Promise<ArtifactContext> {
  return ContextSchema.parse(await gemini({
    contents: [{ parts: [{ text: promptContexto(meta, markdown.slice(0, 60000)) }] }],
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
