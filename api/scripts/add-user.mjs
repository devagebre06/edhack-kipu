// Alta rápida de usuarios demo.
// Uso: node --env-file=.env scripts/add-user.mjs   (o: npm run db:add-user)
import { db, DEMO_PASS as PASS, ensureAuthUser } from './lib/client.mjs'

const { data: inst } = await db.from('institutions').select('*').eq('code', 'IE2034').single()
const nuevos = [
  ['javier.profesor@kipu.demo', 'Javier Olivares (Profesor)', 'teacher', inst.id],
  ['javier.director@kipu.demo', 'Javier Olivares (Director)', 'director', inst.id],
  ['javier.ugel@kipu.demo', 'Javier Olivares (UGEL)', 'ugel', null],
]
for (const [email, full_name, role, institution_id] of nuevos) {
  const id = await ensureAuthUser(email, PASS)
  await db.from('profiles').upsert({ id, full_name, role, institution_id })
  if (role === 'teacher') {
    const { data: subj } = await db.from('subjects').select('id').eq('institution_id', inst.id).limit(1).single()
    const { data: grp } = await db.from('student_groups').select('id').eq('institution_id', inst.id).limit(1).single()
    await db.from('class_schedules').upsert({ teacher_id: id, subject_id: subj.id, group_id: grp.id, weekday: new Date().getDay(), start_time: '00:30', end_time: '23:59' }, { onConflict: 'id', ignoreDuplicates: false }).select()
  }
  console.log('ok', email, role)
}
