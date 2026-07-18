import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TYPE_LABEL } from '@/config/labels'
import { useProfile, useAllowedSchedules, useTeacherUnits, useSubmitArtifact } from '@/hooks'
import { Spinner } from '@/components'

export default function TeacherUpload() {
  const profile = useProfile()
  const navigate = useNavigate()
  const { allowed } = useAllowedSchedules(profile.id)
  const { data: units } = useTeacherUnits(profile.id)
  const submitArtifact = useSubmitArtifact()

  const [file, setFile] = useState<File | null>(null)
  const [scheduleId, setScheduleId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [type, setType] = useState('DAILY_SESSION')
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ score: number } | null>(null)

  const isSession = type === 'DAILY_SESSION'
  const today = new Date().getDay()
  const todaySchedules = allowed.filter(s => s.weekday === today)
  const displaySchedules = isSession ? todaySchedules : allowed
  const busy = submitArtifact.isPending

  // Regla: una sesión se registra dentro de una unidad ya subida del mismo
  // curso. Sin unidad válida para ese curso, no se habilita la subida.
  const sched = displaySchedules.find(s => s.id === scheduleId)
  const availableUnits = (units ?? []).filter(u =>
    u.subject_id === sched?.subject_id && u.status !== 'PROCESSING_ERROR')
  const needsUnit = isSession
  const unitBlocked = needsUnit && !!sched && availableUnits.length === 0
  const canSubmit = !!file && !!sched && (!needsUnit || !!unitId)

  const changeType = (value: string) => {
    setType(value); setScheduleId(''); setUnitId(''); setError('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    if (!sched) { setError('Selecciona tu clase.'); return }
    if (needsUnit && !unitId) { setError('Selecciona la unidad de aprendizaje a la que corresponde la sesión.'); return }
    setError(''); setDone(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', type)
      form.append('subject_id', sched.subject_id)
      form.append('group_id', sched.group_id)
      if (needsUnit) form.append('unit_id', unitId)
      const result = await submitArtifact.mutateAsync({ form })
      setFile(null); setScheduleId(''); setUnitId('')
      setDone({ score: result.evaluation?.overall_score ?? 0 })
    } catch (err: any) { setError(err.message) }
  }

  const unitLabel = (u: typeof availableUnits[number]) => {
    const date = new Date(u.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
    const rev = u.status === 'NEEDS_REVISION' ? ' · por corregir' : ''
    return `${u.subjects?.name ?? 'Unidad'} · subida ${date}${rev}`
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Nueva entrega</h1>
      <p className="mt-1 text-sm text-ink-soft">Sube tu documento de planificación para recibir retroalimentación inmediata.</p>

      {done && (
        <div className="mt-4 rounded-lg border border-ok/30 bg-ok-bg p-4">
          <p className="font-medium text-ok">Entrega procesada — puntaje {done.score}/100</p>
          <div className="mt-2 flex gap-3">
            <button onClick={() => setDone(null)} className="text-sm underline text-ok hover:opacity-80">Subir otra</button>
            <button onClick={() => navigate('/profesor/entregas')} className="text-sm underline text-ok hover:opacity-80">Ver mis entregas</button>
          </div>
        </div>
      )}

      {!done && (
        <form onSubmit={submit} className="mt-6 rounded-lg border border-line bg-surface p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Tipo de evidencia</span>
              <select value={type} onChange={e => changeType(e.target.value)}
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

          {needsUnit && (
            sched && unitBlocked ? (
              <div className="rounded-md border border-warn/40 bg-warn-bg p-3 text-sm">
                <p className="font-medium text-warn">Falta la unidad de aprendizaje</p>
                <p className="mt-1 text-ink-soft">
                  Antes de registrar una sesión de <span className="font-medium">{sched.subjects.name}</span> debes subir su
                  Unidad de aprendizaje. Cambia el tipo a «Unidad de aprendizaje» y súbela primero.
                </p>
              </div>
            ) : (
              <label className="block text-sm">
                <span className="font-medium">Unidad de aprendizaje</span>
                <select required value={unitId} onChange={e => setUnitId(e.target.value)} disabled={!sched}
                  className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 disabled:opacity-60">
                  <option value="">{sched ? 'Selecciona la unidad…' : 'Selecciona primero tu clase'}</option>
                  {availableUnits.map(u => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}
                </select>
                <p className="mt-1 text-xs text-ink-soft">La sesión se registra dentro de una unidad ya subida de ese curso.</p>
              </label>
            )
          )}

          <label className="block text-sm">
            <span className="font-medium">Archivo <span className="text-ink-soft font-normal">(PDF, PPTX o XLSX, máx. 15 MB)</span></span>
            <input type="file" required accept=".pdf,.pptx,.xlsx" onChange={e => setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-brand-deep" />
          </label>

          {type === 'DAILY_SESSION' && (
            <p className="text-xs text-ink-soft">Las sesiones solo pueden subirse desde 30 min antes del inicio de tu clase hasta su término.</p>
          )}

          {error && <p className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad" role="alert">{error}</p>}

          <button disabled={busy || !canSubmit}
            className="w-full rounded-md bg-brand px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-60">
            {busy ? 'Procesando…' : 'Enviar evidencia'}
          </button>

          {busy && <Spinner text="Convirtiendo el documento y evaluando con los criterios pedagógicos. Esto toma menos de un minuto." />}
        </form>
      )}

      <div className="mt-6 rounded-lg border border-line bg-surface p-4 text-sm">
        <h3 className="font-semibold">¿Qué subir y cuándo?</h3>
        <ul className="mt-2 space-y-1 text-ink-soft">
          <li><span className="font-medium text-ink">Sesión de clase</span> — el mismo día, dentro de la ventana horaria y ligada a una unidad ya subida del curso.</li>
          <li><span className="font-medium text-ink">Unidad de aprendizaje</span> — al inicio de cada mes escolar. Debe subirse antes que sus sesiones.</li>
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
