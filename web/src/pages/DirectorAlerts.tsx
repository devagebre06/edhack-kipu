import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, SEVERITY_LABEL, ALERT_STATUS_LABEL } from '../lib'
import { useProfile } from '../App'
import { Badge, Spinner } from '../ui'

const NEXT_STATUS: Record<string, string> = {
  NEW: 'UNDER_REVIEW', UNDER_REVIEW: 'RESOLVED', ESCALATED: 'RESOLVED',
}

export default function DirectorAlerts() {
  const profile = useProfile()
  const qc = useQueryClient()
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['director-alerts'],
    queryFn: async () => (await supabase
      .from('alerts')
      .select('*')
      .eq('institution_id', profile.institution_id!)
      .order('created_at', { ascending: false })
    ).data || [],
  })

  const advance = async (id: string, current: string) => {
    const next = NEXT_STATUS[current]
    if (!next) return
    await supabase.from('alerts').update({ status: next }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['director-alerts'] })
  }

  const dismiss = async (id: string) => {
    await supabase.from('alerts').update({ status: 'DISMISSED' }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['director-alerts'] })
  }

  if (isLoading) return <Spinner text="Cargando alertas…" />

  const list = alerts || []
  let filtered = list
  if (severityFilter) filtered = filtered.filter(a => a.severity === severityFilter)
  if (statusFilter) filtered = filtered.filter(a => a.status === statusFilter)

  const active = list.filter(a => !['DISMISSED', 'RESOLVED'].includes(a.status)).length

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Alertas</h1>
          <p className="mt-1 text-sm text-ink-soft">Situaciones de atención pedagógica en tu institución.</p>
        </div>
        {active > 0 && (
          <span className="shrink-0 rounded-full bg-bad-bg px-3 py-1 text-sm font-medium text-bad">
            {active} activa{active !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm">
          <option value="">Toda severidad</option>
          {Object.entries(SEVERITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm">
          <option value="">Todo estado</option>
          {Object.entries(ALERT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(severityFilter || statusFilter) && (
          <button onClick={() => { setSeverityFilter(''); setStatusFilter('') }}
            className="text-sm text-ink-soft hover:text-ink underline">Limpiar</button>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {!filtered.length && (
          <p className="rounded-lg border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-soft">
            {severityFilter || statusFilter ? 'No hay alertas con esos filtros.' : 'Sin alertas activas. ¡Todo en orden!'}
          </p>
        )}
        {filtered.map(al => {
          const resolved = ['DISMISSED', 'RESOLVED'].includes(al.status)
          return (
            <div key={al.id} className={`rounded-lg border bg-surface p-4 ${resolved ? 'border-line opacity-60' : 'border-line'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge value={al.severity} label={`Severidad ${SEVERITY_LABEL[al.severity]?.toLowerCase()}`} />
                  <Badge value={al.status} label={ALERT_STATUS_LABEL[al.status]} />
                  <span className="font-medium">{al.title}</span>
                </div>
                {!resolved && (
                  <div className="flex shrink-0 gap-2">
                    {NEXT_STATUS[al.status] && (
                      <button onClick={() => advance(al.id, al.status)}
                        className="rounded-md border border-line px-3 py-1 text-xs font-medium hover:bg-bg">
                        {al.status === 'NEW' ? 'Tomar en revisión' : 'Marcar resuelta'}
                      </button>
                    )}
                    <button onClick={() => dismiss(al.id)}
                      className="rounded-md border border-line px-3 py-1 text-xs text-ink-soft hover:bg-bg">
                      Descartar
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-2 max-w-[75ch] text-sm text-ink-soft">{al.summary}</p>
              <p className="mt-1.5 text-sm"><span className="font-medium">Acción sugerida:</span> {al.suggested_action}</p>
              <p className="mt-1 text-xs text-ink-soft">{new Date(al.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
