import { useState } from 'react'
import { SEVERITY_LABEL, ALERT_STATUS_LABEL } from '@/config/labels'
import { useProfile, useInstitutionAlerts, useUpdateAlertStatus, nextAlertStatus, qk } from '@/hooks'
import { isClosed, activeAlerts } from '@/factories'
import { Badge, Spinner } from '@/components'
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'

export default function DirectorAlerts() {
  const profile = useProfile()
  const { data: alerts, isLoading } = useInstitutionAlerts(profile.institution_id!)
  const updateStatus = useUpdateAlertStatus(qk.directorAlerts)
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const advance = (id: string, current: string) => {
    const next = nextAlertStatus(current)
    if (next) updateStatus.mutate({ id, status: next })
  }
  const dismiss = (id: string) => updateStatus.mutate({ id, status: 'DISMISSED' })

  if (isLoading) return <Spinner text="Cargando alertas…" />

  const list = alerts ?? []
  let filtered = list
  if (severityFilter) filtered = filtered.filter(a => a.severity === severityFilter)
  if (statusFilter) filtered = filtered.filter(a => a.status === statusFilter)
  const active = activeAlerts(list).length

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Situaciones de atención pedagógica en tu institución.</p>
        </div>
        {active > 0 && (
          <span className="shrink-0 rounded-full bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">
            {active} activa{active !== 1 ? 's' : ''}
          </span>
        )}
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Select value={severityFilter || 'all'} onValueChange={v => setSeverityFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-auto min-w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda severidad</SelectItem>
            {Object.entries(SEVERITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-auto min-w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo estado</SelectItem>
            {Object.entries(ALERT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        {(severityFilter || statusFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setSeverityFilter(''); setStatusFilter('') }}>Limpiar</Button>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {!filtered.length && (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            {severityFilter || statusFilter ? 'No hay alertas con esos filtros.' : 'Sin alertas activas. ¡Todo en orden!'}
          </p>
        )}
        {filtered.map(al => {
          const closed = isClosed(al)
          return (
            <div key={al.id} className={`rounded-xl border bg-card p-4 shadow-xs ${closed ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge value={al.severity} label={`Severidad ${SEVERITY_LABEL[al.severity]?.toLowerCase()}`} />
                  <Badge value={al.status} label={ALERT_STATUS_LABEL[al.status]} />
                  <span className="font-medium">{al.title}</span>
                </div>
                {!closed && (
                  <div className="flex shrink-0 gap-2">
                    {nextAlertStatus(al.status) && (
                      <Button variant="outline" size="sm" onClick={() => advance(al.id, al.status)}>
                        {al.status === 'NEW' ? 'Tomar en revisión' : 'Marcar resuelta'}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => dismiss(al.id)}>
                      Descartar
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-2 max-w-[75ch] text-sm text-muted-foreground">{al.summary}</p>
              <p className="mt-1.5 text-sm"><span className="font-medium">Acción sugerida:</span> {al.suggested_action}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(al.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
