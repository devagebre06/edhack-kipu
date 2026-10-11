// Configuración pública del método que realmente ejecuta la API.
import { GEMINI_MODEL, PROMPT_VERSION, RUBRIC_VERSION, VALID_SCORE_MIN, MAX_MB, ALLOWED } from '../config/env.ts'
import { CRITERIOS, PUNTAJE_MAX, PUNTAJE_MINIMO, DOC_KEYS, ID_KEYS } from './analysis/rubric.ts'
import { promptExtraccion } from './analysis/extraction.service.ts'
import { promptContexto } from './analysis/context.service.ts'
import { systemPromptRubrica, promptEvaluacion } from './analysis/evaluation.service.ts'

const DOC = '«aquí va el documento del docente, convertido a texto»'
const EJEMPLO = { type: 'sesión de aprendizaje', subject: 'Matemática', grade: '4.º A', unitContext: '«contexto de la unidad vinculada»' }

export function getConfiguracionEvaluacion() {
  return {
    motor: {
      modelo: GEMINI_MODEL,
      modelo_docs: `https://ai.google.dev/gemini-api/docs/models/${GEMINI_MODEL}`,
      prompt_version: PROMPT_VERSION,
      rubrica_version: RUBRIC_VERSION,
      formatos: Object.keys(ALLOWED),
      max_mb: MAX_MB,
      puntaje_minimo_valida: VALID_SCORE_MIN,
      puntaje_maximo_rubrica: PUNTAJE_MAX,
      puntaje_minimo_rubrica: PUNTAJE_MINIMO,
      limite_texto: 60000,
    },
    pasos: [
      {
        clave: 'conversion', titulo: 'Se lee el documento', etiqueta: 'Lectura', quien: 'servidor',
        descripcion: 'El archivo se convierte a texto. Si está vacío o no puede leerse, queda sin calificar y pasa a revisión.',
        entrada: 'El archivo que sube el docente', salida: 'Documento convertido a texto', aplica: ['UNIDAD', 'SESION'], prompts: [],
      },
      {
        clave: 'extraccion', titulo: 'Se identifica el contenido', etiqueta: 'Extracción', quien: 'IA',
        descripcion: 'Se identifican los datos y componentes presentes antes de valorarlos. No se inventa información faltante.',
        entrada: 'Documento en texto', salida: 'Datos identificados y legibilidad', aplica: ['UNIDAD', 'SESION'],
        devuelve: { documentos: [...DOC_KEYS], identificacion: [...ID_KEYS] }, prompts: ['extraccion'],
      },
      {
        clave: 'evaluacion', titulo: 'Se aplican los ocho criterios', etiqueta: 'Valoración', quien: 'IA',
        descripcion: 'El modelo valora cada criterio de 0 a 3 y señala la evidencia. Si es una sesión, su relación con la unidad se considera dentro del criterio de coherencia.',
        entrada: 'Documento, contexto y rúbrica curricular', salida: 'Ocho valoraciones con evidencia y mejoras',
        aplica: ['UNIDAD', 'SESION'], prompts: ['rubrica', 'evaluacion'],
      },
      {
        clave: 'puntaje', titulo: 'Se calcula la nota final', etiqueta: 'Puntaje', quien: 'servidor',
        descripcion: 'Se suman los ocho puntajes. Con 18 de 24 puntos se obtiene 75/100 y la entrega es satisfactoria, sin condiciones adicionales.',
        entrada: 'Ocho puntajes de 0 a 3', salida: 'Nota sobre 100 y estado de la entrega',
        aplica: ['UNIDAD', 'SESION'], prompts: [],
      },
      {
        clave: 'contexto', titulo: 'Se guarda el contexto', etiqueta: 'Contexto', quien: 'IA',
        descripcion: 'Se resume el contenido de la unidad o sesión para seguimiento. El resumen no impone un segundo requisito para aprobar.',
        entrada: 'Documento en texto', salida: 'Área, título, temas, grado y periodo',
        aplica: ['UNIDAD', 'SESION'], prompts: ['contexto'],
      },
    ],
    decisiones: [
      { estado: 'APPROVED', label: 'Aprobada', regla: '18 puntos o más de 24: equivale a 75/100 o más.' },
      { estado: 'NEEDS_REVISION', label: 'Necesita corrección', regla: 'Menos de 18 puntos de 24. Se entrega retroalimentación.' },
      { estado: 'MANUAL_REVIEW', label: 'Revisión manual', regla: 'El documento no se pudo leer con suficiente claridad.' },
      { estado: 'PROCESSING_ERROR', label: 'Error de procesamiento', regla: 'No se pudo completar la conversión o evaluación.' },
    ],
    rubrica: {
      nombre: 'Rúbrica documental Kipu para 4.º de primaria',
      nota: 'Es una escala propia de Kipu, sustentada en tres documentos. Valora la planificación escrita, no la ejecución en aula. No exige tratar emergencias o desastres.',
      fuentes: [
        { nombre: 'Currículo Nacional de la Educación Básica', aporte: 'Competencias, capacidades, estándares del IV ciclo y evaluación formativa.' },
        { nombre: 'Programa Curricular de Educación Primaria', aporte: 'Enfoques de Comunicación y Matemática y desempeños de 4.º grado.' },
        { nombre: 'Oficio Múltiple N.º 00038-2026 de la UGEL 06', aporte: 'Criterios generales de planificación, evidencias, recursos y atención a la diversidad.' },
      ],
      items: CRITERIOS.map(c => ({ ...c })),
      valoraciones: [
        { puntaje: 0, label: 'Sin evidencia', nota: 'Falta información para verificar un elemento central.' },
        { puntaje: 1, label: 'Inicio', nota: 'Hay un intento débil o una dificultad importante.' },
        { puntaje: 2, label: 'En proceso', nota: 'El componente es parcial o necesita mayor coherencia.' },
        { puntaje: 3, label: 'Logrado', nota: 'El componente es explícito, pertinente y utilizable.' },
      ],
    },
    prompts: [
      { clave: 'rubrica', titulo: 'Rúbrica curricular', cuando: 'Instrucción de sistema para valorar la planificación.', texto: systemPromptRubrica() },
      { clave: 'evaluacion', titulo: 'Mensaje de evaluación', cuando: 'Añade el contexto y el documento del docente.', texto: promptEvaluacion(EJEMPLO, '«datos extraídos»', DOC) },
      { clave: 'extraccion', titulo: 'Extracción previa', cuando: 'Primer paso, antes de calificar.', texto: promptExtraccion(DOC) },
      { clave: 'contexto', titulo: 'Contexto de contenido', cuando: 'Resume el tema de la entrega.', texto: promptContexto(EJEMPLO, DOC) },
    ],
  }
}
