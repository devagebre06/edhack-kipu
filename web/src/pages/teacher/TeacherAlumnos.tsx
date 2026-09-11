import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { Search } from 'lucide-react'
import { periodoCorto } from '@/config/labels'
import { useMisAlumnos } from '@/hooks'
import { Section, Spinner, Stat, Table } from '@/components'
import { Card, CardContent, Input, Button } from '@/components/ui'
import type { MapaBucket, MapaDistribution } from '@/types'

const BUCKET_ORDER: MapaBucket[] = ['critico', 'intermedio', 'logrado']
const BUCKET_LABEL: Record<MapaBucket, string> = { critico: 'En inicio', intermedio: 'En proceso', logrado: 'En logro' }
const PAGE = 25
const signo = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}`)

function DistBar({ distribution }: { distribution: MapaDistribution }) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {BUCKET_ORDER.map(b => (
        <div key={b} style={{ width: `${distribution[b].pct}%`, background: distribution[b].color }} />
      ))}
    </div>
  )
}

/**
 * Mis estudiantes: el mismo panorama que ve la UGEL, pero acotado a las aulas
 * donde el docente dicta. El backend impone ese alcance; aquí no se puede pedir
 * más de lo que le corresponde.
 */
export default function TeacherAlumnos() {
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(0)
  const { data, isLoading, error } = useMisAlumnos({ search: buscar, limit: PAGE, offset: pagina * PAGE })
  const navigate = useNavigate()

  if (error && !data) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Mis estudiantes</h1>
        <p className="mt-6 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No se pudo cargar el listado: {(error as Error).message}
        </p>
      </div>
    )
  }
  if (isLoading && !data) return <Spinner text="Cargando tus estudiantes…" />
  if (!data) return null

  const { totals, evolucion, avance, distribucion, cursos, alumnos, total } = data
  const paginas = Math.max(1, Math.ceil(total / PAGE))

  if (!total && !buscar) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Mis estudiantes</h1>
        <p className="mt-6 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Todavía no hay estudiantes matriculados en tus aulas.
        </p>
      </div>
    )
  }

  const avanceData = [
    { estado: 'Suben', alumnos: avance.suben, color: 'var(--chart-2)' },
    { estado: 'Se mantienen', alumnos: avance.estables, color: 'var(--chart-4)' },
    { estado: 'Bajan', alumnos: avance.bajan, color: 'var(--chart-5)' },
  ]

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mis estudiantes</h1>
        <p className="mt-1 max-w-[75ch] text-sm text-muted-foreground">
          Cómo va cada estudiante de tus aulas a lo largo del año. Haz clic en una fila para ver su historial de notas
          y su desglose por competencia.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Estudiantes" value={totals.alumnos} />
        <Stat label="Aulas" value={totals.aulas} />
        <Stat label="Promedio actual" value={`${totals.promedio_actual ?? '—'}/4`} tone="ok" />
        <Stat label="Avance promedio" value={signo(totals.avance_promedio)} tone={(totals.avance_promedio ?? 0) >= 0 ? 'ok' : 'bad'} />
      </div>

      <Section title="Cómo evoluciona el grupo">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">Promedio de tus estudiantes en cada evaluación.</p>
              <ResponsiveContainer width="100%" height={240}>
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
              <p className="mb-2 text-sm text-muted-foreground">Respecto al diagnóstico.</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={avanceData} margin={{ bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="estado" fontSize={11} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="alumnos" name="Estudiantes" radius={[4, 4, 0, 0]}>
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
              <p className="mb-3 text-sm text-muted-foreground">Nivel de logro actual.</p>
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
              <p className="mb-2 text-sm text-muted-foreground">Promedio por área.</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cursos} margin={{ bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="curso_nombre" fontSize={12} />
                  <YAxis domain={[1, 4]} ticks={[1, 2, 3, 4]} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="promedio" name="Promedio (1-4)" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        title={`Estudiantes (${total})`}
        right={
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={buscar}
              onChange={e => { setBuscar(e.target.value); setPagina(0) }}
              placeholder="Buscar por nombre…"
              className="pl-8"
              aria-label="Buscar estudiante"
            />
          </div>
        }
      >
        <Table
          head={['Estudiante', 'Aula', 'Diagnóstico', 'Actual', 'Avance', 'Nivel actual']}
          empty="Ningún estudiante coincide con la búsqueda."
          onRowClick={(i) => navigate(`/profesor/alumnos/${alumnos[i].alumno_id}`)}
          rows={alumnos.map(a => [
            <span key={`n-${a.alumno_id}`} className="font-medium">{a.alumno_nombre}</span>,
            [a.aula_nombre, a.turno].filter(Boolean).join(' · '),
            `${a.promedio_diagnostico ?? '—'}`,
            `${a.promedio_actual ?? '—'}`,
            <span key={`d-${a.alumno_id}`} className={(a.delta ?? 0) >= 0 ? 'text-success' : 'text-destructive'}>{signo(a.delta)}</span>,
            a.nivel_actual_nombre ?? '—',
          ])}
        />
        {paginas > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Página {pagina + 1} de {paginas} · {alumnos.length} de {total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={pagina >= paginas - 1} onClick={() => setPagina(p => p + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}
