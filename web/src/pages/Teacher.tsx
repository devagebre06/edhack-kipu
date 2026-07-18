import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, apiUpload, STATUS_LABEL, TYPE_LABEL } from '../lib'
import { useProfile } from '../App'
import { Badge, Section, Table, Spinner, Stat } from '../ui'

type Criterion = { criterionCode: string; criterionName: string; score: number; maxScore: number; status: string; feedback: string; evidence: { quote: string; location: string }[] }
type Evaluation = { overall_score: number; decision: string; summary: string; strengths: string[]; improvements: string[]; criteria: Criterion[] }
type Version = { id: string; version: number; status: string; created_at: string; original_filename: string; evaluations: Evaluation[] }
type Artifact = { id: string; type: string; status: string; current_version: number; created_at: string; artifact_versions: Version[] }

function EvaluationView({ ev, prev }: { ev: Evaluation; prev?: Evaluation }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="text-4xl font-semibold">{ev.overall_score}<span className="text-lg text-ink-soft">/100</span></div>
        <Badge value={ev.decision} label={STATUS_LABEL[ev.decision]} />
        {prev && <span className={`text-sm font-medium ${ev.overall_score >= prev.overall_score ? 'text-ok' : 'text-warn'}`}>
          {ev.overall_score >= prev.overall_score ? '▲' : '▼'} {Math.abs(ev.overall_score - prev.overall_score)} pts frente a la versión anterior
        </span>}
      </div>
      <p className="max-w-[70ch] text-sm">{ev.summary}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-ok">Fortalezas</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{ev.strengths.map(s => <li key={s}>{s}</li>)}</ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-warn">Para mejorar</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {ev.improvements.length ? ev.improvements.map(s => <li key={s}>{s}</li>) : <li className="text-ink-soft">Nada pendiente. Buen trabajo.</li>}
          </ul>
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold">Resultado por criterio</h4>
        <div className="space-y-2">
          {ev.criteria.map(c => (
            <details key={c.criterionCode} className="rounded-md border border-line bg-bg px-4 py-2.5 open:bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
                <span className="font-medium">{c.criterionName}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-ink-soft">{c.score}/{c.maxScore}</span>
                  <Badge value={c.status === 'PASS' ? 'APPROVED' : c.status === 'FAIL' ? 'NEEDS_REVISION' : 'PROCESSING'} label={c.status === 'PASS' ? 'Logrado' : c.status === 'FAIL' ? 'No logrado' : 'Parcial'} />
                </span>
              </summary>
              <p className="mt-2 max-w-[70ch] text-sm text-ink-soft">{c.feedback}</p>
              {c.evidence.map((e, i) => <blockquote key={i} className="mt-2 border-l border-line pl-3 text-sm italic text-ink-soft">“{e.quote}” <span className="not-italic">— {e.location}</span></blockquote>)}
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Teacher() {
  const profile = useProfile()
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [scheduleId, setScheduleId] = useState('')
  const [type, setType] = useState('DAILY_SESSION')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resubmitFor, setResubmitFor] = useState<string | null>(null)
  const [openArtifact, setOpenArtifact] = useState<string | null>(null)

  const { data: schedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => (await supabase.from('class_schedules').select('*, subjects(name), student_groups(name, grade)').eq('teacher_id', profile.id)).data || [],
  })
  const { data: artifacts, isLoading } = useQuery({
    queryKey: ['artifacts'],
    queryFn: async () => (await supabase.from('artifacts').select('*, artifact_versions(*, evaluations(*))').eq('teacher_id', profile.id).order('created_at', { ascending: false })).data as Artifact[] || [],
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    const sched = schedules?.find(s => s.id === scheduleId)
    if (!resubmitFor && !sched) { setError('Selecciona tu clase.'); return }
    setBusy(true); setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      let result
      if (resubmitFor) {
        result = await apiUpload(`/api/v1/artifacts/${resubmitFor}/versions`, form)
      } else {
        form.append('type', type)
        form.append('subject_id', sched!.subject_id)
        form.append('group_id', sched!.group_id)
        result = await apiUpload('/api/v1/artifacts', form)
      }
      setOpenArtifact(result.artifact_id)
      setFile(null); setResubmitFor(null)
      qc.invalidateQueries({ queryKey: ['artifacts'] })
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  const today = new Date().getDay()
  const todaySchedules = schedules?.filter(s => s.weekday === today) || []
  const list = artifacts || []
  const approved = list.filter(a => a.status === 'APPROVED').length

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">Hola, {profile.full_name.split(' ')[0]}</h1>
      <p className="mt-1 text-sm text-ink-soft">Registra tus evidencias y recibe retroalimentación inmediata para mejorarlas.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Entregas" value={list.length} />
        <Stat label="Aprobadas" value={approved} tone="ok" />
        <Stat label="Por corregir" value={list.filter(a => a.status === 'NEEDS_REVISION').length} tone={list.some(a => a.status === 'NEEDS_REVISION') ? 'warn' : undefined} />
      </div>

      <Section title={resubmitFor ? 'Subir nueva versión' : 'Nueva entrega'}>
        <form onSubmit={submit} className="rounded-lg border border-line bg-surface p-5">
          {!resubmitFor && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">Tipo de evidencia</span>
                <select value={type} onChange={e => setType(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2">
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Clase</span>
                <select required value={scheduleId} onChange={e => setScheduleId(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2">
                  <option value="">Selecciona…</option>
                  {(type === 'DAILY_SESSION' ? todaySchedules : schedules || []).map(s => (
                    <option key={s.id} value={s.id}>{s.subjects.name} · {s.student_groups.grade} {s.student_groups.name} ({s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)})</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {resubmitFor && <p className="text-sm text-ink-soft">Corrige lo observado y sube la versión mejorada. La versión anterior se conserva en el historial. <button type="button" className="text-brand underline" onClick={() => setResubmitFor(null)}>Cancelar</button></p>}
          <label className="mt-4 block text-sm">
            <span className="font-medium">Archivo (PDF, PPTX o XLSX, máx. 15 MB)</span>
            <input type="file" required accept=".pdf,.pptx,.xlsx" onChange={e => setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-brand-deep" />
          </label>
          {type === 'DAILY_SESSION' && !resubmitFor && <p className="mt-2 text-xs text-ink-soft">Las sesiones de clase solo pueden subirse desde 30 minutos antes del inicio de tu clase hasta su término.</p>}
          {error && <p className="mt-3 rounded-md bg-bad-bg px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
          <button disabled={busy || !file} className="mt-4 rounded-md bg-brand px-5 py-2 font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-60">
            {busy ? 'Procesando…' : 'Enviar evidencia'}
          </button>
          {busy && <div className="mt-3"><Spinner text="Convirtiendo el documento y evaluando con los criterios pedagógicos. Esto toma menos de un minuto." /></div>}
        </form>
      </Section>

      <Section title="Mis entregas">
        {isLoading ? <Spinner text="Cargando entregas…" /> : (
          <div className="space-y-3">
            {!list.length && <p className="rounded-lg border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-soft">Aún no registras evidencias. Sube tu primera con el formulario de arriba.</p>}
            {list.map(a => {
              const versions = [...a.artifact_versions].sort((x, y) => y.version - x.version)
              const current = versions[0]
              const ev = current?.evaluations?.[0]
              const prevEv = versions[1]?.evaluations?.[0]
              const open = openArtifact === a.id
              return (
                <div key={a.id} className="rounded-lg border border-line bg-surface">
                  <button onClick={() => setOpenArtifact(open ? null : a.id)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
                    <span>
                      <span className="font-medium">{TYPE_LABEL[a.type]}</span>
                      <span className="ml-2 text-sm text-ink-soft">{current?.original_filename} · v{a.current_version} · {new Date(a.created_at).toLocaleDateString('es-PE')}</span>
                    </span>
                    <Badge value={a.status} label={STATUS_LABEL[a.status]} />
                  </button>
                  {open && (
                    <div className="border-t border-line px-5 py-4">
                      {ev ? <EvaluationView ev={ev} prev={prevEv} /> : <p className="text-sm text-ink-soft">Sin evaluación disponible.</p>}
                      {a.status === 'NEEDS_REVISION' && (
                        <button onClick={() => { setResubmitFor(a.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                          className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep">Subir corrección</button>
                      )}
                      {versions.length > 1 && (
                        <div className="mt-5">
                          <h4 className="mb-2 text-sm font-semibold">Historial de versiones</h4>
                          <Table head={['Versión', 'Archivo', 'Fecha', 'Puntaje', 'Estado']} empty=""
                            rows={versions.map(v => [`v${v.version}`, v.original_filename, new Date(v.created_at).toLocaleString('es-PE'), v.evaluations?.[0]?.overall_score ?? '—', <Badge value={v.status} label={STATUS_LABEL[v.status]} />])} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}
