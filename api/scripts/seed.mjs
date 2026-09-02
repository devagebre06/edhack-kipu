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
// Directores / especialistas previos: se borran de Auth (la fila de `usuarios`
// cae por cascade), si no quedarían cuentas de login huérfanas.
const { data: previos } = await db.from('usuarios').select('id').eq('es_sintetico', true).in('rol_id', [roles.director, roles.ugel])
for (const u of previos ?? []) {
  await db.from('logs_auditoria').update({ actor_id: null }).eq('actor_id', u.id)  // sin FK: se anula a mano
  const { error } = await db.auth.admin.deleteUser(u.id)
  if (error) throw new Error(`borrar cuenta ${u.id}: ${error.message}`)
}

// ── Periodos ordinarios (bimestres) ──────────────────────────────────────────
// Los cuatro bimestres del año escolar. Sus fechas de cierre son el eje temporal
// de las series de notas (ver scripts/generar-notas-diagnosticas.mjs).
const BIMESTRES = [
  { bimestre: 1, nombre: '2026 · Bimestre 1', fecha_inicio: '2026-03-01', fecha_fin: '2026-05-15' },
  { bimestre: 2, nombre: '2026 · Bimestre 2', fecha_inicio: '2026-05-16', fecha_fin: '2026-07-31' },
  { bimestre: 3, nombre: '2026 · Bimestre 3', fecha_inicio: '2026-08-10', fecha_fin: '2026-10-09' },
  { bimestre: 4, nombre: '2026 · Bimestre 4', fecha_inicio: '2026-10-12', fecha_fin: '2026-12-18' },
]
for (const b of BIMESTRES) await ensurePeriodo(db, { anio: 2026, tipo: 'ORDINARIO', ...b })

// ── Especialista UGEL ────────────────────────────────────────────────────────
const ugelId = await ensureAuthUser('ugel@kipu.demo', PASS)
await db.from('usuarios').insert({ id: ugelId, rol_id: roles.ugel, colegio_id: null, nombre_completo: 'Especialista UGEL 06', es_sintetico: true })

// ── 1 director (único) en el colegio del docente demo ────────────────────────
// Un solo login por rol: la demo se recorre con ugel@ / director@ / profesor@.
// El director se liga al colegio del docente de menor dni —el mismo que
// `db:demo-users` promueve a profesor@— para que ambos paneles muestren la
// misma institución y ninguno salga vacío.
const { data: colegios } = await db.from('colegios').select('id, codigo, nombre').order('codigo')
const { data: dpDemo } = await db.from('datos_personales').select('usuario_id').order('dni').limit(1)
const { data: profDemo } = dpDemo?.length
  ? await db.from('usuarios').select('colegio_id').eq('id', dpDemo[0].usuario_id).single()
  : { data: null }
