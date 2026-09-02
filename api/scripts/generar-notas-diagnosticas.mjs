// Generador de data sintética: NOTAS DIAGNÓSTICAS DE PRIMARIA.
//
// Reproduce el formato real de la plantilla MINEDU que usa la UGEL 06
// (docs/privado/EV. DIAGNÓSTICA PRIMARIA.xlsx). Lo que la plantilla define — y este
// generador respeta — es:
//
//   · Áreas: MATEMÁTICA (4 competencias) y COMUNICACIÓN (3 competencias).
//   · Escala de logro: C · B · A · AD (validación de datos de la hoja).
//   · Cabecera del acta: Docente · Grado (1°-6°) · Sección (A-F) · Turno (Mañana/Tarde).
//   · Nómina de hasta 40 alumnos por aula (filas 12-51 de la hoja).
//   · Consolidado: conteo de alumnos por nivel de logro × competencia y su
//     porcentaje (hojas "CONSOLIDADO DE LOGROS").
//
// Modelo de la data (el que la plantilla implica): el aula es la unidad real —
// un mismo grado/sección/turno con UNA nómina de alumnos, evaluada en las DOS
// áreas. Por eso aquí las aulas son compartidas: el profesor de matemática y el
// de comunicación del mismo colegio dictan a los mismos alumnos, y cada
// combinación aula × área produce un "acta" (equivalente a una hoja del Excel).
//
// Continuidad: reutiliza los colegios, redes, perfiles de desempeño y los 30
// docentes (DNI + nombre) del dataset previo `ugel06_60_rubricas_diagnosticas`,
// de modo que las llaves externas ya mapeadas (school_key, dni) siguen valiendo.
//
// Determinista: PRNG con semilla fija → reejecutar produce el MISMO archivo.
// Los nombres de alumnos son sintéticos (nunca se copian los de la plantilla,
// que corresponden a menores reales).
//
// Uso: node scripts/generar-notas-diagnosticas.mjs   (o npm run db:generar-notas)
// Salida: scripts/data/ugel06_notas_diagnosticas_primaria.json
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA = join(HERE, 'data')
const SALIDA = join(DATA, 'ugel06_notas_diagnosticas_primaria.json')
const SEMILLA = 20260415 // fija: la data generada es reproducible

// ── Dominio tomado de la plantilla ───────────────────────────────────────────
const ESCALA = { C: 'En inicio', B: 'En proceso', A: 'Logro esperado', AD: 'Logro destacado' }
const CODIGO_POR_VALOR = { 1: 'C', 2: 'B', 3: 'A', 4: 'AD' }
const VALOR_POR_CODIGO = { C: 1, B: 2, A: 3, AD: 4 }
const NIVELES = ['C', 'B', 'A', 'AD']
const GRADOS = ['1°', '2°', '3°', '4°', '5°', '6°']
const TURNOS = ['Mañana', 'Tarde']

// Línea de tiempo del año escolar. El diagnóstico es la foto inicial (la
// plantilla del Excel); los bimestres son el seguimiento posterior, y permiten
// leer la evolución de cada alumno —y el efecto de su docente— en el tiempo.
const PERIODOS = [
  { key: 'diagnostico', anio: 2026, bimestre: null, tipo: 'DIAGNOSTICO', tipo_evaluacion: 'DIAGNOSTICO', nombre: 'Evaluación Diagnóstica 2026', fecha: '2026-03-20', orden: 0 },
  { key: 'b1', anio: 2026, bimestre: 1, tipo: 'ORDINARIO', tipo_evaluacion: 'BIMESTRAL', nombre: '2026 · Bimestre 1', fecha: '2026-05-15', orden: 1 },
  { key: 'b2', anio: 2026, bimestre: 2, tipo: 'ORDINARIO', tipo_evaluacion: 'BIMESTRAL', nombre: '2026 · Bimestre 2', fecha: '2026-07-31', orden: 2 },
  { key: 'b3', anio: 2026, bimestre: 3, tipo: 'ORDINARIO', tipo_evaluacion: 'BIMESTRAL', nombre: '2026 · Bimestre 3', fecha: '2026-10-09', orden: 3 },
  { key: 'b4', anio: 2026, bimestre: 4, tipo: 'ORDINARIO', tipo_evaluacion: 'BIMESTRAL', nombre: '2026 · Bimestre 4', fecha: '2026-12-18', orden: 4 },
]

