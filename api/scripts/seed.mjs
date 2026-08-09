// Seed demo Kipu (modelo unificado). Crea lo que la data ugel_06 no trae:
// roles, periodos ordinarios, 1 director por colegio, 1 especialista UGEL,
// cuentas Auth, y contenido operativo de muestra (unidades/sesiones/evidencias/
// evaluaciones/contextos_ia + alertas) para que la app tenga qué mostrar.
// Ejecutar DESPUÉS de db:poblacion (usa colegios/dictados ya migrados).
// Idempotente: borra solo lo que este seed crea (es_sintetico). Uso: npm run db:seed
import { db, DEMO_PASS as PASS, ensureAuthUser } from './lib/client.mjs'
import { ensureRoles, ensurePeriodo } from './lib/adapter.mjs'

const roles = await ensureRoles(db)

// ── Limpieza del contenido de seed (no toca la data migrada por poblacion) ───
console.log('Limpiando contenido de seed previo…')
const evId = (await db.from('evidencias').select('id').eq('es_sintetico', true)).data?.map((r) => r.id) ?? []
if (evId.length) {
  const verId = (await db.from('evidencia_versiones').select('id').in('evidencia_id', evId)).data?.map((r) => r.id) ?? []
  if (verId.length) await db.from('evaluaciones').delete().in('version_id', verId)
  await db.from('evidencia_versiones').delete().in('evidencia_id', evId)
}
await db.from('evidencias').delete().eq('es_sintetico', true)
await db.from('contextos_ia').delete().not('unidad_id', 'is', null)   // contextos de seed (por unidad)
await db.from('sesiones').delete().eq('es_sintetico', true)
await db.from('unidades').delete().eq('es_sintetico', true)
await db.from('alertas').delete().eq('es_sintetico', true)
await db.from('usuarios').delete().eq('es_sintetico', true).in('rol_id', [roles.director, roles.ugel])

// ── Periodos ordinarios (bimestres) ──────────────────────────────────────────
const b1 = await ensurePeriodo(db, { anio: 2026, bimestre: 1, tipo: 'ORDINARIO', nombre: '2026 · Bimestre 1', fecha_inicio: '2026-03-01', fecha_fin: '2026-05-15' })
const b2 = await ensurePeriodo(db, { anio: 2026, bimestre: 2, tipo: 'ORDINARIO', nombre: '2026 · Bimestre 2', fecha_inicio: '2026-05-16', fecha_fin: '2026-07-31' })

// ── Especialista UGEL ────────────────────────────────────────────────────────
const ugelId = await ensureAuthUser('ugel@kipu.demo', PASS)
await db.from('usuarios').insert({ id: ugelId, rol_id: roles.ugel, colegio_id: null, nombre_completo: 'Especialista UGEL 06', es_sintetico: true })

// ── 1 director por colegio ───────────────────────────────────────────────────
const { data: colegios } = await db.from('colegios').select('id, codigo, nombre').order('codigo')
let nDir = 0
for (const c of colegios ?? []) {
  const id = await ensureAuthUser(`director.${c.codigo}@kipu.demo`, PASS)
  const { error } = await db.from('usuarios').insert({ id, rol_id: roles.director, colegio_id: c.id, nombre_completo: `Director ${c.nombre}`, es_sintetico: true })
  if (!error) nDir++
}

