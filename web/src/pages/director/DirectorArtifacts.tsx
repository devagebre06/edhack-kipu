import { useState } from 'react'
import * as XLSX from 'xlsx'
import { STATUS_LABEL, TYPE_LABEL } from '@/config/labels'
import { useProfile, useDirectorArtifacts } from '@/hooks'
import {
  artifactScore, teacherName, subjectName,
  sortedVersions, latestVersion, latestEvaluation, previousEvaluation,
} from '@/factories'
import { api } from '@/services'
import { Badge, Spinner, Table, EvaluationView, DateRangeFilter } from '@/components'
import type { DateRange } from '@/components'
import {
  Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui'
import { Download, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import type { ArtifactVersion } from '@/types'

const ALL = '__all__'

// Visor de PDF bajo demanda: pide al backend una URL firmada temporal y la
// muestra embebida. `url` null = evidencia demo sin archivo real.
function PdfViewer({ version }: { version: ArtifactVersion }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [url, setUrl] = useState<string | null>(null)
  const [note, setNote] = useState<string>('')

  const load = async () => {
    setState('loading')
    try {
      const res = await api.files.artifactVersionUrl(version.id)
      setUrl(res.url)
      setNote(res.note ?? '')
      setState('ready')
    } catch (e: any) {
      setNote(e.message)
      setState('error')
    }
  }

  if (state === 'idle')
    return (
      <Button variant="outline" size="sm" onClick={load}>
        Ver PDF de la v{version.version}
      </Button>
    )
  if (state === 'loading') return <Spinner text="Abriendo documento…" />
  if (state === 'error') return <p className="text-sm text-destructive">No se pudo abrir el archivo: {note}</p>
  if (!url) return <p className="text-sm text-muted-foreground">{note || 'Esta evidencia no tiene archivo adjunto.'}</p>

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">{version.original_filename}</span>
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">
          <ExternalLink className="size-3.5" /> Abrir en pestaña nueva
        </a>
      </div>
      <iframe src={url} title={version.original_filename} className="h-150 w-full rounded-md border" />
    </div>
  )
}

export default function DirectorArtifacts() {
  const profile = useProfile()
  const { data, isLoading } = useDirectorArtifacts(profile.institution_id!)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const [openId, setOpenId] = useState<string | null>(null)

  const artifacts = data ?? []

  // Docentes presentes en las entregas (para el filtro por profesor Kipu).
  const teachers = Array.from(new Map(artifacts.map(a => [a.teacher_id, teacherName(a)])).entries())
    .map(([id, name]) => ({ id, name }))
    .filter((t): t is { id: string; name: string } => !!t.id)
    .sort((a, b) => a.name.localeCompare(b.name))

  let filtered = artifacts
  if (statusFilter) filtered = filtered.filter(a => a.status === statusFilter)
  if (typeFilter) filtered = filtered.filter(a => a.type === typeFilter)
  if (teacherFilter) filtered = filtered.filter(a => a.teacher_id === teacherFilter)
  if (range.from) { const from = new Date(`${range.from}T00:00:00`); filtered = filtered.filter(a => new Date(a.created_at) >= from) }
  if (range.to) { const to = new Date(`${range.to}T23:59:59.999`); filtered = filtered.filter(a => new Date(a.created_at) <= to) }

  const hasFilters = !!(statusFilter || typeFilter || teacherFilter || range.from || range.to)
  const clearFilters = () => { setStatusFilter(''); setTypeFilter(''); setTeacherFilter(''); setRange({ from: '', to: '' }) }

  const exportXlsx = () => {
    const rows = filtered.map(a => ({
      Docente: teacherName(a),
      Curso: subjectName(a),
      Tipo: TYPE_LABEL[a.type],
      Estado: STATUS_LABEL[a.status],
      Versión: a.current_version,
      Puntaje: artifactScore(a) ?? '',
      Fecha: new Date(a.created_at).toLocaleDateString('es-PE'),
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Entregas')
    XLSX.writeFile(wb, 'kipu-entregas.xlsx')
  }

  if (isLoading) return <Spinner text="Cargando entregas…" />

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entregas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Evidencias subidas por los docentes. Abre una entrega para ver el PDF y su evaluación.
          </p>
        </div>
        <Button variant="outline" className="shrink-0" onClick={exportXlsx}>
          <Download /> Descargar Excel
        </Button>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Select value={teacherFilter || ALL} onValueChange={v => setTeacherFilter(v === ALL ? '' : v)}>
          <SelectTrigger className="w-auto min-w-48" aria-label="Filtrar por docente"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los docentes</SelectItem>
            {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter || ALL} onValueChange={v => setStatusFilter(v === ALL ? '' : v)}>
          <SelectTrigger className="w-auto min-w-44" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter || ALL} onValueChange={v => setTypeFilter(v === ALL ? '' : v)}>
          <SelectTrigger className="w-auto min-w-44" aria-label="Filtrar por tipo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <DateRangeFilter value={range} onChange={setRange} />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>Limpiar filtros</Button>
        )}
        <span className="ml-auto self-center text-sm text-muted-foreground">{filtered.length} entrega{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="mt-4 space-y-2">
        {!filtered.length && (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            No hay entregas con esos filtros.
          </p>
        )}
        {filtered.map(a => {
          const versions = sortedVersions(a)
          const current = latestVersion(a)
          const ev = latestEvaluation(a)
          const prevEv = previousEvaluation(a)
          const open = openId === a.id
          const score = artifactScore(a)
          return (
            <div key={a.id} className="rounded-xl border bg-card shadow-xs">
              <button onClick={() => setOpenId(open ? null : a.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-3.5 text-left transition-colors hover:bg-muted/50">
                <div className="min-w-0">
                  <span className="font-medium">{teacherName(a)}</span>
                  <span className="ml-2 truncate text-sm text-muted-foreground">
                    {subjectName(a)} · {TYPE_LABEL[a.type]} · v{a.current_version} · {new Date(a.created_at).toLocaleDateString('es-PE')}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm tabular-nums text-muted-foreground">{score !== undefined ? `${score}/100` : '—'}</span>
                  <Badge value={a.status} label={STATUS_LABEL[a.status]} />
                  {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                </div>
              </button>

              {open && (
                <div className="space-y-5 border-t px-5 py-4">
                  {/* PDF de la versión vigente */}
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Documento subido</h4>
                    {current ? <PdfViewer version={current} /> : <p className="text-sm text-muted-foreground">Sin archivo.</p>}
                  </div>

                  {/* Evaluación de la IA */}
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Evaluación</h4>
                    {ev ? <EvaluationView ev={ev} prev={prevEv} /> : <p className="text-sm text-muted-foreground">Sin evaluación disponible.</p>}
                  </div>

                  {/* Historial de versiones con su propio PDF */}
                  {versions.length > 1 && (
                    <div>
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
                      <div className="mt-3 space-y-3">
                        {versions.map(v => <PdfViewer key={v.id} version={v} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
