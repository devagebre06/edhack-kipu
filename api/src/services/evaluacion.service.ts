// «Cómo se evalúa»: describe el motor de evaluación con sus propias piezas.
//
// Todo lo que devuelve sale del código que realmente se ejecuta —la rúbrica de
// rubric.ts, los prompts de los servicios de análisis, los umbrales de env.ts—,
// nunca de una copia. Si mañana cambia un umbral o un ítem, esta pantalla lo
// refleja sin tocarla.
import { GEMINI_MODEL, PROMPT_VERSION, RUBRIC_VERSION, VALID_SCORE_MIN, MAX_MB, ALLOWED } from '../config/env.ts'
import { ITEMS, DESEMPENOS, PUNTAJE, EXCLUDED_ITEMS, DOC_KEYS, ID_KEYS } from './analysis/rubric.ts'
import { promptExtraccion } from './analysis/extraction.service.ts'
import { promptContexto, promptCoherencia } from './analysis/context.service.ts'
import { systemPromptFicha, promptEvaluacion } from './analysis/evaluation.service.ts'

// Marcadores legibles en lugar del documento real, para poder enseñar el prompt.
const DOC = '«aquí va el documento del docente, convertido a texto»'
const EJEMPLO = { type: 'sesión de aprendizaje', subject: 'Matemática', grade: '1° A' }

const DIMENSIONES: Record<string, string> = {
  A: 'Insumos para la planificación curricular',
  B: 'Planificación anual',
  C: 'Unidad didáctica',
  D: 'Sesión de aprendizaje',
}

// Documento oficial del que sale la rúbrica. Vive en el bucket público
// `normativa` (ver api/scripts/subir-normativa.mjs); es de difusión oficial y
// no contiene datos personales.
const FUENTE = {
  titulo: 'Oficio Múltiple N.º 00038-2026-MINEDU/VMGI-DRELM-UGEL06/DIR-AGEBRE',
  asunto: 'Cronograma, protocolo y fichas para las acciones de monitoreo del AGEBRE',
  emisor: 'UGEL 06 · Área de Gestión de la Educación Básica Regular y Especial',
  fecha: '2026-03-04',
  expediente: 'EGP-EBR2026-INT-0251404',
  secciones: [
    'Ficha de monitoreo a la gestión pedagógica del directivo (Secciones II a V)',
    'Rúbrica de valoración para la planificación del docente (17 ítems)',
    'Rúbricas de observación del desempeño docente (5 desempeños)',
    'Protocolo de visita y ficha del semáforo pedagógico',
  ],
  url: `${(process.env.SUPABASE_URL ?? '').replace(/\/$/, '')}/storage/v1/object/public/normativa/ugel06/oficio-multiple-00038-2026-agebre.pdf`,
}

const VALORACIONES = [
  { codigo: 'LOGRADO', label: 'Logrado', puntaje: PUNTAJE.LOGRADO, nota: 'El elemento está presente y bien resuelto.' },
  { codigo: 'PROCESO', label: 'En proceso', puntaje: PUNTAJE.PROCESO, nota: 'Está, pero incompleto o poco explícito.' },
  { codigo: 'INICIO', label: 'Inicio', puntaje: PUNTAJE.INICIO, nota: 'Apenas se esboza.' },
  { codigo: 'NO_EVIDENCIADO', label: 'No evidenciado', puntaje: PUNTAJE.NO_EVIDENCIADO, nota: 'No aparece en el documento: es una oportunidad de mejora, no una sanción. No puntúa.' },
  { codigo: 'NO_APLICA', label: 'No aplica', puntaje: PUNTAJE.NO_APLICA, nota: 'El ítem no corresponde a este caso. No puntúa ni baja el promedio.' },
]

