import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { ArrowLeft } from 'lucide-react'
import { periodoCorto } from '@/config/labels'
import { PROFESOR_SCORE_LABELS } from '@/config/scoringLabels'
import { useProfesor } from '@/hooks'
import { Section, Spinner, Stat, Table, Badge } from '@/components'
import { Card, CardContent } from '@/components/ui'
import type { MapaBucket, MapaDistribution } from '@/types'

const BUCKET_ORDER: MapaBucket[] = ['critico', 'intermedio', 'logrado']
const BUCKET_LABEL: Record<MapaBucket, string> = { critico: 'En inicio', intermedio: 'En proceso', logrado: 'En logro' }

function DistBar({ distribution }: { distribution: MapaDistribution }) {
  return (
    <div className="flex h-2 w-full min-w-24 overflow-hidden rounded-full bg-muted">
      {BUCKET_ORDER.map(b => (
        <div key={b} style={{ width: `${distribution[b].pct}%`, background: distribution[b].color }} />
      ))}
    </div>
  )
}

function ScoreBar({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

const signo = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}`)

export default function UgelProfesorDetalle() {
  const { dni = '' } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useProfesor(dni)

  if (isLoading) return <Spinner text="Cargando ficha del docente…" />
  if (isError || !data) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No se encontró al docente con DNI {dni}.</p>
        <Link to="/ugel/profesores" className="mt-3 inline-block text-sm underline">Volver a Docentes</Link>
      </div>
    )
  }

  const { profesor: p, totales, aulas, evolucion, competencias, unidades, scoring } = data
  const s = p.scores
  const ctx = p.contexto

  return (
    <div>
      <button onClick={() => navigate('/ugel/profesores')}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Docentes
      </button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{p.full_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {p.course_name} · DNI {p.dni} · {ctx.school_name ?? '—'}
            {ctx.district ? ` · ${ctx.district}` : ''}{ctx.network_name ? ` · ${ctx.network_name}` : ''}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-5 py-3 text-right shadow-xs">
          <div className="text-3xl font-semibold tabular-nums" style={{ color: s.nivel_color }}>
            {s.global}<span className="text-base text-muted-foreground">/100</span>
          </div>
          <div className="text-xs" style={{ color: s.nivel_color }}>{s.nivel_label}</div>
          <div className="mt-1 text-xs text-muted-foreground">Puesto {p.ranking} de {scoring.referencias ? '30' : '—'} docentes</div>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Aulas" value={totales.aulas} />
        <Stat label="Alumnos" value={totales.alumnos} />
        <Stat label="Notas registradas" value={totales.notas} />
        <Stat label="Periodos" value={totales.periodos} />
        <Stat label="Unidades" value={totales.unidades} />
        <Stat label="Sesiones" value={totales.sesiones} />
        <Stat label="Evidencias" value={totales.evidencias}
          tone={totales.evidencias_observadas > 0 ? 'warn' : undefined} />
        <Stat label="Puntaje de evidencias" value={totales.puntaje_evidencias != null ? `${totales.puntaje_evidencias}/100` : '—'} />
      </div>

      <Section title="Scoring">
        <Card>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <ScoreBar label={PROFESOR_SCORE_LABELS.logro} value={s.logro} hint={`Promedio ${p.average_score_1_to_4 ?? '—'}/4 de sus estudiantes`} />
              <ScoreBar label={PROFESOR_SCORE_LABELS.equidad} value={s.equidad} hint={`${p.pct_critico}% de sus estudiantes están en C (En inicio)`} />
              <ScoreBar label={PROFESOR_SCORE_LABELS.cobertura} value={s.cobertura} hint={`${p.total_evaluaciones} evaluados, comparados con el mayor grupo`} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-6 border-t pt-4 text-sm">
              <div>
                <span className="text-muted-foreground">Valor agregado: </span>
                <span className={`font-semibold tabular-nums ${(s.valor_agregado ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {signo(s.valor_agregado)}
                </span>
                <span className="text-muted-foreground"> vs. su distrito ({s.referencia_distrito ?? '—'}/4)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Distribución de sus alumnos:</span>
                <div className="w-40"><DistBar distribution={p.distribution} /></div>
                {BUCKET_ORDER.map(b => (
                  <span key={b} className="text-xs" style={{ color: p.distribution[b].color }}>
                    {BUCKET_LABEL[b]} {p.distribution[b].pct}%
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Evolución de las notas de sus alumnos">
        {evolucion.length > 1 ? (
          <Card>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={evolucion} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="periodo" fontSize={11} interval={0} tickFormatter={periodoCorto} />
                  <YAxis domain={[1, 4]} ticks={[1, 2, 3, 4]} fontSize={12}
                    label={{ value: 'Promedio (1-4)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="promedio" name="Promedio del grupo" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">Solo hay un periodo evaluado; aún no hay evolución que mostrar.</p>
        )}
      </Section>

      <Section title="Aulas que dicta">
        <Table
          head={['Aula', 'Turno', 'Área', 'Institución', 'Alumnos', 'Diagnóstico', 'Actual', 'Avance', 'Distribución', 'Promedio actual del aula (0–100)', PROFESOR_SCORE_LABELS.equidad]}
          empty="Sin aulas asignadas."
          rows={aulas.map(a => [
            <span key={`a-${a.dictado_id}`} className="font-medium">{a.aula_nombre}</span>,
            a.turno ?? '—',
            a.curso_nombre ?? '—',
            <span key={`c-${a.dictado_id}`} className="text-muted-foreground">{a.colegio_nombre ?? '—'}</span>,
            a.alumnos,
            `${a.promedio_diagnostico ?? '—'}`,
            `${a.promedio_actual ?? '—'}`,
            <span key={`v-${a.dictado_id}`} className={(a.avance ?? 0) >= 0 ? 'text-success' : 'text-destructive'}>{signo(a.avance)}</span>,
            <div key={`d-${a.dictado_id}`} className="w-24"><DistBar distribution={a.distribution} /></div>,
            a.scores.logro,
            a.scores.equidad,
          ])}
        />
      </Section>

      <Section title="Desempeño por competencia">
        <Card>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={competencias} margin={{ bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="codigo" fontSize={12} />
                <YAxis domain={[1, 4]} ticks={[1, 2, 3, 4]} fontSize={12} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(v: any) => [`${v}/4`, 'Promedio']}
                  labelFormatter={(codigo) => competencias.find(c => c.codigo === codigo)?.nombre ?? String(codigo)} />
                <Bar dataKey="promedio" name="Promedio" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {competencias.map(c => (
                <li key={`${c.course_key}-${c.codigo}`}>
                  <span className="font-medium text-foreground">{c.codigo}</span> · {c.nombre} — {c.promedio}/4 ({c.nivel_nombre})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Section>

      <Section title={`Unidades y sesiones (${unidades.length})`}>
        {unidades.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            Este docente aún no ha registrado unidades.
          </p>
        ) : (
          <div className="space-y-3">
            {unidades.map(u => (
              <div key={u.id} className="rounded-lg border bg-card p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{u.nombre}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{u.curso_nombre} · {u.aula_nombre}</span>
                  </div>
                  {u.puntaje != null && (
                    <span className="text-sm">
                      Puntaje <span className="font-semibold tabular-nums">{u.puntaje}/100</span>
                    </span>
                  )}
                </div>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sesiones ({u.sesiones.length})</p>
                    <ul className="mt-1 space-y-0.5 text-sm">
                      {u.sesiones.length
                        ? u.sesiones.map(se => <li key={se.id}>{se.nombre}{se.fecha ? ` · ${se.fecha}` : ''}</li>)
                        : <li className="text-muted-foreground">Sin sesiones.</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidencias ({u.evidencias.length})</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {u.evidencias.length
                        ? u.evidencias.map(e => (
                          <li key={e.id} className="flex flex-wrap items-center gap-2">
                            <Badge value={e.estado} label={e.estado === 'APPROVED' ? 'Aprobada' : e.estado === 'NEEDS_REVISION' ? 'Por corregir' : e.estado} />
                            <span className="tabular-nums">{e.puntaje != null ? `${e.puntaje}/100` : '—'}</span>
                            <span className="text-xs text-muted-foreground">v{e.version_actual}</span>
                          </li>
                        ))
                        : <li className="text-muted-foreground">Sin evidencias.</li>}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
