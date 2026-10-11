import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STATUS_LABEL, TYPE_LABEL } from '@/config/labels'
import { ARTIFACT_STATUS_FILTERS } from '@/config/constants'
import { useProfile, useTeacherArtifacts, useSubmitArtifact } from '@/hooks'
import { sortedVersions, latestVersion, latestEvaluation, previousEvaluation, countByStatus } from '@/factories'
import { Badge, Spinner, Stat, Table, EvaluationView } from '@/components'
import {
  Button, Alert, AlertDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui'
import { Plus, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'

export default function TeacherArtifacts() {
  const profile = useProfile()
  const navigate = useNavigate()
  const { data: artifacts, isLoading } = useTeacherArtifacts(profile.id)
  const submitArtifact = useSubmitArtifact()

  const [statusFilter, setStatusFilter] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [resubmitFor, setResubmitFor] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  const list = artifacts ?? []
  const filtered = statusFilter ? list.filter(a => a.status === statusFilter) : list
  const { total, approved, revision } = countByStatus(list)
  const busy = submitArtifact.isPending

  const resubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !resubmitFor) return
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      await submitArtifact.mutateAsync({ form, resubmitFor })
      setFile(null); setResubmitFor(null)
    } catch (err: any) { setError(err.message) }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis entregas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Historial de documentos enviados y su retroalimentación.</p>
        </div>
        <Button className="shrink-0" onClick={() => navigate('/profesor/subir')}>
          <Plus /> Nueva entrega
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Total" value={total} />
        <Stat label="Aprobadas" value={approved} tone="ok" />
        <Stat label="Por corregir" value={revision} tone={revision ? 'warn' : undefined} />
      </div>

      {resubmitFor && (
        <form onSubmit={resubmit} className="mt-5 space-y-3 rounded-xl border border-warning/30 bg-warning-muted p-4 shadow-xs">
          <p className="text-sm font-medium">Subiendo corrección para la entrega seleccionada. La versión anterior se conserva.</p>
          <div className="flex items-center gap-3">
            <input type="file" required accept=".pdf,.pptx,.xlsx" onChange={e => setFile(e.target.files?.[0] || null)}
              className="flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-warning file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-warning-foreground" />
            <Button disabled={busy || !file}>{busy ? 'Enviando…' : 'Enviar corrección'}</Button>
            <Button type="button" variant="ghost" onClick={() => setResubmitFor(null)}>Cancelar</Button>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {busy && <Spinner text="Procesando corrección…" />}
        </form>
      )}

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Historial</h2>
          <Select value={statusFilter || 'ALL'} onValueChange={v => setStatusFilter(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="w-auto min-w-40"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {ARTIFACT_STATUS_FILTERS.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <Spinner text="Cargando entregas…" /> : (
          <div className="space-y-2">
            {!filtered.length && (
              <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                {statusFilter ? 'No hay entregas con ese estado.' : 'Aún no registras evidencias.'}
              </p>
            )}
            {filtered.map(a => {
              const versions = sortedVersions(a)
              const current = latestVersion(a)
              const ev = latestEvaluation(a)
              const prevEv = previousEvaluation(a)
              const open = openId === a.id
              return (
                <div key={a.id} className="overflow-hidden rounded-xl border bg-card shadow-xs">
                  <button onClick={() => setOpenId(open ? null : a.id)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted">
                    <div className="min-w-0">
                      <span className="font-medium">{TYPE_LABEL[a.type]}</span>
                      <span className="ml-2 truncate text-sm text-muted-foreground">
                        {current?.original_filename} · v{a.current_version} · {new Date(a.created_at).toLocaleDateString('es-PE')}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge value={a.status} label={STATUS_LABEL[a.status]} />
                      {open
                        ? <ChevronUp className="size-4 text-muted-foreground" />
                        : <ChevronDown className="size-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {open && (
                    <div className="border-t px-5 py-4">
                      {ev ? <EvaluationView ev={ev} prev={prevEv} /> : (
                        <p className="text-sm text-muted-foreground">Sin evaluación disponible.</p>
                      )}
                      {a.status === 'NEEDS_REVISION' && !resubmitFor && (
                        <Button className="mt-4" onClick={() => { setResubmitFor(a.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                          Subir corrección
                        </Button>
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
                              v.status === 'MANUAL_REVIEW' ? '—' : v.evaluations?.[0]?.overall_score ?? '—',
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
