import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ScatterChart, Scatter, ZAxis, Legend } from 'recharts'
import { SEVERITY_LABEL, ALERT_STATUS_LABEL } from '@/config/labels'
import { Link } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useUgelData, useUpdateAlertStatus, useProfesores, useRealtimeInvalidate, qk } from '@/hooks'
import { metricsByInstitution, lowGradeGroups, institutionName, newCount } from '@/factories'
import { Badge, Section, Spinner, Stat, Table } from '@/components'
import { Card, CardContent, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import type { ProfesorResumen } from '@/types'

const AREA_COLOR: Record<string, string> = { matematica: 'var(--chart-1)', comunicacion: 'var(--chart-2)' }

// Tooltip del dispersograma docente↔alumnos: un punto es un docente.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ProfesorPoint({ active, payload }: any) {
  const p: ProfesorResumen | undefined = active ? payload?.[0]?.payload : undefined
  if (!p) return null
  return (
    <div className="rounded-lg border bg-card p-3 text-xs shadow-md">
      <div className="font-semibold">{p.full_name}</div>
      <div className="text-muted-foreground">{p.course_name} · {p.contexto.school_name ?? '—'}</div>
      <div className="mt-1.5">{p.total_evaluaciones} alumnos · promedio {p.average_score_1_to_4}/4</div>
      <div>{p.pct_logrado}% en logro · {p.pct_critico}% en inicio</div>
      <div className="mt-1 font-medium" style={{ color: p.scores.nivel_color }}>
        Score {p.scores.global}/100 · {p.scores.nivel_label}
      </div>
    </div>
  )
}

export default function Ugel() {
  const { data, isLoading } = useUgelData()
  const { data: docentes } = useProfesores('all')
  const updateStatus = useUpdateAlertStatus(qk.ugel)
  // Alertas en vivo: cualquier alta o cambio de estado (aquí, en la sección de
  // alertas o desde el motor) refresca esta lista sin recargar la página.
  useRealtimeInvalidate('alertas', [qk.ugel, ['alertas']])

  if (isLoading || !data) return <Spinner text="Cargando métricas agregadas…" />
  const { institutions, artifacts, alerts, grades } = data

  // El panel es un resumen: solo las 4 más recientes (ya vienen ordenadas por
  // fecha desc). La bandeja completa vive en /ugel/alertas.
  const ultimasAlertas = alerts.slice(0, 4)

  // Estadísticas profesor ↔ alumno (a partir del logro diagnóstico de sus notas).
  const profesores = docentes?.profesores ?? []
  const refs = docentes?.scoring.referencias
  const alumnosPorDocente = profesores.length
    ? Math.round((refs?.alumnos_evaluados ?? 0) / profesores.length)
    : 0
  const porArea = ['matematica', 'comunicacion'].map(key => ({
    key,
    label: key === 'matematica' ? 'Matemática' : 'Comunicación',
    puntos: profesores.filter(p => p.course_key === key),
  })).filter(a => a.puntos.length > 0)

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

      <Section
        title="Alertas recientes"
        right={
          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title="Se actualiza en vivo">
              <Radio className="size-3.5 text-success" /> En vivo
            </span>
            <Link to="/ugel/alertas" className="underline">Ver las {alerts.length}</Link>
          </div>
        }
      >
        <div className="space-y-2">
          {ultimasAlertas.length === 0 && (
            <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
              Sin alertas registradas.
            </p>
          )}
          {ultimasAlertas.map(al => (
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

      <Section title="Estadísticas profesor ↔ alumno">
        {profesores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos de docentes con notas registradas.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Docentes con notas" value={profesores.length} />
              <Stat label="Alumnos evaluados" value={refs?.alumnos_evaluados ?? 0} />
              <Stat label="Alumnos por docente" value={alumnosPorDocente} />
              <Stat label="Promedio UGEL" value={`${refs?.promedio_ugel ?? '—'}/4`} />
            </div>

            <Card>
              <CardContent>
                <p className="mb-2 text-sm text-muted-foreground">
                  Cada punto es un docente: cuántos alumnos evaluó y qué promedio de logro (1-4) alcanzaron.
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" dataKey="total_evaluaciones" name="Alumnos" fontSize={12}
                      label={{ value: 'Alumnos evaluados', position: 'insideBottom', offset: -8, fontSize: 12 }} />
                    <YAxis type="number" dataKey="average_score_1_to_4" name="Promedio" domain={[1, 4]} ticks={[1, 2, 3, 4]} fontSize={12}
                      label={{ value: 'Promedio (1-4)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                    <ZAxis range={[70, 70]} />
                    <Tooltip content={<ProfesorPoint />} cursor={{ strokeDasharray: '3 3' }} />
                    <Legend verticalAlign="top" height={28} />
                    {porArea.map(a => (
                      <Scatter key={a.key} name={a.label} data={a.puntos} fill={AREA_COLOR[a.key]} />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Table
              head={['#', 'Docente', 'Área', 'Alumnos', 'Promedio', '% en logro', '% en inicio', 'Score', 'Lectura']}
              empty="Sin docentes."
              rows={profesores.slice(0, 10).map(p => [
                p.ranking,
                p.full_name,
                p.course_name ?? p.course_key,
                p.total_evaluaciones,
                `${p.average_score_1_to_4 ?? '—'}/4`,
                `${p.pct_logrado}%`,
                <span key={`c-${p.dni}`} className={p.pct_critico >= 25 ? 'font-semibold text-destructive' : ''}>{p.pct_critico}%</span>,
                <span key={`s-${p.dni}`} className="font-semibold tabular-nums">{p.scores.global}</span>,
                <span key={`n-${p.dni}`} style={{ color: p.scores.nivel_color }}>{p.scores.nivel_label}</span>,
              ])}
            />
            <p className="text-xs text-muted-foreground">
              Mostrando 10 de {profesores.length} docentes, ordenados por score compuesto.
              El detalle por docente y su contexto está en el mapa diagnóstico.
            </p>
          </div>
        )}
      </Section>

      <Section title="Grupos con calificaciones preocupantes">
        <Table head={['Aula', 'Institución', 'Área', 'Promedio (1-4)', '% en inicio']} empty="Sin registros de notas."
          rows={lowGroups.slice(0, 10).map(g => [g.label, g.colegio, g.curso, g.avg,
            <span key={g.id} className={g.under >= 25 ? 'font-semibold text-destructive' : ''}>{g.under}%</span>])} />
      </Section>
    </div>
  )
}
