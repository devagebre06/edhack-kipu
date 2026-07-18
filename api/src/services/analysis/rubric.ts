// Definición fija de la rúbrica "Ficha de monitoreo UGEL 06" y sus esquemas de validación.
// La dimensión y el nombre de cada ítem son fijos: el modelo únicamente valora.
import { z } from 'zod'

// Claves usadas en el paso de extracción previa.
export const DOC_KEYS = ['insumos', 'planificacion_anual', 'unidad_didactica', 'sesion_aprendizaje', 'instrumentos_evaluacion'] as const
export const ID_KEYS = ['ie', 'docente', 'nivel', 'area', 'grado_seccion', 'competencia', 'unidad', 'sesion'] as const

export const ExtractionSchema = z.object({
  documentos_presentes: z.record(z.string(), z.boolean()),
  identificacion: z.record(z.string(), z.string()),
  observaciones: z.string(),
  legible: z.boolean(),
})
export type Extraction = z.infer<typeof ExtractionSchema>

// Ítems oficiales de la Sección II (dimensión y nombre fijos).
export const ITEMS: [string, string][] = [
  ['A', 'Informe psicopedagógico y PEP de estudiantes con discapacidad'], ['A', 'Caracterización de la población estudiantil'],
  ['B', 'Organización de los propósitos de aprendizaje'], ['B', 'Uso de materiales y recursos educativos'], ['B', 'Evaluación para y del aprendizaje'],
  ['C', 'Coherencia interna de la unidad'], ['C', 'Situación significativa'], ['C', 'Criterios de evaluación'], ['C', 'Secuencia de sesiones'],
  ['C', 'Evidencias de aprendizaje'], ['C', 'Instrumento de evaluación'], ['C', 'Prevención ante emergencias/desastres'],
  ['D', 'Coherencia con la unidad didáctica'], ['D', 'Enfoque del área y propósito'], ['D', 'Acompañamiento socioemocional'],
  ['D', 'Uso de materiales del MINEDU'], ['D', 'Atención a la diversidad'],
]

// Desempeños oficiales de la Sección III.
export const DESEMPENOS = [
  'Involucra activamente a los estudiantes en el proceso de aprendizaje',
  'Promueve el razonamiento, la creatividad y/o el pensamiento crítico',
  'Evalúa el progreso de los aprendizajes para retroalimentar y adecuar la enseñanza',
  'Propicia un ambiente de respeto y proximidad',
  'Regula positivamente el comportamiento de los estudiantes',
]

export const VAL = ['LOGRADO', 'PROCESO', 'INICIO', 'NO_APLICA', 'NO_EVIDENCIADO'] as const
// NO_EVIDENCIADO no puntúa: la ficha lo trata como oportunidad de mejora, no como juicio final.
export const PUNTAJE: Record<string, number | null> = { LOGRADO: 3, PROCESO: 2, INICIO: 1, NO_EVIDENCIADO: null, NO_APLICA: null }

// Ítems de la Sección II actualmente EXCLUIDOS de la evaluación: se fuerzan a NO_APLICA
// (no puntúan y no cuentan en el promedio). Para reactivar uno, quita su número de este set
// y descomenta su rúbrica en config/prompts/ficha-monitoreo-ugel06.v1.md.
export const EXCLUDED_ITEMS = new Set<number>([1, 2, 3, 4, 5, 11])

export const FichaSchema = z.object({
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
export type Ficha = z.infer<typeof FichaSchema>
