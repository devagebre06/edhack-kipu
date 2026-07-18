import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { SEVERITY_LABEL, ALERT_STATUS_LABEL } from '@/config/labels'
import { useUgelData, useUpdateAlertStatus, qk } from '@/hooks'
import { metricsByInstitution, lowGradeGroups, institutionName, newCount } from '@/factories'
import { Badge, Section, Spinner, Stat, Table } from '@/components'

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
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Panel UGEL</h1>
      <p className="mt-1 text-sm text-ink-soft">Métricas agregadas por institución. El detalle individual requiere una alerta que lo justifique.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Instituciones" value={institutions.length} />
        <Stat label="Entregas totales" value={artifacts.length} />
        <Stat label="Alertas nuevas" value={newCount(alerts)} tone={newCount(alerts) > 0 ? 'bad' : undefined} />
        <Stat label="Tasa de invalidez" value={`${invalidRate}%`} tone="warn" />
      </div>

      <Section title="Alertas">
        <div className="space-y-2">
          {alerts.map(al => (
            <div key={al.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge value={al.severity} label={SEVERITY_LABEL[al.severity]} />
                  <Badge value={al.status} label={ALERT_STATUS_LABEL[al.status]} />
                  <span className="font-medium">{al.title}</span>
                </div>
                <select value={al.status} onChange={e => updateStatus.mutate({ id: al.id, status: e.target.value })}
                  className="rounded-md border border-line bg-surface px-2 py-1 text-sm" aria-label="Cambiar estado de la alerta">
                  {Object.entries(ALERT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <p className="mt-1.5 max-w-[75ch] text-sm text-ink-soft">{institutionName(al)} — {al.summary}</p>
              <p className="mt-1.5 text-sm"><span className="font-medium">Acción sugerida:</span> {al.suggested_action}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Score promedio y tasa de invalidez por institución">
        <div className="rounded-lg border border-line bg-surface p-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byInst}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="score" name="Score promedio" fill="oklch(0.55 0.15 35)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="invalidez" name="% invalidez" fill="oklch(0.28 0.04 250)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Grupos con calificaciones preocupantes">
        <Table head={['Grupo', 'Promedio', '% bajo la nota 11']} empty="Sin registros de notas."
          rows={lowGroups.map(g => [g.label, g.avg, <span className={g.under >= 40 ? 'font-semibold text-bad' : ''}>{g.under}%</span>])} />
      </Section>
    </div>
  )
}
