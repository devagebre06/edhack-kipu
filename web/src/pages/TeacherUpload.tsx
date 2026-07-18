import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase, apiUpload, TYPE_LABEL } from '../lib'
import { useProfile } from '../App'
import { Spinner } from '../ui'

const SUBJECTS_ALLOWED = ['Matemática', 'Comunicación']
const GRADE_ALLOWED = '4to'

export default function TeacherUpload() {
  const profile = useProfile()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [scheduleId, setScheduleId] = useState('')
  const [type, setType] = useState('DAILY_SESSION')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ score: number; decision: string } | null>(null)

  const { data: schedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => (await supabase
      .from('class_schedules')
      .select('*, subjects(name), student_groups(name, grade)')
      .eq('teacher_id', profile.id)
    ).data || [],
  })

  // Filtrar solo Matemática y Comunicación para 4to primaria
  const allowed = (schedules || []).filter(s =>
    SUBJECTS_ALLOWED.includes(s.subjects?.name || '') &&
    (s.student_groups?.grade || '').includes(GRADE_ALLOWED)
  )
  const today = new Date().getDay()
  const todaySchedules = allowed.filter(s => s.weekday === today)
  const displaySchedules = type === 'DAILY_SESSION' ? todaySchedules : allowed

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    const sched = displaySchedules.find(s => s.id === scheduleId)
    if (!sched) { setError('Selecciona tu clase.'); return }
    setBusy(true); setError(''); setDone(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', type)
      form.append('subject_id', sched.subject_id)
      form.append('group_id', sched.group_id)
      const result = await apiUpload('/api/v1/artifacts', form)
      qc.invalidateQueries({ queryKey: ['artifacts'] })
      qc.invalidateQueries({ queryKey: ['artifacts-types'] })
      setFile(null); setScheduleId('')
      setDone({ score: result.evaluation?.overall_score ?? 0, decision: result.status })
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Nueva entrega</h1>
      <p className="mt-1 text-sm text-ink-soft">Sube tu documento de planificación para recibir retroalimentación inmediata.</p>

      {done && (
        <div className="mt-4 rounded-lg border border-ok/30 bg-ok-bg p-4">
          <p className="font-medium text-ok">Entrega procesada — puntaje {done.score}/100</p>
          <div className="mt-2 flex gap-3">
            <button onClick={() => { setDone(null) }} className="text-sm underline text-ok hover:opacity-80">Subir otra</button>
            <button onClick={() => navigate('/profesor/entregas')} className="text-sm underline text-ok hover:opacity-80">Ver mis entregas</button>
          </div>
        </div>
      )}

      {!done && (
        <form onSubmit={submit} className="mt-6 rounded-lg border border-line bg-surface p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Tipo de evidencia</span>
              <select value={type} onChange={e => { setType(e.target.value); setScheduleId('') }}
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2">
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Clase</span>
              <select required value={scheduleId} onChange={e => setScheduleId(e.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2">
                <option value="">Selecciona…</option>
                {displaySchedules.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.subjects.name} · {s.student_groups.grade} {s.student_groups.name}
                    {type === 'DAILY_SESSION' && ` (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})`}
                  </option>
                ))}
              </select>
              {type === 'DAILY_SESSION' && !todaySchedules.length && (
                <p className="mt-1 text-xs text-warn">No tienes clases programadas hoy.</p>
              )}
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium">Archivo <span className="text-ink-soft font-normal">(PDF, PPTX o XLSX, máx. 15 MB)</span></span>
            <input type="file" required accept=".pdf,.pptx,.xlsx" onChange={e => setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-brand-deep" />
          </label>

          {type === 'DAILY_SESSION' && (
            <p className="text-xs text-ink-soft">Las sesiones solo pueden subirse desde 30 min antes del inicio de tu clase hasta su término.</p>
          )}

          {error && <p className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad" role="alert">{error}</p>}

          <button disabled={busy || !file}
            className="w-full rounded-md bg-brand px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-60">
            {busy ? 'Procesando…' : 'Enviar evidencia'}
          </button>

          {busy && <Spinner text="Convirtiendo el documento y evaluando con los criterios pedagógicos. Esto toma menos de un minuto." />}
        </form>
      )}

      <div className="mt-6 rounded-lg border border-line bg-surface p-4 text-sm">
        <h3 className="font-semibold">¿Qué subir y cuándo?</h3>
        <ul className="mt-2 space-y-1 text-ink-soft">
          <li><span className="font-medium text-ink">Sesión de clase</span> — el mismo día de la clase, dentro de la ventana horaria.</li>
          <li><span className="font-medium text-ink">Unidad de aprendizaje</span> — al inicio de cada mes escolar.</li>
          <li><span className="font-medium text-ink">Registro de notas</span> — al cierre de cada bimestre.</li>
          <li><span className="font-medium text-ink">Balance anual</span> — en diciembre al cierre del año.</li>
        </ul>
        <button onClick={() => navigate('/profesor/calendario')} className="mt-3 text-brand underline text-sm hover:opacity-80">
          Ver calendario completo →
        </button>
      </div>
    </div>
  )
}