// ── Contenido operativo de muestra sobre los primeros dictados ───────────────
// Genera una Ficha de monitoreo UGEL 06 SINTÉTICA (misma forma que produce el
// analizador real: 17 ítems por dimensión con evidencia + recomendación, 5
// desempeños, extracción, puntajes). Espejo de api/src/services/analysis/rubric.ts.
const ITEMS = [
  ['A', 'Informe psicopedagógico y PEP de estudiantes con discapacidad'], ['A', 'Caracterización de la población estudiantil'],
  ['B', 'Organización de los propósitos de aprendizaje'], ['B', 'Uso de materiales y recursos educativos'], ['B', 'Evaluación para y del aprendizaje'],
  ['C', 'Coherencia interna de la unidad'], ['C', 'Situación significativa'], ['C', 'Criterios de evaluación'], ['C', 'Secuencia de sesiones'],
  ['C', 'Evidencias de aprendizaje'], ['C', 'Instrumento de evaluación'], ['C', 'Prevención ante emergencias/desastres'],
  ['D', 'Coherencia con la unidad didáctica'], ['D', 'Enfoque del área y propósito'], ['D', 'Acompañamiento socioemocional'],
  ['D', 'Uso de materiales del MINEDU'], ['D', 'Atención a la diversidad'],
]
const DESEMPENOS = [
  'Involucra activamente a los estudiantes en el proceso de aprendizaje',
  'Promueve el razonamiento, la creatividad y/o el pensamiento crítico',
  'Evalúa el progreso de los aprendizajes para retroalimentar y adecuar la enseñanza',
  'Propicia un ambiente de respeto y proximidad',
  'Regula positivamente el comportamiento de los estudiantes',
]
const EXCLUDED = new Set([1, 2, 3, 4, 5, 11])
const PUNTAJE = { LOGRADO: 3, PROCESO: 2, INICIO: 1, NO_EVIDENCIADO: null, NO_APLICA: null }
// Contenido por ítem aplicable. Los ítems 8 (criterios de evaluación) y 10
// (evidencias de aprendizaje) llevan variante ok/bad: ahí vive la retroalimentación formativa.
const ITEM_CONTENT = {
  6: { ev: 'La unidad articula competencia, situación significativa y secuencia de sesiones sobre fracciones.', rec: 'Verificar que cada sesión aporte a la evidencia final.' },
  7: { ev: '"Repartir una pizza en partes iguales entre los estudiantes del aula" como contexto retador.', rec: 'Conectar la situación con un problema real de la comunidad.' },
  8: { ok: { v: 'PROCESO', ev: 'Se enuncian criterios de evaluación alineados a la competencia.', rec: 'Explicitar descriptores por cada nivel de logro.' },
       bad: { v: 'INICIO', ev: 'Los criterios de evaluación se mencionan de forma general, sin descriptores por nivel.', rec: 'Redactar criterios observables con descriptores por nivel (Inicio/Proceso/Logrado) para poder retroalimentar al estudiante.' } },
  9: { ev: 'Secuencia de 4 sesiones con progresión de lo concreto a lo simbólico.', rec: 'Prever una sesión de consolidación antes de la evaluación.' },
  10: { ok: { v: 'LOGRADO', ev: 'La evidencia de aprendizaje (resolución de problemas con fracciones) permite valorar el logro.', rec: 'Acompañar la evidencia con retroalimentación descriptiva.' },
        bad: { v: 'INICIO', ev: 'No se define con claridad la evidencia de aprendizaje ni cómo se retroalimentará al estudiante durante el proceso.', rec: 'Definir la evidencia y los momentos de retroalimentación formativa (no solo al final).' } },
  12: { ev: 'La unidad incluye medidas de prevención ante sismos en el aula.', rec: '' },
  13: { ev: 'La sesión guarda coherencia con el propósito de la unidad.', rec: '' },
  14: { ev: 'El enfoque de resolución de problemas del área es explícito.', rec: '' },
  15: { ev: 'Se prevén momentos de acompañamiento socioemocional al inicio.', rec: 'Incluir una estrategia de autorregulación.' },
  16: { ev: 'Se emplean los cuadernos de trabajo del MINEDU.', rec: '' },
  17: { ev: 'Se contemplan adaptaciones para estudiantes con distinto ritmo.', rec: 'Detallar la adaptación para un caso específico.' },
}
const DESEMP_CONTENT = {
  1: { ev: 'La sesión prevé preguntas para activar saberes previos.', rec: '' },
  2: { ev: 'Se plantean problemas que exigen justificar procedimientos.', rec: 'Incluir preguntas de metacognición.' },
  3: { ok: { v: 'LOGRADO', ev: 'La sesión prevé momentos de retroalimentación descriptiva sobre el uso de fracciones.', rec: 'Registrar evidencias de la retroalimentación entregada.' },
       bad: { v: 'INICIO', ev: 'La sesión no prevé retroalimentación formativa: no se describe cómo se informará al estudiante sobre su avance.', rec: 'Incorporar retroalimentación descriptiva durante el proceso, no solo una nota al final.' } },
  4: { ev: 'Se prevén acuerdos de convivencia para el trabajo en equipo.', rec: '' },
  5: { ev: 'Se anticipan estrategias de regulación del comportamiento.', rec: '' },
}

