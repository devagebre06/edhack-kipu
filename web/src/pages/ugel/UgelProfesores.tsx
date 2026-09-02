import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { useProfesores } from '@/hooks'
import { Section, Spinner, Stat, Table } from '@/components'
import { Card, CardContent, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import type { MapaBucket, ProfesorResumen } from '@/types'

const COURSES = [
  { key: 'all', label: 'Ambas áreas' },
  { key: 'matematica', label: 'Matemática' },
  { key: 'comunicacion', label: 'Comunicación' },
]
const BUCKET_ORDER: MapaBucket[] = ['critico', 'intermedio', 'logrado']
const BUCKET_LABEL: Record<MapaBucket, string> = { critico: 'En inicio', intermedio: 'En proceso', logrado: 'En logro' }
const AREA_COLOR: Record<string, string> = { matematica: 'var(--chart-1)', comunicacion: 'var(--chart-2)' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PuntoDocente({ active, payload }: any) {
  const p: ProfesorResumen | undefined = active ? payload?.[0]?.payload : undefined
  if (!p) return null
  return (
    <div className="rounded-lg border bg-card p-3 text-xs shadow-md">
      <div className="font-semibold">#{p.ranking} {p.full_name}</div>
      <div className="text-muted-foreground">{p.course_name} · {p.contexto.school_name ?? '—'}</div>
      <div className="mt-1.5">{p.total_evaluaciones} alumnos · promedio {p.average_score_1_to_4}/4</div>
      <div style={{ color: p.scores.nivel_color }}>Score {p.scores.global}/100 · {p.scores.nivel_label}</div>
    </div>
  )
}

export default function UgelProfesores() {
  const [course, setCourse] = useState('all')
  const { data, isLoading } = useProfesores(course)
  const navigate = useNavigate()

  if (isLoading || !data) return <Spinner text="Cargando docentes…" />
  const { profesores, scoring } = data

  const alumnos = profesores.reduce((n, p) => n + p.total_evaluaciones, 0)
  const promedio = alumnos
    ? Math.round((profesores.reduce((s, p) => s + (p.average_score_1_to_4 ?? 0) * p.total_evaluaciones, 0) / alumnos) * 100) / 100
    : null
  const pctLogrado = alumnos
    ? Math.round((10 * profesores.reduce((s, p) => s + p.distribution.logrado.count, 0) * 100) / alumnos) / 10
    : 0

  // Cuántos docentes hay en cada nivel de lectura del score.
  const porNivel = scoring.niveles.map(n => ({
    nivel: n.label,
    color: n.color,
    docentes: profesores.filter(p => p.scores.nivel === n.key).length,
  })).filter(n => n.docentes > 0)

  // Composición del score de los primeros docentes (barras apiladas por componente).
  const composicion = profesores.slice(0, 12).map(p => ({
    name: p.full_name.split(' ')[0] + ' ' + (p.full_name.split(' ')[2] ?? ''),
    logro: Math.round(p.scores.logro * scoring.pesos.logro),
    equidad: Math.round(p.scores.equidad * scoring.pesos.equidad),
    cobertura: Math.round(p.scores.cobertura * scoring.pesos.cobertura),
  }))

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Docentes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Desempeño de cada docente leído desde las notas de sus alumnos. Haz clic en una fila para ver su ficha.
          </p>
        </header>
        <div className="flex items-center gap-2">
          <Label className="text-muted-foreground">Área</Label>
          <Select value={course} onValueChange={setCourse}>
            <SelectTrigger size="sm" aria-label="Filtrar por área" className="w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COURSES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Docentes" value={profesores.length} />
        <Stat label="Alumnos a cargo" value={alumnos} />
        <Stat label="Promedio de sus alumnos" value={`${promedio ?? '—'}/4`} />
        <Stat label="En nivel de logro" value={`${pctLogrado}%`} tone="ok" />
      </div>

      <Section title="Distribución del scoring">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">Docentes por lectura del score compuesto.</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={porNivel} layout="vertical" margin={{ left: 40, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="nivel" fontSize={11} width={150} />
                  <Tooltip />
                  <Bar dataKey="docentes" name="Docentes" radius={[0, 4, 4, 0]}>
                    {porNivel.map(n => <Cell key={n.nivel} fill={n.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">
                Cómo se compone el score de los 12 primeros: cada tramo es el aporte ponderado de un componente.
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={composicion} margin={{ bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" fontSize={10} interval={0} angle={-30} textAnchor="end" height={56} />
                  <YAxis fontSize={12} domain={[0, 100]} />
                  <Tooltip />
                  <Legend verticalAlign="top" height={26} />
                  <Bar dataKey="logro" stackId="s" name="Logro" fill="var(--chart-1)" />
                  <Bar dataKey="equidad" stackId="s" name="Equidad" fill="var(--chart-2)" />
                  <Bar dataKey="cobertura" stackId="s" name="Cobertura" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Alumnos a cargo y promedio alcanzado">
        <Card>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" dataKey="total_evaluaciones" name="Alumnos" fontSize={12}
                  label={{ value: 'Alumnos evaluados', position: 'insideBottom', offset: -8, fontSize: 12 }} />
                <YAxis type="number" dataKey="average_score_1_to_4" name="Promedio" domain={[1, 4]} ticks={[1, 2, 3, 4]} fontSize={12}
                  label={{ value: 'Promedio (1-4)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                <ZAxis range={[70, 70]} />
                <Tooltip content={<PuntoDocente />} cursor={{ strokeDasharray: '3 3' }} />
                <Legend verticalAlign="top" height={28} />
                {['matematica', 'comunicacion'].map(key => {
                  const puntos = profesores.filter(p => p.course_key === key)
                  if (!puntos.length) return null
                  return <Scatter key={key} name={key === 'matematica' ? 'Matemática' : 'Comunicación'} data={puntos} fill={AREA_COLOR[key]} />
                })}
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Section>

      <Section title={`Todos los docentes (${profesores.length})`}>
        <Table
          head={['#', 'Docente', 'Área', 'Institución', 'Alumnos', 'Promedio', ...BUCKET_ORDER.map(b => BUCKET_LABEL[b]), 'Score', 'Lectura']}
          empty="Sin docentes con notas registradas."
          onRowClick={(i) => navigate(`/ugel/profesores/${profesores[i].dni}`)}
          rows={profesores.map(p => [
            p.ranking,
            <span key={`n-${p.dni}`} className="font-medium">{p.full_name}</span>,
            p.course_name ?? p.course_key,
            <span key={`c-${p.dni}`} className="text-muted-foreground">{p.contexto.school_name ?? '—'}</span>,
            p.total_evaluaciones,
            `${p.average_score_1_to_4 ?? '—'}/4`,
            ...BUCKET_ORDER.map(b => (
              <span key={`${b}-${p.dni}`} style={{ color: p.distribution[b].color }}>{p.distribution[b].pct}%</span>
            )),
            <span key={`s-${p.dni}`} className="font-semibold tabular-nums">{p.scores.global}</span>,
            <span key={`l-${p.dni}`} style={{ color: p.scores.nivel_color }}>{p.scores.nivel_label}</span>,
          ])}
        />
      </Section>
    </div>
  )
}
