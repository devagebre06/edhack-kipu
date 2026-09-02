import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from 'recharts'
import { ArrowLeft } from 'lucide-react'
import { periodoCorto } from '@/config/labels'
import { useAlumno } from '@/hooks'
import { Section, Spinner, Stat, Table } from '@/components'
import { Card, CardContent } from '@/components/ui'

const AREA_COLOR: Record<string, string> = { matematica: 'var(--chart-1)', comunicacion: 'var(--chart-2)' }
const NIVEL_COLOR: Record<string, string> = { C: '#D32F2F', B: '#FBC02D', A: '#43A047', AD: '#2E7D32' }
const signo = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}`)

export default function UgelAlumnoDetalle() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useAlumno(id)

  if (isLoading) return <Spinner text="Cargando ficha del alumno…" />
  if (isError || !data) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No se encontró al alumno solicitado.</p>
        <Link to="/ugel/alumnos" className="mt-3 inline-block text-sm underline">Volver a Alumnos</Link>
      </div>
    )
  }

  const { alumno: a, docentes, serie, detalle, competencias } = data
  // Áreas presentes en la serie (cada una es una línea del gráfico).
  const areas = docentes.map(d => ({ key: d.course_key, label: d.curso_nombre ?? d.course_key }))

  return (
    <div>
      <button onClick={() => navigate('/ugel/alumnos')}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Alumnos
      </button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{a.alumno_nombre}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[a.aula_nombre, a.turno].filter(Boolean).join(' · ')} · {a.colegio_nombre ?? '—'}
            {a.alumno_codigo ? ` · código ${a.alumno_codigo}` : ''}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-5 py-3 text-right shadow-xs">
          <div className="text-3xl font-semibold tabular-nums"
            style={{ color: a.nivel_actual ? NIVEL_COLOR[a.nivel_actual] : undefined }}>
            {a.promedio_actual ?? '—'}<span className="text-base text-muted-foreground">/4</span>
          </div>
          <div className="text-xs" style={{ color: a.nivel_actual ? NIVEL_COLOR[a.nivel_actual] : undefined }}>
            {a.nivel_actual_nombre ?? 'Sin nota'}
          </div>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Diagnóstico" value={`${a.promedio_diagnostico ?? '—'}/4`} />
        <Stat label="Actual" value={`${a.promedio_actual ?? '—'}/4`} />
        <Stat label="Avance" value={signo(a.delta)} tone={(a.delta ?? 0) >= 0 ? 'ok' : 'bad'} />
        <Stat label="Evaluaciones" value={a.notas} />
      </div>

      <Section title="Notas en el tiempo">
        {serie.length > 1 ? (
          <Card>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">
                Nota de cada área en la escala de logro (1 = En inicio · 4 = Logro destacado).
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={serie} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="periodo" fontSize={11} interval={0} tickFormatter={periodoCorto} />
                  <YAxis domain={[1, 4]} ticks={[1, 2, 3, 4]} fontSize={12}
                    label={{ value: 'Nivel de logro (1-4)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                  <Tooltip />
                  <Legend verticalAlign="top" height={28} />
                  <ReferenceLine y={2} stroke="var(--border)" strokeDasharray="4 4" />
                  {areas.map(ar => (
                    <Line key={ar.key} type="monotone" dataKey={ar.key} name={ar.label}
                      stroke={AREA_COLOR[ar.key] ?? 'var(--chart-3)'} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                  ))}
                  <Line type="monotone" dataKey="promedio" name="Promedio" stroke="var(--muted-foreground)"
                    strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">Este alumno tiene una sola evaluación registrada.</p>
        )}
      </Section>

      <Section title="Sus docentes">
        <div className="grid gap-3 sm:grid-cols-2">
          {docentes.map(d => (
            <div key={d.course_key} className="rounded-lg border bg-card p-4 shadow-xs">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{d.curso_nombre}</div>
              <div className="mt-1 font-medium">{d.profesor_nombre ?? '—'}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Detalle de notas">
        <Table
          head={['Evaluación', 'Fecha', 'Área', 'Nota', 'Nivel', 'Docente']}
          empty="Sin notas registradas."
          rows={detalle.map((d, i) => [
            d.periodo,
            d.fecha ?? '—',
            d.curso_nombre ?? d.course_key,
            <span key={`p-${i}`} className="font-semibold tabular-nums">{d.promedio ?? '—'}</span>,
            <span key={`n-${i}`} style={{ color: d.nivel ? NIVEL_COLOR[d.nivel] : undefined }}>{d.nivel_nombre ?? '—'}</span>,
            <span key={`d-${i}`} className="text-muted-foreground">{d.profesor_nombre ?? '—'}</span>,
          ])}
        />
      </Section>

      <Section title="Desempeño por competencia">
        <div className="space-y-4">
          {competencias.map(area => (
            <div key={area.course_key}>
              <h3 className="mb-2 text-sm font-medium">{area.curso_nombre}</h3>
              <Table
                head={['Competencia', ...(area.competencias[0]?.periodos.map(p => periodoCorto(p.periodo)) ?? [])]}
                empty="Sin registro por competencia."
                rows={area.competencias.map(c => [
                  <span key={`c-${c.codigo}`}>
                    <span className="font-medium">{c.codigo}</span>
                    <span className="ml-2 text-muted-foreground">{c.nombre}</span>
                  </span>,
                  ...c.periodos.map((p, i) => (
                    <span key={`${c.codigo}-${i}`} className="tabular-nums"
                      style={{ color: p.nivel ? NIVEL_COLOR[p.nivel] : undefined }}>
                      {p.nivel ?? '—'}{p.puntaje != null ? ` (${p.puntaje})` : ''}
                    </span>
                  )),
                ])}
              />
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