function mkEval(aprobada) {
  const items = ITEMS.map(([dimension, nombre], i) => {
    const numero = i + 1
    if (EXCLUDED.has(numero)) return { numero, dimension, nombre, valoracion: 'NO_APLICA', puntaje: null, evidencia: 'Ítem excluido de la evaluación', recomendacion: '', excluido: true }
    const c = ITEM_CONTENT[numero]
    const variant = c.ok ? (aprobada ? c.ok : c.bad) : null
    const valoracion = variant ? variant.v : (aprobada ? 'LOGRADO' : 'PROCESO')
    return { numero, dimension, nombre, valoracion, puntaje: PUNTAJE[valoracion], evidencia: variant ? variant.ev : c.ev, recomendacion: variant ? variant.rec : c.rec, excluido: false }
  })
  const aplicables = items.filter((it) => it.puntaje !== null)
  const puntaje_total = aplicables.reduce((s, it) => s + it.puntaje, 0)
  const puntaje_max = aplicables.length * 3
  const promedio = Math.round((puntaje_total / aplicables.length) * 100) / 100
  const nivel_global = promedio >= 2.34 ? 'LOGRADO' : promedio >= 1.67 ? 'PROCESO' : 'INICIO'
  const overall = Math.round((puntaje_total / puntaje_max) * 100)
  const desempenos = DESEMPENOS.map((nombre, i) => {
    const n = i + 1, c = DESEMP_CONTENT[n]
    const variant = c.ok ? (aprobada ? c.ok : c.bad) : null
    return { numero: n, nombre, valoracion: variant ? variant.v : (aprobada ? 'LOGRADO' : 'PROCESO'), evidencia_diseno: variant ? variant.ev : c.ev, recomendacion: variant ? variant.rec : c.rec }
  })
  const ficha = {
    version: 'ficha-monitoreo-ugel06.v1',
    extraccion: {
      legible: true, observaciones: '',
      documentos_presentes: { insumos: false, planificacion_anual: true, unidad_didactica: true, sesion_aprendizaje: true, instrumentos_evaluacion: aprobada },
      identificacion: { nivel: 'Primaria', area: 'Matemática', competencia: 'Resuelve problemas de cantidad', unidad: aprobada ? 'Unidad 1' : 'Unidad 2', ie: 'No consignado', docente: 'No consignado', grado_seccion: 'No consignado', sesion: 'No consignado' },
    },
    items, desempenos, puntaje_total, puntaje_max, promedio, nivel_global,
    recomendaciones_priorizadas: aprobada
      ? ['Explicitar los descriptores de cada nivel de logro en la rúbrica.', 'Compartir los criterios de evaluación con los estudiantes al inicio de la unidad.']
      : ['Incorporar criterios de evaluación con descriptores por nivel (ítem C-3).', 'Prever momentos de retroalimentación formativa durante las sesiones (Desempeño 3).', 'Diseñar un instrumento de evaluación alineado a las evidencias.'],
    compromisos_docente: ['Rediseñar la matriz de evaluación con descriptores por nivel.', 'Registrar evidencias de la retroalimentación entregada en cada sesión.'],
    compromisos_especialista: ['Acompañar en el diseño de instrumentos de evaluación formativa.', 'Realizar una visita de monitoreo en aula el próximo mes.'],
  }
  const decision = nivel_global === 'LOGRADO' ? 'APPROVED' : 'NEEDS_REVISION'
  return {
    modelo: 'gemini-2.5-flash', decision, puntaje_total: overall, confianza: 0.9,
    resumen: aprobada
      ? 'La unidad presenta una situación significativa pertinente y una secuencia de sesiones coherente con el propósito de Matemática. Los criterios de evaluación se alinean a las evidencias de aprendizaje, lo que favorece la retroalimentación formativa. Como siguiente paso, se sugiere explicitar los descriptores de cada nivel de logro. La valoración de la Sección III requiere observación de aula.'
      : 'La unidad plantea la situación significativa, pero los criterios de evaluación y las evidencias de aprendizaje aún no permiten una retroalimentación formativa clara: no se describe cómo se informará al estudiante sobre su avance. Se recomienda incorporar instrumentos con descriptores por nivel y momentos de retroalimentación durante el proceso. La valoración de la Sección III requiere observación de aula.',
    fortalezas: aprobada
      ? ['Situación significativa contextualizada a fracciones', 'Secuencia de sesiones coherente con el propósito', 'Criterios de evaluación alineados a las evidencias']
      : ['Propósito de aprendizaje claramente definido', 'Uso de material concreto para el trabajo con fracciones'],
    mejoras: aprobada
      ? ['Explicitar descriptores por nivel de logro']
      : ['Definir criterios de evaluación con descriptores por nivel', 'Incluir momentos explícitos de retroalimentación formativa', 'Diseñar un instrumento de evaluación con niveles de logro'],
    criterios: ficha,
    flags_criticos: [],
  }
}

