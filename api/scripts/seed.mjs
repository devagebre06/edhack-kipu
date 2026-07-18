// Seed demo Kipu: usuarios, estructura, historial, alertas. Idempotente vía borrado previo.
// Uso: node --env-file=.env scripts/seed.mjs   (o: npm run db:seed)
import { db, DEMO_PASS as PASS, ensureAuthUser } from './lib/client.mjs'

const users = [
  ['profesor@kipu.demo', 'María Quispe', 'teacher', 'IE2034'],
  ['profesor2@kipu.demo', 'Jorge Huamán', 'teacher', 'IE2034'],
  ['profesor3@kipu.demo', 'Rosa Ccama', 'teacher', 'IE2034'],
  ['profesor4@kipu.demo', 'Luis Mamani', 'teacher', 'IE0087'],
  ['director@kipu.demo', 'Carlos Paredes', 'director', 'IE2034'],
  ['director2@kipu.demo', 'Ana Torres', 'director', 'IE0087'],
  ['ugel@kipu.demo', 'Especialista UGEL 03', 'ugel', null],
]

// limpiar datos (orden FK)
for (const t of ['audit_logs','alerts','grade_records','evaluations','artifact_versions','artifacts','class_schedules','student_groups','subjects','profiles','institutions'])
  await db.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')

const { data: inst } = await db.from('institutions').insert([
  { code: 'IE2034', name: 'I.E. 2034 Virgen de Fátima' },
  { code: 'IE0087', name: 'I.E. 0087 José María Arguedas' },
]).select()
const instId = Object.fromEntries(inst.map(i => [i.code, i.id]))

const ids = {}
for (const [email, full_name, role, ie] of users) {
  const id = await ensureAuthUser(email, PASS)
  ids[email] = id
  await db.from('profiles').insert({ id, full_name, role, institution_id: ie ? instId[ie] : null })
}

const { data: subs } = await db.from('subjects').insert([
  { institution_id: instId.IE2034, name: 'Comunicación' },
  { institution_id: instId.IE2034, name: 'Matemática' },
  { institution_id: instId.IE0087, name: 'Ciencia y Tecnología' },
]).select()
const { data: grps } = await db.from('student_groups').insert([
  { institution_id: instId.IE2034, grade: '3° Secundaria', name: '3A' },
  { institution_id: instId.IE2034, grade: '3° Secundaria', name: '3B' },
  { institution_id: instId.IE0087, grade: '2° Secundaria', name: '2A' },
]).select()

// horario de hoy que cubre todo el día (demo de subida dentro de ventana)
const today = new Date().getDay()
await db.from('class_schedules').insert([
  { teacher_id: ids['profesor@kipu.demo'], subject_id: subs[0].id, group_id: grps[0].id, weekday: today, start_time: '00:30', end_time: '23:59' },
  { teacher_id: ids['profesor2@kipu.demo'], subject_id: subs[1].id, group_id: grps[1].id, weekday: today, start_time: '08:00', end_time: '09:30' },
])