// Competencias del CNEB por área. `dificultad` desplaza el desempeño esperado
// (negativo = competencia más dura) para que el consolidado no salga plano.
const AREAS = {
  matematica: {
    course_key: 'matematica',
    course_name: 'Matemática',
    area_label: 'MATEMÁTICA',
    competencias: [
      { codigo: 'C1', nombre: 'Resuelve problemas de cantidad', dificultad: 0.18 },
      { codigo: 'C2', nombre: 'Resuelve problemas de regularidad, equivalencia y cambio', dificultad: -0.08 },
      { codigo: 'C3', nombre: 'Resuelve problemas de forma, movimiento y localización', dificultad: -0.02 },
      { codigo: 'C4', nombre: 'Resuelve problemas de gestión de datos e incertidumbre', dificultad: -0.22 },
    ],
  },
  comunicacion: {
    course_key: 'comunicacion',
    course_name: 'Comunicación',
    area_label: 'COMUNICACIÓN',
    competencias: [
      { codigo: 'C1', nombre: 'Se comunica oralmente en su lengua materna', dificultad: 0.24 },
      { codigo: 'C2', nombre: 'Lee diversos tipos de textos escritos', dificultad: -0.04 },
      { codigo: 'C3', nombre: 'Escribe diversos tipos de textos', dificultad: -0.26 },
    ],
  },
}

// Perfil de desempeño del colegio → media de logro esperada (escala 1-4).
const MEDIA_POR_PERFIL = { buen_desempeno: 2.95, intermedio: 2.45, critico: 1.85 }