const { data: dictados } = await db.from('dictados').select('id, profesor_id').order('created_at').limit(6)
let nUnidades = 0
for (const [i, d] of (dictados ?? []).entries()) {
  const aprobada = i % 3 === 0
  const evalData = mkEval(aprobada)
  const decision = evalData.decision
  const { data: [u] } = await db.from('unidades').insert({ dictado_id: d.id, nombre: `Unidad ${i + 1}`, orden: 1, es_sintetico: true }).select()
  await db.from('contextos_ia').insert({ unidad_id: u.id, contexto: { area: 'Matemática', titulo: `Unidad ${i + 1}`, temas: ['fracciones'], periodo: 'diagnóstico' } })
  await db.from('sesiones').insert({ unidad_id: u.id, nombre: 'Sesión 1', fecha: '2026-04-01', orden: 1, es_sintetico: true })
  const { data: [ev] } = await db.from('evidencias').insert({ unidad_id: u.id, profesor_id: d.profesor_id, estado: decision, version_actual: 1, es_sintetico: true }).select()
  const { data: [v] } = await db.from('evidencia_versiones').insert({ evidencia_id: ev.id, version: 1, nombre_archivo: `unidad-${i + 1}.pdf`, storage_path: 'seed/none', sha256: 'seed', estado: decision, es_valida: aprobada }).select()
  await db.from('evaluaciones').insert({ version_id: v.id, ...evalData })
  nUnidades++
}

// ── Alertas de muestra ───────────────────────────────────────────────────────
const colegioAlerta = colegios?.[0]?.id ?? null
await db.from('alertas').insert([
  {
    tipo: 'REPEATED_INVALID_UNITS', severidad: 'HIGH', colegio_id: colegioAlerta,
    titulo: 'Incumplimiento recurrente en retroalimentación formativa',
    resumen: 'Varios docentes acumulan unidades consecutivas observadas por ausencia de estrategias de retroalimentación.',
    accion_sugerida: 'Evaluar acompañamiento pedagógico focalizado y reforzar la capacitación de evaluación formativa.',
    evidencia: { criterionCode: 'FORMATIVE_FEEDBACK' }, es_sintetico: true,
  },
  {
    tipo: 'LOW_GRADE_GROUP', severidad: 'MEDIUM', colegio_id: colegioAlerta,
    titulo: 'Sección con resultados diagnósticos bajo el umbral',
    resumen: 'Una sección concentra un alto porcentaje de estudiantes en nivel "En inicio" en el diagnóstico.',
    accion_sugerida: 'Revisar la planificación y evaluar refuerzo escolar focalizado.',
    evidencia: { nivel: 'C' }, es_sintetico: true,
  },
])

// bucket privado de evidencias
await db.storage.createBucket('evidence', { public: false }).catch(() => {})

console.log(`seed ok · password demo: ${PASS}`)
console.log(`  ${nDir} directores · 1 ugel · 2 periodos · ${nUnidades} unidades demo · 2 alertas`)