const colegioDemo = profDemo?.colegio_id ?? colegios?.[0]?.id ?? null
const nombreColegioDemo = colegios?.find((c) => c.id === colegioDemo)?.nombre ?? '—'
const directorId = await ensureAuthUser('director@kipu.demo', PASS)
{
  const { error } = await db.from('usuarios').insert({ id: directorId, rol_id: roles.director, colegio_id: colegioDemo, nombre_completo: 'Director(a)', es_sintetico: true })
  if (error) throw new Error(`director@kipu.demo: ${error.message}`)
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

// `variacion` degrada esa cantidad de ítems aplicables (LOGRADO→PROCESO→INICIO)
// de forma determinista, para que no todas las fichas den el mismo puntaje: el
// evaluador real nunca produce dos idénticas. La ficha queda coherente porque
// puntaje, promedio, nivel y decisión se recalculan a partir de los ítems.
function mkEval(aprobada, variacion = 0) {
  const items = ITEMS.map(([dimension, nombre], i) => {
    const numero = i + 1
    if (EXCLUDED.has(numero)) return { numero, dimension, nombre, valoracion: 'NO_APLICA', puntaje: null, evidencia: 'Ítem excluido de la evaluación', recomendacion: '', excluido: true }
    const c = ITEM_CONTENT[numero]
    const variant = c.ok ? (aprobada ? c.ok : c.bad) : null
    const valoracion = variant ? variant.v : (aprobada ? 'LOGRADO' : 'PROCESO')
    return { numero, dimension, nombre, valoracion, puntaje: PUNTAJE[valoracion], evidencia: variant ? variant.ev : c.ev, recomendacion: variant ? variant.rec : c.rec, excluido: false }
  })
  if (variacion > 0) {
    const idx = items.map((it, i) => (it.puntaje !== null ? i : -1)).filter((i) => i >= 0)
    for (let k = 0; k < variacion && k < idx.length; k++) {
      const it = items[idx[(k * 5 + variacion * 3) % idx.length]]
      if (it.valoracion === 'LOGRADO') { it.valoracion = 'PROCESO'; it.puntaje = PUNTAJE.PROCESO }
      else if (it.valoracion === 'PROCESO') { it.valoracion = 'INICIO'; it.puntaje = PUNTAJE.INICIO }
    }
  }
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

// Elegir los dictados a los que se les crea contenido: primero los del docente
// demo (para que su panel tenga entregas) y luego uno por colegio distinto, de
// modo que el gráfico "score por institución" del panel UGEL tenga varias barras
// y no una sola.
const { data: todosDictados } = await db.from('dictados').select('id, profesor_id, aulas(colegio_id)').order('created_at')
const dictados = []
const colegiosUsados = new Set()
for (const d of (todosDictados ?? []).filter((d) => d.profesor_id === dpDemo?.[0]?.usuario_id)) {
  dictados.push(d); colegiosUsados.add(d.aulas?.colegio_id)
}
for (const d of todosDictados ?? []) {
  if (dictados.length >= 12) break
  const col = d.aulas?.colegio_id
  if (colegiosUsados.has(col)) continue
  dictados.push(d); colegiosUsados.add(col)
}
// Una unidad por bimestre en cada dictado, con sus sesiones y su evidencia
// evaluada. Da volumen suficiente para que las fichas de docente y el panel UGEL
// muestren historial en vez de un caso suelto.
const TEMAS = [
  { titulo: 'Números y operaciones', temas: ['fracciones', 'decimales'], sesiones: ['Comparamos fracciones', 'Resolvemos problemas con fracciones', 'Aplicamos lo aprendido'] },
  { titulo: 'Patrones y equivalencias', temas: ['patrones', 'ecuaciones'], sesiones: ['Descubrimos patrones', 'Representamos equivalencias'] },
  { titulo: 'Formas y movimiento', temas: ['geometría', 'localización'], sesiones: ['Reconocemos figuras', 'Nos ubicamos en el plano', 'Construimos cuerpos geométricos'] },
  { titulo: 'Gestión de datos', temas: ['tablas', 'gráficos', 'probabilidad'], sesiones: ['Organizamos datos en tablas', 'Interpretamos gráficos'] },
]
let nUnidades = 0
let nSesiones = 0
let nEvidenciasSesion = 0
for (const [i, d] of (dictados ?? []).entries()) {
  for (const [b, bim] of BIMESTRES.entries()) {
    const tema = TEMAS[b]
    // Alterna aprobadas y observadas de forma estable (sin aleatoriedad: el seed
    // debe dar el mismo resultado en cada corrida).
    const aprobada = (i + b) % 3 !== 1
    const evalData = mkEval(aprobada, (i * 3 + b * 2) % 6)
    const decision = evalData.decision
    const orden = b + 1
    const { data: [u] } = await db.from('unidades')
      .insert({ dictado_id: d.id, nombre: `Unidad ${orden} · ${tema.titulo}`, orden, es_sintetico: true }).select()
    await db.from('contextos_ia').insert({
      unidad_id: u.id,
      contexto: { area: 'Matemática', titulo: tema.titulo, temas: tema.temas, periodo: bim.nombre },
    })
    const { data: sesionesCreadas } = await db.from('sesiones').insert(tema.sesiones.map((nombre, k) => ({
      unidad_id: u.id, nombre, fecha: bim.fecha_fin, orden: k + 1, es_sintetico: true,
    }))).select()
    nSesiones += tema.sesiones.length

    // Evidencia por sesión: la evidencia es polimórfica (unidad XOR sesión), y
    // sin esto las sesiones existen pero no tienen documento ni evaluación que
    // mostrar en el visor. Se deja una de cada tres sin entregar, que es lo que
    // pasa en la realidad.
    for (const [k, s] of (sesionesCreadas ?? []).entries()) {
      if ((i + b + k) % 3 === 2) continue
      const okSesion = (i + b + k) % 4 !== 1
      const evalSesion = mkEval(okSesion, (i + b * 2 + k * 3) % 6)
      const { data: [evS] } = await db.from('evidencias')
        .insert({ sesion_id: s.id, profesor_id: d.profesor_id, estado: evalSesion.decision, version_actual: 1, es_sintetico: true }).select()
      const { data: [vS] } = await db.from('evidencia_versiones').insert({
        evidencia_id: evS.id, version: 1, nombre_archivo: `sesion-${orden}-${k + 1}.pdf`,
        storage_path: 'seed/none', sha256: 'seed', estado: evalSesion.decision, es_valida: okSesion,
      }).select()
      await db.from('evaluaciones').insert({ version_id: vS.id, ...evalSesion })
      nEvidenciasSesion++
    }
    const { data: [ev] } = await db.from('evidencias')
      .insert({ unidad_id: u.id, profesor_id: d.profesor_id, estado: decision, version_actual: 1, es_sintetico: true }).select()
    const { data: [v] } = await db.from('evidencia_versiones').insert({
      evidencia_id: ev.id, version: 1, nombre_archivo: `unidad-${orden}-${bim.bimestre}.pdf`,
      storage_path: 'seed/none', sha256: 'seed', estado: decision, es_valida: aprobada,
    }).select()
    await db.from('evaluaciones').insert({ version_id: v.id, ...evalData })
    nUnidades++
  }
}

// ── Alertas de muestra (en el colegio del director, para que las vea) ────────
const colegioAlerta = colegioDemo
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
console.log(`  1 director (${nombreColegioDemo}) · 1 ugel · ${BIMESTRES.length} bimestres · ${nUnidades} unidades · ${nSesiones} sesiones (${nEvidenciasSesion} con evidencia) · 2 alertas`)
