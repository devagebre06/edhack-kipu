import { useState } from 'react'
import * as XLSX from 'xlsx'
import { STATUS_LABEL, TYPE_LABEL } from '@/config/labels'
import { useProfile, useDirectorArtifacts } from '@/hooks'
import { artifactScore, teacherName, subjectName } from '@/factories'
import { Badge, Spinner, Table } from '@/components'

export default function DirectorArtifacts() {
  const profile = useProfile()
  const { data, isLoading } = useDirectorArtifacts(profile.institution_id!)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const artifacts = data ?? []
  let filtered = artifacts
  if (statusFilter) filtered = filtered.filter(a => a.status === statusFilter)
  if (typeFilter) filtered = filtered.filter(a => a.type === typeFilter)

  const exportXlsx = () => {
    const rows = artifacts.map(a => ({
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
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Entregas</h1>
          <p className="mt-1 text-sm text-ink-soft">Todas las evidencias subidas por los docentes de tu institución.</p>
        </div>
        <button onClick={exportXlsx} className="shrink-0 rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-bg">
          Descargar Excel
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(statusFilter || typeFilter) && (
          <button onClick={() => { setStatusFilter(''); setTypeFilter('') }}
            className="text-sm text-ink-soft hover:text-ink underline">Limpiar filtros</button>
        )}
        <span className="ml-auto self-center text-sm text-ink-soft">{filtered.length} entrega{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="mt-4">
        <Table
          head={['Docente', 'Curso', 'Tipo', 'v', 'Puntaje', 'Estado', 'Fecha']}
          empty="No hay entregas con esos filtros."
          rows={filtered.map(a => [
            teacherName(a),
            subjectName(a),
            TYPE_LABEL[a.type],
            `v${a.current_version}`,
            artifactScore(a) !== undefined ? `${artifactScore(a)}/100` : '—',
            <Badge value={a.status} label={STATUS_LABEL[a.status]} />,
            new Date(a.created_at).toLocaleDateString('es-PE'),
          ])}
        />
      </div>
    </div>
  )
}
