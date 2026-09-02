// Gestión de horarios para el panel del director. En el modelo unificado el
// horario cuelga de un DICTADO (aula + curso + profesor + periodo). El director
// ve los profesores de su colegio con sus dictados y horarios, y puede crear
// horarios (creando el dictado si aún no existe). Escribe con service-role; el
// control de acceso (rol director acotado a su colegio) lo hace el controlador.
import { db } from '../infra/supabase.ts'

let profesorRolId: string | null = null
async function rolProfesor() {
  if (!profesorRolId) {
    const { data } = await db.from('roles').select('id').eq('key', 'profesor').single()
    profesorRolId = data?.id ?? null
  }
  return profesorRolId
}

async function profesorDeColegio(colegioId: string, profesorId: string) {
  const { data } = await db.from('usuarios').select('id').eq('id', profesorId).eq('colegio_id', colegioId).eq('rol_id', await rolProfesor()).maybeSingle()
  return !!data
}
async function aulaDeColegio(colegioId: string, aulaId: string) {
  const { data } = await db.from('aulas').select('id').eq('id', aulaId).eq('colegio_id', colegioId).maybeSingle()
  return !!data
}

// ── Panel: profesores del colegio + sus dictados/horarios + catálogos ─────────
export async function getHorariosPanel(colegioId: string) {
  const [{ data: teachers }, { data: cursos }, { data: aulas }, { data: periodos }] = await Promise.all([
    db.from('usuarios').select('id, nombre_completo, datos_personales(dni)').eq('colegio_id', colegioId).eq('rol_id', await rolProfesor()).order('nombre_completo'),
    db.from('cursos').select('id, nombre').order('nombre'),
    db.from('aulas').select('id, seccion, grado, turno, nombre').eq('colegio_id', colegioId).order('codigo'),
    db.from('periodos_academicos').select('id, nombre').order('anio'),
  ])

  const teacherIds = (teachers ?? []).map((t: any) => t.id)
  const { data: dictados } = teacherIds.length
    ? await db.from('dictados')
        .select('id, profesor_id, cursos(id, nombre), aulas(id, seccion, grado, nombre), periodos_academicos(id, nombre), horarios(id, dia_semana, hora_inicio, hora_fin)')
        .in('profesor_id', teacherIds)
    : { data: [] as any[] }

  const byTeacher = new Map<string, any[]>()
  for (const d of dictados ?? []) {
    const list = byTeacher.get(d.profesor_id) ?? []
    list.push({
      id: d.id, curso: d.cursos, aula: d.aulas, periodo: d.periodos_academicos,
      horarios: (d.horarios ?? []).sort((a: any, b: any) => a.dia_semana - b.dia_semana || String(a.hora_inicio).localeCompare(String(b.hora_inicio))),
    })
    byTeacher.set(d.profesor_id, list)
  }

  return {
    teachers: (teachers ?? []).map((t: any) => ({
      id: t.id, full_name: t.nombre_completo, dni: t.datos_personales?.dni ?? null, dictados: byTeacher.get(t.id) ?? [],
    })),
    cursos: cursos ?? [],
    aulas: aulas ?? [],
    periodos: periodos ?? [],
  }
}

// Crea (o reutiliza) el dictado aula+curso+profesor+periodo.
async function ensureDictado(aula_id: string, curso_id: string, profesor_id: string, periodo_id: string) {
  const { data: found } = await db.from('dictados').select('id').eq('aula_id', aula_id).eq('curso_id', curso_id).eq('periodo_id', periodo_id).maybeSingle()
  if (found) return { id: found.id as string }
  const { data, error } = await db.from('dictados').insert({ aula_id, curso_id, profesor_id, periodo_id }).select('id').single()
  if (error) return { error: error.message }
  return { id: data.id as string }
}

// ── Crear un horario (creando el dictado si hace falta) ───────────────────────
export async function createHorario(colegioId: string, body: any) {
  const { profesor_id, curso_id, aula_id, periodo_id, dia_semana, hora_inicio, hora_fin } = body ?? {}
  if (!profesor_id || !curso_id || !aula_id || !periodo_id || dia_semana == null || !hora_inicio || !hora_fin)
    return { error: 'Faltan campos: profesor_id, curso_id, aula_id, periodo_id, dia_semana, hora_inicio, hora_fin.' }
  if (!Number.isInteger(dia_semana) || dia_semana < 0 || dia_semana > 6)
    return { error: 'dia_semana debe ser un entero 0..6 (0=domingo).' }
  if (!/^\d{2}:\d{2}$/.test(hora_inicio) || !/^\d{2}:\d{2}$/.test(hora_fin))
    return { error: 'hora_inicio y hora_fin deben tener formato HH:MM.' }
  if (hora_inicio >= hora_fin) return { error: 'La hora de inicio debe ser anterior a la de fin.' }
  if (!(await profesorDeColegio(colegioId, profesor_id))) return { error: 'El profesor no pertenece a tu colegio.' }
  if (!(await aulaDeColegio(colegioId, aula_id))) return { error: 'El aula no pertenece a tu colegio.' }

  const dic = await ensureDictado(aula_id, curso_id, profesor_id, periodo_id)
  if ('error' in dic) return { error: dic.error }
  const { data, error } = await db.from('horarios')
    .insert({ dictado_id: dic.id, dia_semana, hora_inicio, hora_fin })
    .select('id, dia_semana, hora_inicio, hora_fin, dictados(id, cursos(id, nombre), aulas(id, seccion, grado))')
    .single()
  if (error) return { error: error.message }
  return { data }
}

// ── Eliminar un horario (validando que su dictado sea de un aula del colegio) ──
export async function deleteHorario(colegioId: string, id: string) {
  const { data: h } = await db.from('horarios').select('id, dictados(aula_id)').eq('id', id).maybeSingle() as any
  if (!h) return { error: 'Horario no encontrado.' }
  if (!(await aulaDeColegio(colegioId, h.dictados?.aula_id))) return { error: 'El horario no pertenece a tu colegio.' }
  const { error } = await db.from('horarios').delete().eq('id', id)
  if (error) return { error: error.message }
  return { data: { id } }
}