// historial: 3 profesores con 3 unidades consecutivas NEEDS_REVISION (mismo criterio)
const mkEval = (score, decision) => ({
  model_name: 'gemini-2.5-flash', decision, overall_score: score, confidence: 0.9,
  summary: decision === 'APPROVED' ? 'La unidad cumple los criterios pedagógicos.' : 'La unidad no evidencia una estrategia de retroalimentación formativa.',
  strengths: ['Competencia identificada', 'Secuencia coherente'],
  improvements: decision === 'APPROVED' ? [] : ['Incluir estrategia explícita de retroalimentación'],
  criteria: [{ criterionCode: 'FORMATIVE_FEEDBACK', criterionName: 'Retroalimentación formativa', score: decision === 'APPROVED' ? 18 : 6, maxScore: 20, status: decision === 'APPROVED' ? 'PASS' : 'FAIL', confidence: 0.9, evidence: [], feedback: decision === 'APPROVED' ? 'Estrategia clara.' : 'No se identifica estrategia de retroalimentación.' }],
  critical_flags: decision === 'APPROVED' ? [] : ['MISSING_FORMATIVE_FEEDBACK'],
})
for (const email of ['profesor@kipu.demo', 'profesor2@kipu.demo', 'profesor3@kipu.demo']) {
  for (let i = 0; i < 3; i++) {
    const { data: [a] } = await db.from('artifacts').insert({
      teacher_id: ids[email], institution_id: instId.IE2034, subject_id: subs[0].id, group_id: grps[0].id,
      type: 'MONTHLY_UNIT', status: 'NEEDS_REVISION',
      created_at: new Date(Date.now() - (90 - i * 30) * 864e5).toISOString(),
    }).select()
    const { data: [v] } = await db.from('artifact_versions').insert({
      artifact_id: a.id, version: 1, original_filename: `unidad-${i + 1}.pdf`, storage_path: 'seed/none', sha256: 'seed', status: 'NEEDS_REVISION',
    }).select()
    await db.from('evaluations').insert({ artifact_version_id: v.id, ...mkEval(58 + i * 3, 'NEEDS_REVISION') })
  }
}
// y una entrega aprobada del profesor 4 en la otra IE
const { data: [aOk] } = await db.from('artifacts').insert({ teacher_id: ids['profesor4@kipu.demo'], institution_id: instId.IE0087, subject_id: subs[2].id, group_id: grps[2].id, type: 'MONTHLY_UNIT', status: 'APPROVED' }).select()
const { data: [vOk] } = await db.from('artifact_versions').insert({ artifact_id: aOk.id, version: 1, original_filename: 'unidad-marzo.pdf', storage_path: 'seed/none', sha256: 'seed', status: 'APPROVED' }).select()
await db.from('evaluations').insert({ artifact_version_id: vOk.id, ...mkEval(88, 'APPROVED') })

// notas: grupo 3B con notas bajas 2 periodos
const grades = []
for (const period of ['2026-B1', '2026-B2'])
  for (let s = 1; s <= 20; s++) {
    grades.push({ group_id: grps[1].id, period, student_code: `E${s}`, score: s <= 11 ? 7 + (s % 4) : 13 + (s % 5) })
    grades.push({ group_id: grps[0].id, period, student_code: `E${s}`, score: 12 + (s % 7) })
  }
await db.from('grade_records').insert(grades)

await db.from('alerts').insert([
  {
    type: 'REPEATED_INVALID_UNITS', severity: 'HIGH', institution_id: instId.IE2034,
    title: 'Incumplimiento recurrente en retroalimentación formativa',
    summary: 'Tres docentes de la I.E. 2034 acumulan tres unidades consecutivas observadas por ausencia de estrategias de retroalimentación.',
    suggested_action: 'Evaluar acompañamiento pedagógico focalizado y reforzar la capacitación de evaluación formativa.',
    evidence: { invalidSubmissionCount: 9, criterionCode: 'FORMATIVE_FEEDBACK', teachers: 3, periods: ['2026-B1', '2026-B2'] },
  },
  {
    type: 'LOW_GRADE_GROUP', severity: 'MEDIUM', institution_id: instId.IE2034,
    title: 'Grupo 3B con calificaciones bajo el umbral',
    summary: 'El 55% de estudiantes de 3B está por debajo de 11 durante dos bimestres consecutivos.',
    suggested_action: 'Revisar la planificación de Matemática en 3B y evaluar refuerzo escolar.',
    evidence: { group: '3B', affectedPercentage: 0.55, periods: ['2026-B1', '2026-B2'], avgScore: 9.4 },
  },
])

// bucket privado
await db.storage.createBucket('evidence', { public: false }).catch(() => {})
console.log('seed ok:', Object.keys(ids).length, 'usuarios | password demo:', PASS)