export function getConfiguracionEvaluacion() {
  return {
    motor: {
      modelo: GEMINI_MODEL,
      // Ficha técnica pública del modelo (contexto, límites, capacidades).
      modelo_docs: 'https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash?hl=es-419',
      prompt_version: PROMPT_VERSION,
      rubrica_version: RUBRIC_VERSION,
      formatos: Object.keys(ALLOWED),
      max_mb: MAX_MB,
      puntaje_minimo_valida: VALID_SCORE_MIN,
      confianza_minima: 0.75,
      // Cortes del nivel global sobre el promedio de los ítems aplicables (1-3).
      cortes_nivel: [
        { desde: 2.34, nivel: 'LOGRADO' },
        { desde: 1.67, nivel: 'PROCESO' },
        { desde: 0, nivel: 'INICIO' },
      ],
      limite_texto: 60000,
    },

    // Qué pasa desde que el docente sube el archivo hasta que ve el resultado.
    pasos: [
      {
        clave: 'conversion',
        titulo: 'Se lee el documento',
        etiqueta: 'Lectura',
        quien: 'servidor',
        descripcion: 'El archivo (PDF, PPTX o XLSX) se convierte a texto. Si el texto es demasiado corto o ilegible, la entrega pasa directo a revisión humana sin llegar a la IA.',
        entrada: 'El archivo que sube el docente',
        salida: 'El documento convertido a texto',
        aplica: ['UNIDAD', 'SESION'],
        prompts: [],
      },
      {
        clave: 'extraccion',
        titulo: 'Se identifica qué trae el documento',
        etiqueta: 'Extracción',
        quien: 'IA',
        descripcion: 'Un primer paso, sin evaluar todavía: qué documentos incluye la carpeta y los datos de identificación (IE, docente, área, grado, competencia). Este resultado le sirve al evaluador para distinguir «no evidenciado» de «no aplica».',
        entrada: 'El documento en texto',
        salida: 'Qué documentos están presentes y los datos de identificación',
        aplica: ['UNIDAD', 'SESION'],
        devuelve: { documentos: [...DOC_KEYS], identificacion: [...ID_KEYS] },
        prompts: ['extraccion'],
      },
      {
        clave: 'evaluacion',
        titulo: 'Se valora contra la ficha de monitoreo',
        etiqueta: 'Valoración',
        quien: 'IA',
        descripcion: 'Aquí entra la rúbrica: va como system prompt, y el mensaje añade el contexto de la entrega, el resultado de la extracción, el documento y —si es una corrección— la evaluación anterior, para que reconozca las mejoras.',
        entrada: 'Documento + extracción previa + rúbrica completa',
        salida: 'Cada ítem valorado con su evidencia y su recomendación',
        aplica: ['UNIDAD', 'SESION'],
        prompts: ['ficha', 'evaluacion'],
      },
      {
        clave: 'puntaje',
        titulo: 'Se calculan los puntajes',
        etiqueta: 'Puntaje',
        quien: 'servidor',
        descripcion: 'La aritmética no se le confía al modelo: el servidor suma los ítems aplicables, saca el promedio y decide el nivel global. Los ítems excluidos se fuerzan a «no aplica» aunque el modelo diga otra cosa.',
        entrada: 'Los ítems valorados por la IA',
        salida: 'Puntaje sobre 100, promedio y nivel global',
        aplica: ['UNIDAD', 'SESION'],
        prompts: [],
      },
      {
        clave: 'contexto',
        titulo: 'Se resume de qué trata',
        etiqueta: 'Contexto',
        quien: 'IA',
        descripcion: 'Un resumen del contenido (área real, título, temas, grado, periodo) que se guarda por versión. El docente no lo ve; sirve al director y a la UGEL para entender la entrega, y es la base del siguiente paso.',
        entrada: 'El documento en texto',
        salida: 'Área real, título, temas, grado y periodo',
        aplica: ['UNIDAD', 'SESION'],
        prompts: ['contexto'],
      },
      {
        clave: 'coherencia',
        titulo: 'Se comprueba que la sesión sea de su unidad',
        etiqueta: 'Coherencia',
        quien: 'IA',
        descripcion: 'Solo para sesiones: compara el contexto de la sesión con el de su unidad. Una sesión de Comunicación dentro de una unidad de Matemática no cuenta como válida, por buena que sea.',
        entrada: 'Contexto de la sesión + contexto de su unidad',
        salida: 'Si pertenece a la unidad, y por qué',
        aplica: ['SESION'],
        prompts: ['coherencia'],
      },
      {
        clave: 'decision',
        titulo: 'Se decide el estado y la validez',
        etiqueta: 'Resultado',
        quien: 'servidor',
        descripcion: 'El estado sale del nivel global y de la confianza del modelo. La validez es aparte: la entrega siempre queda registrada, pero solo cuenta como unidad o sesión válida si supera el puntaje mínimo y —si es sesión— es coherente con su unidad.',
        entrada: 'Nivel global, confianza y coherencia',
        salida: 'Estado de la entrega + si cuenta como válida',
        aplica: ['UNIDAD', 'SESION'],
        prompts: [],
      },
    ],

    // Cómo se llega a cada estado.
    decisiones: [
      { estado: 'APPROVED', label: 'Aprobada', regla: 'Nivel global LOGRADO (promedio ≥ 2.34) y confianza ≥ 0.75.' },
      { estado: 'NEEDS_REVISION', label: 'Necesita corrección', regla: 'Nivel global PROCESO o INICIO, con confianza suficiente.' },
      { estado: 'MANUAL_REVIEW', label: 'Revisión manual', regla: 'La IA no está segura (confianza < 0.75) o el documento no se pudo leer. Lo revisa una persona.' },
      { estado: 'PROCESSING_ERROR', label: 'Error de procesamiento', regla: 'No se pudo convertir el archivo a texto.' },
    ],

    // La rúbrica, tal como está en el código, y el documento del que sale.
    rubrica: {
      fuente: FUENTE,
      dimensiones: Object.entries(DIMENSIONES).map(([clave, nombre]) => ({ clave, nombre })),
      valoraciones: VALORACIONES,
      items: ITEMS.map(([dimension, nombre], i) => ({
        numero: i + 1,
        dimension,
        dimension_nombre: DIMENSIONES[dimension],
        nombre,
        excluido: EXCLUDED_ITEMS.has(i + 1),
      })),
      excluidos: [...EXCLUDED_ITEMS].sort((a, b) => a - b),
      nota_excluidos: 'Estos ítems están fuera de la evaluación actual: se devuelven como «no aplica», no puntúan y no afectan al promedio.',
      desempenos: DESEMPENOS.map((nombre, i) => ({ numero: i + 1, nombre })),
      nota_desempenos: 'La Sección III valora SOLO lo que la sesión prevé por diseño. El desempeño real en aula requiere observación presencial y no se juzga desde un documento.',
    },

    // Los prompts que se envían, generados por las mismas funciones que usa el motor.
    prompts: [
      {
        clave: 'ficha',
        titulo: 'System prompt · Ficha de monitoreo',
        cuando: 'Paso «Se valora contra la ficha». Va como instrucción de sistema y contiene la rúbrica completa.',
        texto: systemPromptFicha(),
      },
      {
        clave: 'evaluacion',
        titulo: 'Mensaje de evaluación',
        cuando: 'Acompaña al system prompt con el contexto de la entrega, la extracción previa y el documento.',
        texto: promptEvaluacion(EJEMPLO, '«JSON con los documentos presentes y los datos de identificación»', DOC),
      },
      {
        clave: 'extraccion',
        titulo: 'Extracción previa',
        cuando: 'Primer paso, antes de evaluar.',
        texto: promptExtraccion(DOC),
      },
      {
        clave: 'contexto',
        titulo: 'Contexto de contenido',
        cuando: 'Resume de qué trata la unidad o la sesión.',
        texto: promptContexto(EJEMPLO, DOC),
      },
      {
        clave: 'coherencia',
        titulo: 'Coherencia sesión ↔ unidad',
        cuando: 'Solo en sesiones, para comprobar que pertenecen a su unidad.',
        texto: promptCoherencia('«contexto de la sesión»', '«contexto de la unidad»'),
      },
    ],
  }
}
