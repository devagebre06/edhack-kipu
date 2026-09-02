import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
} from 'recharts'
import { Search } from 'lucide-react'
import { periodoCorto } from '@/config/labels'
import { useAlumnos } from '@/hooks'
import { Section, Spinner, Stat, Table } from '@/components'
import { Card, CardContent, Input, Button } from '@/components/ui'
import type { MapaBucket, MapaDistribution } from '@/types'

const BUCKET_ORDER: MapaBucket[] = ['critico', 'intermedio', 'logrado']
const BUCKET_LABEL: Record<MapaBucket, string> = { critico: 'En inicio', intermedio: 'En proceso', logrado: 'En logro' }
const PAGE = 25

function DistBar({ distribution }: { distribution: MapaDistribution }) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {BUCKET_ORDER.map(b => (
        <div key={b} style={{ width: `${distribution[b].pct}%`, background: distribution[b].color }} />
      ))}
    </div>
  )
}

const signo = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}`)

export default function UgelAlumnos() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const { data, isLoading } = useAlumnos({ search, limit: PAGE, offset: page * PAGE })
  const navigate = useNavigate()

  if (isLoading && !data) return <Spinner text="Cargando alumnos…" />
  if (!data) return null

  const { totals, evolucion, avance, distribucion, cursos, alumnos, total } = data
  const paginas = Math.max(1, Math.ceil(total / PAGE))

  const avanceData = [
    { estado: 'Suben', alumnos: avance.suben, color: 'var(--chart-2)' },
    { estado: 'Se mantienen', alumnos: avance.estables, color: 'var(--chart-4)' },
    { estado: 'Bajan', alumnos: avance.bajan, color: 'var(--chart-5)' },
  ]

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Alumnos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Evolución del logro de los estudiantes de la UGEL 06. Haz clic en una fila para ver su ficha y su historial de notas.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Alumnos" value={totals.alumnos} />
        <Stat label="Promedio diagnóstico" value={`${totals.promedio_diagnostico ?? '—'}/4`} />
        <Stat label="Promedio actual" value={`${totals.promedio_actual ?? '—'}/4`} tone="ok" />
        <Stat label="Avance promedio" value={signo(totals.avance_promedio)} tone={(totals.avance_promedio ?? 0) >= 0 ? 'ok' : 'bad'} />
      </div>

      <Section title="Evolución del logro en el tiempo">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">Promedio de todos los alumnos en cada evaluación del año.</p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={evolucion} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="periodo_nombre" fontSize={11} interval={0} tickFormatter={periodoCorto} />
                  <YAxis domain={[1, 4]} ticks={[1, 2, 3, 4]} fontSize={12}
                    label={{ value: 'Promedio (1-4)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="promedio" name="Promedio" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">Cómo cambió cada alumno respecto al diagnóstico.</p>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={avanceData} margin={{ bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="estado" fontSize={11} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="alumnos" name="Alumnos" radius={[4, 4, 0, 0]}>
                    {avanceData.map(d => <Cell key={d.estado} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Dónde está el grupo hoy">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">Nivel de logro actual de los {totals.alumnos} alumnos.</p>
              <DistBar distribution={distribucion} />
              <ul className="mt-3 space-y-1 text-sm">
                {BUCKET_ORDER.map(b => (
                  <li key={b} className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: distribucion[b].color }} />
                      {BUCKET_LABEL[b]}
                    </span>
                    <span className="tabular-nums">{distribucion[b].count} ({distribucion[b].pct}%)</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">Promedio por área (todas las evaluaciones).</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cursos} margin={{ bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="curso_nombre" fontSize={12} />
                  <YAxis domain={[1, 4]} ticks={[1, 2, 3, 4]} fontSize={12} />
                  <Tooltip />
                  <Legend verticalAlign="top" height={26} />
                  <Bar dataKey="promedio" name="Promedio (1-4)" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        title={`Alumnos (${total})`}
        right={
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Buscar por nombre…"
              className="pl-8"
              aria-label="Buscar alumno"
            />
          </div>
        }
      >
        <Table
          head={['Alumno', 'Aula', 'Institución', 'Diagnóstico', 'Actual', 'Avance', 'Nivel actual']}
          empty="Ningún alumno coincide con la búsqueda."
          onRowClick={(i) => navigate(`/ugel/alumnos/${alumnos[i].alumno_id}`)}
          rows={alumnos.map(a => [
            <span key={`n-${a.alumno_id}`} className="font-medium">{a.alumno_nombre}</span>,
            [a.aula_nombre, a.turno].filter(Boolean).join(' · '),
            <span key={`c-${a.alumno_id}`} className="text-muted-foreground">{a.colegio_nombre ?? '—'}</span>,
            `${a.promedio_diagnostico ?? '—'}`,
            `${a.promedio_actual ?? '—'}`,
            <span key={`d-${a.alumno_id}`} className={(a.delta ?? 0) >= 0 ? 'text-success' : 'text-destructive'}>{signo(a.delta)}</span>,
            a.nivel_actual_nombre ?? '—',
          ])}
        />
        {paginas > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Página {page + 1} de {paginas} · mostrando {alumnos.length} de {total}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= paginas - 1} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}
