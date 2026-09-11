// Paso 1 del análisis: extracción de metadatos y presencia de documentos (sin evaluar todavía).
import { gemini } from './gemini.client.ts'
import { DOC_KEYS, ID_KEYS, ExtractionSchema, type Extraction } from './rubric.ts'

/** Prompt del paso 1. Exportado para que la pantalla «Cómo se evalúa» muestre
 *  exactamente el que se usa, sin mantener una copia aparte. */
export const promptExtraccion = (documento: string) => `Eres un asistente de la UGEL 06 que prepara documentos de planificación docente para su evaluación. Analiza el siguiente documento extraído de la carpeta pedagógica de un docente y responde SOLO el JSON pedido, sin evaluar todavía.

1. documentos_presentes: marca true/false qué documentos contiene: insumos (informe psicopedagógico/PEP o caracterización de estudiantes), planificacion_anual, unidad_didactica, sesion_aprendizaje, instrumentos_evaluacion (rúbricas, listas de cotejo, etc.).
2. identificacion: extrae ie, docente, nivel, area, grado_seccion, competencia, unidad (título de la unidad), sesion (título de la sesión). Si un dato no aparece escribe exactamente "No consignado".
3. observaciones: 1-3 frases sobre estructura, secciones presentes y calidad del texto extraído (tablas rotas, texto ilegible, etc.).
4. legible: false solo si el contenido es mayormente ilegible o vacío.

DOCUMENTO:
${documento}`

export async function extract(markdown: string): Promise<Extraction> {
  return ExtractionSchema.parse(await gemini({
    contents: [{ parts: [{ text: promptExtraccion(markdown.slice(0, 60000)) }] }],
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
}
