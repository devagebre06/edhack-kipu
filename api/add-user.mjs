// ponytail: alta rápida de usuarios demo; uso: node add-user.mjs
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
const db = createClient('https://yoylrbqqxumdgvgdtviw.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })

const PASS = 'KipuDemo2026!'
const { data: inst } = await db.from('institutions').select('*').eq('code', 'IE2034').single()
const nuevos = [
  ['javier.profesor@kipu.demo', 'Javier Olivares (Profesor)', 'teacher', inst.id],
  ['javier.director@kipu.demo', 'Javier Olivares (Director)', 'director', inst.id],
  ['javier.ugel@kipu.demo', 'Javier Olivares (UGEL)', 'ugel', null],
]
for (const [email, full_name, role, institution_id] of nuevos) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
  let u = list.users.find(x => x.email === email)
  if (!u) ({ data: { user: u } } = await db.auth.admin.createUser({ email, password: PASS, email_confirm: true }))
  await db.from('profiles').upsert({ id: u.id, full_name, role, institution_id })
  if (role === 'teacher') {
    const { data: subj } = await db.from('subjects').select('id').eq('institution_id', inst.id).limit(1).single()
    const { data: grp } = await db.from('student_groups').select('id').eq('institution_id', inst.id).limit(1).single()
    await db.from('class_schedules').upsert({ teacher_id: u.id, subject_id: subj.id, group_id: grp.id, weekday: new Date().getDay(), start_time: '00:30', end_time: '23:59' }, { onConflict: 'id', ignoreDuplicates: false }).select()
  }
  console.log('ok', email, role)
}
