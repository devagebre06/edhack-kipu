// Rúbrica documental propia de Kipu para unidades y sesiones de 4.º de primaria.
// Los ocho criterios son generales; el prompt precisa cómo leer cada tipo de entrega.
import { z } from 'zod'

export const DOC_KEYS = ['insumos', 'planificacion_anual', 'unidad_didactica', 'sesion_aprendizaje', 'instrumentos_evaluacion'] as const
export const ID_KEYS = ['ie', 'docente', 'nivel', 'area', 'grado_seccion', 'competencia', 'unidad', 'sesion'] as const

export const ExtractionSchema = z.object({
  documentos_presentes: z.record(z.string(), z.boolean()),
  identificacion: z.record(z.string(), z.string()),
  observaciones: z.string(),
  legible: z.boolean(),
})
export type Extraction = z.infer<typeof ExtractionSchema>

export const CRITERIOS = [
  { numero: 1, nombre: 'Alineación curricular', fuente: 'CNEB: competencias, capacidades y estándar del IV ciclo; Programa Curricular: desempeños de 4.º.' },
  { numero: 2, nombre: 'Pertinencia para 4.º grado y enfoque del área', fuente: 'CNEB: estándar del IV ciclo; Programa Curricular: enfoque y desempeños de Comunicación o Matemática.' },
  { numero: 3, nombre: 'Coherencia de la planificación', fuente: 'CNEB: planificación desde situaciones significativas; Programa Curricular: propósito, contexto y necesidades; Oficio UGEL 06: ítems generales 6, 7 y 13.' },
  { numero: 4, nombre: 'Secuencia y demanda cognitiva', fuente: 'CNEB: aprender haciendo y pensamiento complejo; Programa Curricular: enfoque del área; Oficio UGEL 06: secuencia de sesiones y enfoque (ítems 9 y 14).' },
  { numero: 5, nombre: 'Evidencia y criterios de evaluación', fuente: 'CNEB y Programa Curricular: evidencia vinculada a competencia, estándar y desempeño; Oficio UGEL 06: ítems 8 y 10.' },
  { numero: 6, nombre: 'Evaluación y retroalimentación', fuente: 'CNEB y Programa Curricular: evaluación formativa e instrumentos; Oficio UGEL 06: instrumento pertinente (ítem 11), sin exigir uno específico.' },
  { numero: 7, nombre: 'Atención a la diversidad', fuente: 'CNEB y Programa Curricular: contextualización y apoyos; Oficio UGEL 06: atención diferenciada (ítem 17).' },
  { numero: 8, nombre: 'Claridad y viabilidad', fuente: 'CNEB y Programa Curricular: recursos pertinentes; Oficio UGEL 06: coherencia y materiales (ítems generales 6 y 16).' },
] as const

export const PUNTAJE_MAX = CRITERIOS.length * 3
export const PUNTAJE_MINIMO = 18 // 18/24 = 75/100, sin condiciones adicionales.

export function calcularNota(items: readonly { puntaje: number }[]) {
  if (items.length !== CRITERIOS.length || items.some(item => !Number.isInteger(item.puntaje) || item.puntaje < 0 || item.puntaje > 3)) {
    throw new Error('La rúbrica requiere ocho puntajes enteros entre 0 y 3.')
  }
  const puntos = items.reduce((suma, item) => suma + item.puntaje, 0)
  return { puntos, nota: Math.round(100 * puntos / PUNTAJE_MAX), satisfactoria: puntos >= PUNTAJE_MINIMO }
}

export const EvaluacionSchema = z.object({
  confidence: z.number().min(0).max(1),
  resumen: z.string(),
  fortalezas: z.array(z.string()),
  oportunidades: z.array(z.string()),
  items: z.array(z.object({
    numero: z.number().int().min(1).max(8),
    puntaje: z.number().int().min(0).max(3),
    evidencia: z.string(),
    recomendacion: z.string(),
  })).length(CRITERIOS.length).refine(
    items => new Set(items.map(item => item.numero)).size === CRITERIOS.length,
    'La respuesta debe contener los ocho criterios, una vez cada uno.',
  ),
  recomendaciones_priorizadas: z.array(z.string()).max(5),
})
