import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { SEVERITY_LABEL, ALERT_STATUS_LABEL } from '@/config/labels'
import { useUgelData, useUpdateAlertStatus, qk } from '@/hooks'
import { metricsByInstitution, lowGradeGroups, institutionName, newCount } from '@/factories'
import { Badge, Section, Spinner, Stat, Table } from '@/components'
import { Card, CardContent, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'

export default function Ugel() {
  const { data, isLoading } = useUgelData()
  const updateStatus = useUpdateAlertStatus(qk.ugel)

  if (isLoading || !data) return <Spinner text="Cargando métricas agregadas…" />
  const { institutions, artifacts, alerts, grades } = data

  const byInst = metricsByInstitution(institutions, artifacts)
  const lowGroups = lowGradeGroups(grades)
  const invalidRate = artifacts.length
    ? Math.round(100 * artifacts.filter(a => a.status === 'NEEDS_REVISION').length / artifacts.length)
    : 0

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Panel UGEL</h1>
        <p className="mt-1 text-sm text-muted-foreground">Métricas agregadas por institución. El detalle individual requiere una alerta que lo justifique.</p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Instituciones" value={institutions.length} />
        <Stat label="Entregas totales" value={artifacts.length} />
        <Stat label="Alertas nuevas" value={newCount(alerts)} tone={newCount(alerts) > 0 ? 'bad' : undefined} />
        <Stat label="Tasa de invalidez" value={`${invalidRate}%`} tone="warn" />
      </div>

      <Section title="Alertas">
        <div className="space-y-2">
          {alerts.map(al => (
            <div key={al.id} className="rounded-lg border bg-card p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge value={al.severity} label={SEVERITY_LABEL[al.severity]} />
                  <Badge value={al.status} label={ALERT_STATUS_LABEL[al.status]} />
                  <span className="font-medium">{al.title}</span>
                </div>
                <Select value={al.status} onValueChange={status => updateStatus.mutate({ id: al.id, status })}>
                  <SelectTrigger size="sm" aria-label="Cambiar estado de la alerta" className="w-auto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ALERT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="mt-1.5 max-w-[75ch] text-sm text-muted-foreground">{institutionName(al)} — {al.summary}</p>
              <p className="mt-1.5 text-sm"><span className="font-medium">Acción sugerida:</span> {al.suggested_action}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Score promedio y tasa de invalidez por institución">
        <Card>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byInst}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="score" name="Score promedio" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="invalidez" name="% invalidez" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Section>

      <Section title="Grupos con calificaciones preocupantes">
        <Table head={['Grupo', 'Promedio', '% bajo la nota 11']} empty="Sin registros de notas."
          rows={lowGroups.map(g => [g.label, g.avg, <span className={g.under >= 40 ? 'font-semibold text-destructive' : ''}>{g.under}%</span>])} />
      </Section>
    </div>
  )
}