// ── PRNG determinista (mulberry32 + Box-Muller) ──────────────────────────────
function prng(semilla) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }
const rnd = prng(SEMILLA)
const normal = (media, sd) => {
  const u = Math.max(rnd(), 1e-9), v = rnd()
  return media + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
const entre = (min, max) => min + Math.floor(rnd() * (max - min + 1))
const elige = (lista) => lista[Math.floor(rnd() * lista.length)]

// ── Nombres sintéticos (padrón peruano frecuente) ────────────────────────────
const APELLIDOS = [
  'Quispe', 'Mamani', 'Huamán', 'Flores', 'Ramos', 'Rojas', 'Vásquez', 'Chávez', 'Ccahuana', 'Salazar',
  'Ccopa', 'Torres', 'Espinoza', 'Cárdenas', 'Palomino', 'Cabrera', 'Ayala', 'Ríos', 'Sulca', 'Tapia',
  'Bautista', 'Meza', 'Yupanqui', 'Zevallos', 'Aguirre', 'Ordóñez', 'Ventura', 'Paucar', 'Alarcón', 'Bravo',
  'Condori', 'Gamboa', 'Huarcaya', 'Ipanaqué', 'Jiménez', 'Loayza', 'Montes', 'Nolasco', 'Obispo', 'Pariona',
  'Rivera', 'Sánchez', 'Trujillo', 'Ubaldo', 'Valdivia', 'Wong', 'Yauri', 'Zamora', 'Arce', 'Barrientos',
  'Canchari', 'Dávila', 'Escobar', 'Ferrer', 'Gonzales', 'Hinostroza', 'Inga', 'Julca', 'Laura', 'Medina',
]
const NOMBRES_F = [
  'Ariana', 'Camila', 'Luana', 'Milagros', 'Karen', 'Débora', 'Shantal', 'Gabriela', 'Nayeli', 'Fabiana',
  'Rosmery', 'Yaneth', 'Jimena', 'Alessandra', 'Brenda', 'Katherine', 'Mayra', 'Xiomara', 'Danna', 'Thalía',
  'Zoe', 'Antonella', 'Valeria', 'Estrella', 'Nicol', 'Abigail', 'Lucero', 'Melany', 'Rocío', 'Sheyla',
]
const NOMBRES_M = [
  'Mathías', 'Joaquín', 'Sebastián', 'Leandro', 'Fabricio', 'Dylan', 'Alexander', 'Piero', 'Kevin', 'Brayan',
  'Adriano', 'Jhoel', 'Rodrigo', 'Ángel', 'Thiago', 'Marcelo', 'Gadiel', 'Jesús', 'Franco', 'Nicolás',
  'Aarón', 'Bruno', 'César', 'Diego', 'Erick', 'Fernando', 'Gustavo', 'Héctor', 'Iván', 'Jampier',
]
const SEGUNDOS_F = ['Estrella', 'Milagros', 'Belén', 'Alessandra', 'Nicol', 'Julissa', 'Beatriz', 'Sofía', '', '']
const SEGUNDOS_M = ['Andrés', 'Gabriel', 'Antonio', 'Josué', 'Daniel', 'Fernando', 'Leonel', 'Mateo', '', '']

function nombreAlumno() {
  const mujer = rnd() < 0.5
  const n1 = elige(mujer ? NOMBRES_F : NOMBRES_M)
  const n2 = elige(mujer ? SEGUNDOS_F : SEGUNDOS_M)
  const a1 = elige(APELLIDOS)
  let a2 = elige(APELLIDOS)
  while (a2 === a1) a2 = elige(APELLIDOS)
  const nombres = [n1, n2].filter(Boolean).join(' ')
  return {
    // Orden natural, para la UI (coherente con el resto de la data del proyecto).
    full_name: `${nombres} ${a1} ${a2}`,
    // Orden de nómina MINEDU (APELLIDOS NOMBRES, mayúsculas), como en la plantilla.
    nomina_name: `${a1} ${a2} ${nombres}`.toLocaleUpperCase('es-PE'),
  }
}

// ── Contexto heredado del dataset previo (colegios, redes, docentes) ─────────
const rubricasDoc = JSON.parse(readFileSync(join(DATA, 'ugel06_60_rubricas_diagnosticas.json'), 'utf8'))
const previas = Object.values(rubricasDoc.rubrics)

// Un colegio = { school_key, nombre, red, distrito, perfil, docentes por área }.
const colegios = new Map()
for (const r of previas) {
  if (!colegios.has(r.school_key)) {
    colegios.set(r.school_key, {
      school_key: r.school_key,
      school_name: r.school_name,
      network_key: r.network_key,
      network_name: r.network_name,
      district: r.district,
      school_performance_profile: r.school_performance_profile,
      school_performance_profile_label: r.school_performance_profile_label,
      docentes: {},
    })
  }
  colegios.get(r.school_key).docentes[r.course_key] = { dni: r.professor_dni, full_name: r.professor_name }
}
const listaColegios = [...colegios.values()]
for (const c of listaColegios) {
  for (const area of Object.keys(AREAS)) {
    if (!c.docentes[area]) throw new Error(`${c.school_key} no tiene docente de ${area}`)
  }
}

// ── Aulas: 2 por colegio (secciones A y B del mismo grado, como en la plantilla) ──
const slug = (grado, seccion) => `${grado.replace('°', '')}${seccion.toLowerCase()}`
const aulas = []
listaColegios.forEach((col, i) => {
  const grado = GRADOS[i % GRADOS.length]
  // Colegios pares operan las dos secciones en la mañana; impares, una por turno.
  const turnos = i % 2 === 0 ? ['Mañana', 'Mañana'] : ['Mañana', 'Tarde']
  ;['A', 'B'].forEach((seccion, j) => {
    const section_key = `${col.school_key}_${slug(grado, seccion)}`
    const students_count = entre(22, 38) // la plantilla admite hasta 40
    const students = Array.from({ length: students_count }, (_, k) => {
      const numero = k + 1
      return {
        student_key: `${section_key}_est_${String(numero).padStart(2, '0')}`,
        student_number: numero,
        ...nombreAlumno(),
      }
    })
    // Orden de nómina: alfabético por apellidos, como en el acta real.
    students.sort((a, b) => a.nomina_name.localeCompare(b.nomina_name, 'es'))
    students.forEach((s, k) => {
      s.student_number = k + 1
      s.student_key = `${section_key}_est_${String(k + 1).padStart(2, '0')}`
    })
    aulas.push({
      section_key,
      school_key: col.school_key,
      school_name: col.school_name,
      network_key: col.network_key,
      network_name: col.network_name,
      district: col.district,
      school_performance_profile: col.school_performance_profile,
      school_performance_profile_label: col.school_performance_profile_label,
      nivel_educativo: 'Primaria',
      grado,
      seccion,
      turno: turnos[j],
      nombre: `${grado} ${seccion}`,
      students_count,
      students,
      is_synthetic: true,
    })
  })
})

// ── Generación de notas ──────────────────────────────────────────────────────
// Habilidad latente del alumno (escala 1-4) = media del perfil del colegio
// + efecto del aula (docente/grupo) + variación individual. Cada competencia
// añade su dificultad y ruido de medición. El turno tarde pesa levemente menos
// (patrón conocido en la UGEL), y el nivel general es el promedio de las
// competencias del área, según la regla de la plantilla.
const efectoAula = new Map(aulas.map((a) => [a.section_key, normal(0, 0.18)]))

// Efecto docente: cuánto empuja (o no) el aprendizaje de sus alumnos cada
// bimestre. Es lo que hace que la evolución de un alumno se relacione con quién
// le enseña, no solo con su punto de partida.
const efectoDocente = new Map()
for (const col of listaColegios) {
  for (const d of Object.values(col.docentes)) {
    if (!efectoDocente.has(d.dni)) efectoDocente.set(d.dni, normal(0.16, 0.16))
  }
}

// ── Rasgos individuales del alumno (persisten todo el año) ───────────────────
// Sin esto todas las trayectorias salen paralelas y la data se nota fabricada.
// Con esto hay quien despega, quien se estanca, quien retrocede, y quien falta a
// una evaluación o se traslada a mitad de año (huecos en la serie, como en la
// realidad). El diagnóstico NUNCA tiene huecos: es el acta completa del Excel.
const rasgoAlumno = new Map()
for (const aula of aulas) {
  for (const s of aula.students) {
    rasgoAlumno.set(s.student_key, {
      ritmo: normal(1, 0.6),                              // multiplica la ganancia (puede ser <0)
      volatilidad: 0.26 + Math.abs(normal(0, 0.16)),      // cuánto oscila de un periodo a otro
      trasladoDesde: rnd() < 0.025 ? entre(2, PERIODOS.length - 1) : null,
      faltaEn: rnd() < 0.07 ? entre(1, PERIODOS.length - 1) : null,
    })
  }
}

function nivelDe(x) {
  const v = Math.min(4, Math.max(1, Math.round(x)))
  return CODIGO_POR_VALOR[v]
}

// Califica una nómina en un área a partir de la habilidad latente de cada alumno.
// Devuelve las filas (una por alumno, con sus competencias) y el consolidado.
function calificar(students, competencias, habilidad, sesgo, ruido = 0.5) {
  const filas = students.map((s) => {
    const fila = {
      student_key: s.student_key,
      student_number: s.student_number,
      full_name: s.full_name,
      nomina_name: s.nomina_name,
    }
    let suma = 0
    for (const c of competencias) {
      const codigo = nivelDe(habilidad.get(s.student_key) + sesgo + c.dificultad + normal(0, ruido))
      fila[c.codigo] = codigo
      suma += VALOR_POR_CODIGO[codigo]
    }
    const promedio = suma / competencias.length
    fila.average_score_1_to_4 = Math.round(promedio * 100) / 100
    fila.overall_grade = nivelDe(promedio)
    fila.overall_level = ESCALA[fila.overall_grade]
    fila.is_synthetic = true
    return fila
  })

  // Consolidado (hojas "CONSOLIDADO DE LOGROS"): conteo y % por competencia.
  const por_competencia = {}
  const porcentajes = {}
  for (const c of competencias) {
    const conteo = Object.fromEntries(NIVELES.map((n) => [n, 0]))
    for (const f of filas) conteo[f[c.codigo]] += 1
    por_competencia[c.codigo] = conteo
    porcentajes[c.codigo] = Object.fromEntries(
      NIVELES.map((n) => [n, Math.round((conteo[n] / filas.length) * 10000) / 10000]),
    )
  }
  const nivel_general = Object.fromEntries(NIVELES.map((n) => [n, 0]))
  for (const f of filas) nivel_general[f.overall_grade] += 1

  return {
    filas,
    consolidado: {
      por_competencia,
      porcentajes,
      nivel_general,
      promedio_aula: Math.round((filas.reduce((s, f) => s + f.average_score_1_to_4, 0) / filas.length) * 100) / 100,
    },
  }
}

const actas = []
// Estado latente por acta, para encadenar los bimestres sobre el diagnóstico.
const estado = new Map()   // acta_key → { habilidad: Map, sesgo, aula, area, docente }

for (const aula of aulas) {
  const col = colegios.get(aula.school_key)
  const base = MEDIA_POR_PERFIL[aula.school_performance_profile] ?? 2.5
  const ajusteTurno = aula.turno === 'Tarde' ? -0.12 : 0
  // Habilidad por alumno, compartida entre áreas (es la misma nómina) + sesgo por área.
  const habilidad = new Map(aula.students.map((s) => [s.student_key, normal(base + ajusteTurno + efectoAula.get(aula.section_key), 0.72)]))

  for (const area of Object.values(AREAS)) {
    const docente = col.docentes[area.course_key]
    const sesgoArea = normal(0, 0.14) // el aula puede ir mejor en un área que en la otra
    const { filas, consolidado } = calificar(aula.students, area.competencias, habilidad, sesgoArea)
    const acta_key = `${aula.section_key}_${area.course_key}`
    estado.set(acta_key, {
      habilidad: new Map(habilidad),   // copia: cada área evoluciona por su lado
      sesgo: sesgoArea, aula, area, docente,
    })

    actas.push({
      acta_key: `${aula.section_key}_${area.course_key}`,
      section_key: aula.section_key,
      area: area.area_label,
      course_key: area.course_key,
      course_name: area.course_name,
      competencias: area.competencias.map(({ codigo, nombre }) => ({ codigo, nombre })),
      professor_dni: docente.dni,
      professor_name: docente.full_name,
      school_key: aula.school_key,
      school_name: aula.school_name,
      network_key: aula.network_key,
      network_name: aula.network_name,
      district: aula.district,
      school_performance_profile: aula.school_performance_profile,
      school_performance_profile_label: aula.school_performance_profile_label,
      nivel_educativo: aula.nivel_educativo,
      grado: aula.grado,
      seccion: aula.seccion,
      turno: aula.turno,
      students_count: filas.length,
      students: filas,
      consolidado,
      is_synthetic: true,
    })
  }
}

// ── Seguimiento bimestral ────────────────────────────────────────────────────
// La habilidad de cada alumno avanza entre periodos: una ganancia base del
// sistema + el efecto de su docente + variación individual (hay quien despega y
// quien retrocede). Al depender del docente, la serie temporal del alumno y el
// desempeño de su profesor quedan relacionados, que es lo que el panel lee.
// La ganancia se frena cerca del techo (4 = AD): quien ya está arriba avanza
// poco, quien viene de abajo tiene más recorrido. Sin esto todos se apilarían en
// AD al cuarto bimestre.
const GANANCIA_BASE = 0.24
const seguimiento = []
for (const p of PERIODOS.filter((x) => x.orden > 0)) {
  for (const acta of actas) {
    const st = estado.get(acta.acta_key)
    // El empuje del docente varía un poco de un bimestre a otro (no es una constante).
    const empuje = (efectoDocente.get(acta.professor_dni) ?? 0) + normal(0, 0.07)
    for (const [key, valor] of st.habilidad) {
      const r = rasgoAlumno.get(key)
      const margen = Math.max(0.05, (4.35 - valor) / 3.35)      // 1 abajo → ~0 en el techo
      // Un 8% de las veces pasa algo puntual: una racha buena o un mal periodo.
      const evento = rnd() < 0.08 ? normal(0, 0.45) : 0
      const delta = (GANANCIA_BASE + empuje) * margen * r.ritmo + normal(0, r.volatilidad) + evento
      st.habilidad.set(key, Math.min(4.4, Math.max(0.6, valor + delta)))
    }

    // Quién rinde la evaluación: se descuentan traslados y ausencias puntuales.
    const presentes = st.aula.students.filter((s) => {
      const r = rasgoAlumno.get(s.student_key)
      if (r.trasladoDesde != null && p.orden >= r.trasladoDesde) return false
      return r.faltaEn !== p.orden
    })

    // Ruido de medición: cada bimestre usa instrumentos y contenidos distintos,
    // así que una misma habilidad no produce siempre la misma nota. Sin este
    // margen las series salen planas —el mismo 3.33 cuatro veces seguidas—, que
    // es lo que delata a simple vista que la data está fabricada.
    const sesgoPeriodo = st.sesgo + normal(0, 0.09)
    const { filas, consolidado } = calificar(presentes, st.area.competencias, st.habilidad, sesgoPeriodo, 0.46 + rnd() * 0.16)
    seguimiento.push({
      acta_key: acta.acta_key,
      section_key: acta.section_key,
      course_key: acta.course_key,
      professor_dni: acta.professor_dni,
      periodo: p.key,
      periodo_nombre: p.nombre,
      fecha: p.fecha,
      tipo_evaluacion: p.tipo_evaluacion,
      students_count: filas.length,
      students: filas.map(({ nomina_name: _n, ...f }) => f),   // el nombre ya va en el acta
      consolidado,
      is_synthetic: true,
    })
  }
}

// ── Totales del dataset ──────────────────────────────────────────────────────
const totalAlumnos = aulas.reduce((s, a) => s + a.students_count, 0)
const registros = actas.reduce((s, a) => s + a.students_count, 0)
const distribucionGeneral = Object.fromEntries(NIVELES.map((n) => [n, 0]))
for (const a of actas) for (const n of NIVELES) distribucionGeneral[n] += a.consolidado.nivel_general[n]
const compsPorActa = new Map(actas.map((a) => [a.acta_key, a.competencias.length]))
const notasDiagnostico = actas.reduce((s, a) => s + a.students_count * (a.competencias.length + 1), 0)
const notasSeguimiento = seguimiento.reduce((s, r) => s + r.students_count * (compsPorActa.get(r.acta_key) + 1), 0)
const notasEsperadas = notasDiagnostico + notasSeguimiento

// Evolución del promedio general por periodo (control de que la serie sube).
const promedioPorPeriodo = { diagnostico: prom(actas) }
for (const p of PERIODOS.filter((x) => x.orden > 0)) {
  promedioPorPeriodo[p.key] = prom(seguimiento.filter((s) => s.periodo === p.key))
}
function prom(lista) {
  const n = lista.reduce((s, x) => s + x.students_count, 0)
  const suma = lista.reduce((s, x) => s + x.consolidado.promedio_aula * x.students_count, 0)
  return n ? Math.round((suma / n) * 100) / 100 : null
}

const doc = {
  dataset_key: 'ugel06_notas_diagnosticas_primaria_v1',
  ugel_key: rubricasDoc.ugel_key || 'ugel_06',
  data_type: 'synthetic_test_data',
  nivel_educativo: 'Primaria',
  source_template: 'docs/privado/EV. DIAGNÓSTICA PRIMARIA.xlsx',
  generator: 'api/scripts/generar-notas-diagnosticas.mjs',
  seed: SEMILLA,
  description:
    'Notas sintéticas de la evaluación diagnóstica de primaria (UGEL 06) con el formato de la ' +
    'plantilla MINEDU: un acta por aula × área, matemática con 4 competencias y comunicación con 3, ' +
    'escala C/B/A/AD y consolidado de logros. El aula es compartida por ambas áreas: la misma nómina ' +
    'de alumnos se evalúa con su docente de matemática y su docente de comunicación. Además del ' +
    'diagnóstico incluye el seguimiento de los cuatro bimestres del mismo grupo, para leer la ' +
    'evolución de cada alumno en el tiempo y el efecto de su docente. Cada alumno tiene su propio ' +
    'ritmo de avance, altibajos puntuales y, en algunos casos, ausencias o traslado a mitad de año ' +
    '(huecos en la serie); el acta diagnóstica, en cambio, está siempre completa.',
  grading_scale: ESCALA,
  summary_rule:
    'El nivel general del alumno en un área es el promedio numérico de sus competencias ' +
    '(C=1, B=2, A=3, AD=4) redondeado al entero más cercano.',
  areas: Object.fromEntries(
    Object.entries(AREAS).map(([k, a]) => [k, {
      course_key: a.course_key,
      course_name: a.course_name,
      area_label: a.area_label,
      competencias: a.competencias.map(({ codigo, nombre }) => ({ codigo, nombre })),
    }]),
  ),
  plantilla: {
    grados: GRADOS,
    secciones: ['A', 'B', 'C', 'D', 'E', 'F'],
    turnos: TURNOS,
    max_alumnos_por_aula: 40,
  },
  periodos: PERIODOS,
  totals: {
    colegios: listaColegios.length,
    profesores: listaColegios.length * 2,
    aulas: aulas.length,
    actas: actas.length,
    alumnos: totalAlumnos,
    registros_alumno_area: registros,
    periodos: PERIODOS.length,
    notas_diagnostico: notasDiagnostico,
    notas_seguimiento: notasSeguimiento,
    notas_a_insertar: notasEsperadas,
  },
  overall_student_level_distribution: distribucionGeneral,
  promedio_por_periodo: promedioPorPeriodo,
  aulas,
  actas,
  seguimiento,
}

writeFileSync(SALIDA, JSON.stringify(doc, null, 2) + '\n')

const pct = (n) => `${Math.round((n / registros) * 1000) / 10}%`
console.log(`✔ ${SALIDA.replace(HERE, 'scripts')}`)
console.log(`  ${doc.totals.colegios} colegios · ${doc.totals.aulas} aulas · ${doc.totals.alumnos} alumnos`)
console.log(`  ${doc.totals.actas} actas (aula × área) · ${PERIODOS.length} periodos · ${doc.totals.notas_a_insertar} notas a insertar`)
console.log(`    diagnóstico ${notasDiagnostico} · seguimiento bimestral ${notasSeguimiento}`)
console.log(`  nivel general (diagnóstico): ${NIVELES.map((n) => `${n} ${distribucionGeneral[n]} (${pct(distribucionGeneral[n])})`).join(' · ')}`)
console.log(`  promedio por periodo: ${PERIODOS.map((p) => `${p.key} ${promedioPorPeriodo[p.key]}`).join(' → ')}`)
