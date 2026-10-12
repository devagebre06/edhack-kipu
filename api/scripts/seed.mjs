// Seed demo Kipu (modelo unificado). Crea lo que la data ugel_06 no trae:
// roles, periodos ordinarios, 1 director, 1 especialista UGEL,
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
const { data: unidadesSeed } = await db.from('unidades').select('id').eq('es_sintetico', true)
const idsUnidadesSeed = (unidadesSeed ?? []).map(u => u.id)
if (idsUnidadesSeed.length) await db.from('contextos_ia').delete().in('unidad_id', idsUnidadesSeed)
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

// ── Evaluaciones sintéticas para unidades y sesiones ─────────────────────────
// Mantener los nombres y referencias alineados con analysis/rubric.ts. Estas
// fichas son ejemplos de interfaz: no se ha enviado un documento a Gemini.
const CRITERIOS = [
  { nombre: 'Alineación curricular', fuente: 'CNEB: competencias, capacidades y estándar del IV ciclo; Programa Curricular: desempeños de 4.º.', evidencia: 'Se relaciona la competencia con el propósito de aprendizaje.', recomendacion: 'Precisar cómo se vincula el propósito con el estándar del IV ciclo.' },
  { nombre: 'Pertinencia para 4.º grado y enfoque del área', fuente: 'CNEB: estándar del IV ciclo; Programa Curricular: enfoque y desempeños de Comunicación o Matemática.', evidencia: 'Las actividades se plantean para 4.º de primaria desde el enfoque del área.', recomendacion: 'Ajustar la demanda de las actividades al desempeño esperado para 4.º.' },
  { nombre: 'Coherencia de la planificación', fuente: 'CNEB: planificación desde situaciones significativas; Programa Curricular: propósito, contexto y necesidades; Oficio UGEL 06: ítems generales 6, 7 y 13.', evidencia: 'El propósito, las actividades y la evidencia guardan relación entre sí.', recomendacion: 'Explicar la relación entre el propósito y la evidencia propuesta.' },
  { nombre: 'Secuencia y demanda cognitiva', fuente: 'CNEB: aprender haciendo y pensamiento complejo; Programa Curricular: enfoque del área; Oficio UGEL 06: secuencia de sesiones y enfoque (ítems 9 y 14).', evidencia: 'La secuencia avanza de la exploración a la resolución y explicación.', recomendacion: 'Incluir una actividad que exija justificar los procedimientos.' },
  { nombre: 'Evidencia y criterios de evaluación', fuente: 'CNEB y Programa Curricular: evidencia vinculada a competencia, estándar y desempeño; Oficio UGEL 06: ítems 8 y 10.', evidencia: 'La evidencia permite observar el aprendizaje previsto.', recomendacion: 'Formular criterios observables vinculados a esa evidencia.' },
  { nombre: 'Evaluación y retroalimentación', fuente: 'CNEB y Programa Curricular: evaluación formativa e instrumentos; Oficio UGEL 06: instrumento pertinente (ítem 11), sin exigir uno específico.', evidencia: 'Se prevé recoger información y dar retroalimentación durante la actividad.', recomendacion: 'Indicar cuándo y cómo se dará retroalimentación formativa.' },
  { nombre: 'Atención a la diversidad', fuente: 'CNEB y Programa Curricular: contextualización y apoyos; Oficio UGEL 06: atención diferenciada (ítem 17).', evidencia: 'Se prevén apoyos para estudiantes con distintos ritmos de aprendizaje.', recomendacion: 'Precisar los apoyos o ajustes según las necesidades del grupo.' },
  { nombre: 'Claridad y viabilidad', fuente: 'CNEB y Programa Curricular: recursos pertinentes; Oficio UGEL 06: coherencia y materiales (ítems generales 6 y 16).', evidencia: 'Las indicaciones y los recursos permiten desarrollar la actividad.', recomendacion: 'Aclarar los recursos y el tiempo previsto para cada actividad.' },
]

function mkEval(aprobada, variacion = 0, tipo = 'unidad de aprendizaje') {
  const puntajes = CRITERIOS.map(() => aprobada ? 3 : 2)
  for (let k = 0; k < Math.min(variacion, CRITERIOS.length); k++) {
    const indice = (k * 3 + variacion) % CRITERIOS.length
    puntajes[indice]--
  }
  const items = CRITERIOS.map((criterio, i) => ({
    numero: i + 1,
    nombre: criterio.nombre,
    fuente: criterio.fuente,
    puntaje: puntajes[i],
    nivel: ['Sin evidencia', 'Inicio', 'En proceso', 'Logrado'][puntajes[i]],
    evidencia: puntajes[i] === 3
      ? `Ejemplo sintético: ${criterio.evidencia}`
      : `Ejemplo sintético: se menciona ${criterio.nombre.toLowerCase()}, pero falta sustento o detalle en la planificación.`,
    recomendacion: puntajes[i] < 3 ? criterio.recomendacion : '',
  }))
  const puntaje_total = puntajes.reduce((suma, puntaje) => suma + puntaje, 0)
  const decision = puntaje_total >= 18 ? 'APPROVED' : 'NEEDS_REVISION'
  const recomendaciones = items.filter(item => item.puntaje < 3).slice(0, 3).map(item => item.recomendacion)
  const esSesion = tipo === 'sesión de aprendizaje'
  return {
    modelo: 'demo-sintetica', prompt_version: 'demo-sintetica', rubrica_version: 'planificacion-4primaria.v1',
    decision, puntaje_total: Math.round(100 * puntaje_total / 24), confianza: 0,
    resumen: `Ejemplo sintético de ${tipo}: la planificación escrita ${decision === 'APPROVED' ? 'alcanza' : 'aún no alcanza'} el umbral de 75/100. La práctica en aula requiere observación.`,
    fortalezas: ['Propósito de aprendizaje identificado', 'Actividades relacionadas con la competencia'],
    mejoras: recomendaciones,
    criterios: {
      version: 'planificacion-4primaria.v1', tipo,
      extraccion: {
        legible: true, observaciones: 'Contenido sintético de demostración',
        documentos_presentes: { insumos: false, planificacion_anual: false, unidad_didactica: !esSesion, sesion_aprendizaje: esSesion, instrumentos_evaluacion: false },
        identificacion: { nivel: 'Primaria', area: 'Matemática', competencia: 'Resuelve problemas de cantidad', grado_seccion: '4.º de primaria', unidad: 'Unidad de ejemplo', sesion: esSesion ? 'Sesión de ejemplo' : '' },
      },
      items, puntaje_total, puntaje_max: 24, recomendaciones_priorizadas: recomendaciones,
    },
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
      const evalSesion = mkEval(okSesion, (i + b * 2 + k * 3) % 6, 'sesión de aprendizaje')
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
