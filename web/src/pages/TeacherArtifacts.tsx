import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase, apiUpload, STATUS_LABEL, TYPE_LABEL } from '../lib'
import { useProfile } from '../App'
import { Badge, Spinner, Table } from '../ui'
import { EvaluationView, type Evaluation } from './EvaluationView'

type Version = { id: string; version: number; status: string; created_at: string; original_filename: string; evaluations: Evaluation[] }
type Artifact = { id: string; type: string; status: string; current_version: number; created_at: string; artifact_versions: Version[] }

const STATUS_FILTERS = ['', 'APPROVED', 'NEEDS_REVISION', 'MANUAL_REVIEW', 'PROCESSING', 'PROCESSING_ERROR']

export default function TeacherArtifacts() {
  const profile = useProfile()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [resubmitFor, setResubmitFor] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data: artifacts, isLoading } = useQuery({
    queryKey: ['artifacts'],
    queryFn: async () => (await supabase
      .from('artifacts')
      .select('*, artifact_versions(*, evaluations(*))')
      .eq('teacher_id', profile.id)
      .order('created_at', { ascending: false })
    ).data as Artifact[] || [],
  })

  const list = artifacts || []
  const filtered = statusFilter ? list.filter(a => a.status === statusFilter) : list
  const approved = list.filter(a => a.status === 'APPROVED').length
  const revision = list.filter(a => a.status === 'NEEDS_REVISION').length

  const resubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !resubmitFor) return
    setBusy(true); setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      await apiUpload(`/api/v1/artifacts/${resubmitFor}/versions`, form)
      qc.invalidateQueries({ queryKey: ['artifacts'] })
      qc.invalidateQueries({ queryKey: ['artifacts-types'] })
      setFile(null); setResubmitFor(null)
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mis entregas</h1>
          <p className="mt-1 text-sm text-ink-soft">Historial de documentos enviados y su retroalimentación.</p>
        </div>
        <button onClick={() => navigate('/profesor/subir')}
          className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep">
          + Nueva entrega
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <div className="text-sm text-ink-soft">Total</div>
          <div className="text-2xl font-semibold">{list.length}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <div className="text-sm text-ink-soft">Aprobadas</div>
          <div className="text-2xl font-semibold text-ok">{approved}</div>
        </div>
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <div className="text-sm text-ink-soft">Por corregir</div>
          <div className={`text-2xl font-semibold ${revision ? 'text-warn' : ''}`}>{revision}</div>
        </div>
      </div>

      {/* Panel de reenvío */}
      {resubmitFor && (
        <form onSubmit={resubmit} className="mt-5 rounded-lg border border-warn/30 bg-warn-bg p-4 space-y-3">
          <p className="text-sm font-medium">Subiendo corrección para la entrega seleccionada. La versión anterior se conserva.</p>
          <div className="flex items-center gap-3">
            <input type="file" required accept=".pdf,.pptx,.xlsx" onChange={e => setFile(e.target.files?.[0] || null)}
              className="flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-warn file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white" />
            <button disabled={busy || !file} className="rounded-md bg-warn px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60">
              {busy ? 'Enviando…' : 'Enviar corrección'}
            </button>
            <button type="button" onClick={() => setResubmitFor(null)} className="text-sm text-ink-soft hover:text-ink">Cancelar</button>
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          {busy && <Spinner text="Procesando corrección…" />}
        </form>
      )}

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Historial</h2>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm">
            <option value="">Todos</option>
            {STATUS_FILTERS.filter(Boolean).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>

        {isLoading ? <Spinner text="Cargando entregas…" /> : (
          <div className="space-y-2">
            {!filtered.length && (
              <p className="rounded-lg border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-soft">
                {statusFilter ? 'No hay entregas con ese estado.' : 'Aún no registras evidencias.'}
              </p>
            )}
            {filtered.map(a => {
              const versions = [...a.artifact_versions].sort((x, y) => y.version - x.version)
              const current = versions[0]
              const ev = current?.evaluations?.[0] as Evaluation | undefined
              const prevEv = versions[1]?.evaluations?.[0] as Evaluation | undefined
              const open = openId === a.id
              return (
                <div key={a.id} className="rounded-lg border border-line bg-surface">
                  <button onClick={() => setOpenId(open ? null : a.id)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-bg transition-colors">
                    <div className="min-w-0">
                      <span className="font-medium">{TYPE_LABEL[a.type]}</span>
                      <span className="ml-2 text-sm text-ink-soft truncate">
                        {current?.original_filename} · v{a.current_version} · {new Date(a.created_at).toLocaleDateString('es-PE')}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge value={a.status} label={STATUS_LABEL[a.status]} />
                      <span className="text-ink-soft text-xs">{open ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-line px-5 py-4">
                      {ev ? <EvaluationView ev={ev} prev={prevEv} /> : (
                        <p className="text-sm text-ink-soft">Sin evaluación disponible.</p>
                      )}
                      {a.status === 'NEEDS_REVISION' && !resubmitFor && (
                        <button onClick={() => { setResubmitFor(a.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                          className="mt-4 rounded-md bg-warn px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                          Subir corrección
                        </button>
                      )}
                      {versions.length > 1 && (
                        <div className="mt-5">
                          <h4 className="mb-2 text-sm font-semibold">Historial de versiones</h4>
                          <Table
                            head={['Versión', 'Archivo', 'Fecha', 'Puntaje', 'Estado']}
                            empty=""
                            rows={versions.map(v => [
                              `v${v.version}`,
                              v.original_filename,
                              new Date(v.created_at).toLocaleString('es-PE'),
                              (v.evaluations?.[0] as any)?.overall_score ?? '—',
                              <Badge value={v.status} label={STATUS_LABEL[v.status]} />,
                            ])}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
