import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { supabase, STATUS_LABEL, TYPE_LABEL, SEVERITY_LABEL, ALERT_STATUS_LABEL } from '../lib'
import { useProfile } from '../App'
import { Badge, Section, Table, Spinner, Stat } from '../ui'

export default function Director() {
  const profile = useProfile()
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['director'],
    queryFn: async () => {
      const [teachers, artifacts, alerts] = await Promise.all([
        supabase.from('profiles').select('*').eq('institution_id', profile.institution_id!).eq('role', 'teacher'),
        supabase.from('artifacts').select('*, profiles(full_name), subjects(name), artifact_versions(version, status, created_at, evaluations(overall_score, decision))').eq('institution_id', profile.institution_id!).order('created_at', { ascending: false }),
        supabase.from('alerts').select('*').eq('institution_id', profile.institution_id!).order('created_at', { ascending: false }),
      ])
      return { teachers: teachers.data || [], artifacts: artifacts.data || [], alerts: alerts.data || [] }
    },
  })

  if (isLoading || !data) return <Spinner text="Cargando datos de tu institución…" />
  const { teachers, artifacts, alerts } = data
  const filtered = statusFilter ? artifacts.filter(a => a.status === statusFilter) : artifacts
  const score = (a: any) => a.artifact_versions?.at(-1)?.evaluations?.[0]?.overall_score

  const exportXlsx = () => {
    const rows = artifacts.map(a => ({
      Docente: a.profiles?.full_name, Curso: a.subjects?.name, Tipo: TYPE_LABEL[a.type], Estado: STATUS_LABEL[a.status],
      Versión: a.current_version, Puntaje: score(a) ?? '', Fecha: new Date(a.created_at).toLocaleDateString('es-PE'),
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Entregas')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(alerts.map(al => ({ Tipo: al.type, Severidad: SEVERITY_LABEL[al.severity], Estado: ALERT_STATUS_LABEL[al.status], Título: al.title }))), 'Alertas')
    XLSX.writeFile(wb, 'kipu-reporte-institucion.xlsx')
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Mi institución</h1>
      <p className="mt-1 text-sm text-ink-soft">Seguimiento de evidencias y acompañamiento a tu equipo docente.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Docentes" value={teachers.length} />
        <Stat label="Entregas" value={artifacts.length} />
        <Stat label="Aprobadas" value={artifacts.filter(a => a.status === 'APPROVED').length} tone="ok" />
        <Stat label="Por corregir" value={artifacts.filter(a => a.status === 'NEEDS_REVISION').length} tone="warn" />
      </div>

      <Section title="Alertas de la institución">
        <div className="space-y-2">
          {!alerts.length && <p className="text-sm text-ink-soft">Sin alertas activas.</p>}
          {alerts.map(al => (
            <div key={al.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge value={al.severity} label={`Severidad ${SEVERITY_LABEL[al.severity].toLowerCase()}`} />
                <Badge value={al.status} label={ALERT_STATUS_LABEL[al.status]} />
                <span className="font-medium">{al.title}</span>
              </div>
              <p className="mt-1.5 max-w-[75ch] text-sm text-ink-soft">{al.summary}</p>
              <p className="mt-1.5 text-sm"><span className="font-medium">Acción sugerida:</span> {al.suggested_action}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Entregas" right={
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm" aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={exportXlsx} className="rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-deep">Descargar Excel</button>
        </div>
      }>
        <Table head={['Docente', 'Curso', 'Tipo', 'Versión', 'Puntaje', 'Estado', 'Fecha']} empty="No hay entregas con ese estado."
          rows={filtered.map(a => [
            a.profiles?.full_name, a.subjects?.name, TYPE_LABEL[a.type], `v${a.current_version}`,
            score(a) ?? '—', <Badge value={a.status} label={STATUS_LABEL[a.status]} />, new Date(a.created_at).toLocaleDateString('es-PE'),
          ])} />
      </Section>
    </div>
  )
}
