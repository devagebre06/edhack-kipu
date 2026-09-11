import { useNavigate, Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from 'recharts'
import { ArrowLeft } from 'lucide-react'
import { periodoCorto } from '@/config/labels'
import { useAlumno } from '@/hooks'
import { Section } from './Section'
import { Spinner } from './Spinner'
import { Stat } from './Stat'
import { Table } from './Table'
import { Card, CardContent } from './ui'
import { cn } from '@/lib/utils'

const AREA_COLOR: Record<string, string> = { matematica: 'var(--chart-1)', comunicacion: 'var(--chart-2)' }
const NIVEL_COLOR: Record<string, string> = { C: '#D32F2F', B: '#FBC02D', A: '#43A047', AD: '#2E7D32' }
const signo = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}`)

/** Promedio en la escala 1-4 con su equivalente en letra (C · B · A · AD). */
function Nota({ promedio, nivel, size = 'md' }: {
  promedio: number | null
  nivel: string | null
  size?: 'md' | 'lg'
}) {
  const color = nivel ? NIVEL_COLOR[nivel] : undefined
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="tabular-nums" style={{ color }}>
        {promedio ?? '—'}
        <span className={cn('text-muted-foreground', size === 'lg' ? 'text-base' : 'text-sm')}>/4</span>
      </span>
      {nivel && (
        <span
          className={cn(
            'rounded-md px-1.5 font-semibold leading-tight',
            size === 'lg' ? 'py-0.5 text-sm' : 'text-xs',
          )}
          style={{ background: `${color}1A`, color }}
        >
          {nivel}
        </span>
      )}
    </span>
  )
}

/** Posición del promedio en la escala 1-4, con las marcas donde cambia la letra
 *  (1.5 · 2.5 · 3.5, que es donde redondea `nivelDe` en el backend). */
function EscalaLogro({ valor, color }: { valor: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, ((valor - 1) / 3) * 100))
  return (
    <div className="mt-3">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: color }} />
        {[1.5, 2.5, 3.5].map(t => (
          <span key={t} aria-hidden
            className="absolute top-0 h-full w-px bg-foreground/25"
            style={{ left: `${((t - 1) / 3) * 100}%` }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>1</span><span>4</span>
      </div>
    </div>
  )
}

/** Tarjeta del promedio vigente: cuánto, en qué letra y dónde cae en la escala. */
function PromedioActual({ promedio, nivel, nivelNombre }: {
  promedio: number | null
  nivel: string | null
  nivelNombre: string | null
}) {
  const color = nivel ? NIVEL_COLOR[nivel] : undefined
  return (
    <div className="min-w-[14rem] rounded-xl border bg-card px-5 py-4 shadow-xs">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Promedio actual
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-3xl font-semibold tabular-nums leading-none" style={{ color }}>
          {promedio ?? '—'}
        </span>
        <span className="text-sm text-muted-foreground">/4</span>
        {nivel && (
          <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ background: `${color}26`, color }}>
            {nivel} · {nivelNombre}
          </span>
        )}
      </div>
      {promedio != null
        ? <EscalaLogro valor={promedio} color={color} />
        : <p className="mt-2 text-xs text-muted-foreground">Sin notas registradas todavía.</p>}
    </div>
  )
}

/** Ficha de un estudiante. La usan el panel UGEL y el del docente; `volverA`
 *  decide a qué listado regresa el botón de arriba. */
export function AlumnoFicha({ id, volverA, volverLabel = 'Alumnos' }: {
  id: string
  volverA: string
  volverLabel?: string
}) {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useAlumno(id)

  if (isLoading) return <Spinner text="Cargando ficha del alumno…" />
  if (isError || !data) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No se encontró al alumno solicitado.</p>
        <Link to={volverA} className="mt-3 inline-block text-sm underline">Volver a Alumnos</Link>
      </div>
    )
  }

  const { alumno: a, docentes, serie, detalle, competencias } = data
  // Áreas presentes en la serie (cada una es una línea del gráfico).
  const areas = docentes.map(d => ({ key: d.course_key, label: d.curso_nombre ?? d.course_key }))

  return (
    <div>
      <button onClick={() => navigate(volverA)}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {volverLabel}
      </button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{a.alumno_nombre}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[a.aula_nombre, a.turno].filter(Boolean).join(' · ')} · {a.colegio_nombre ?? '—'}
            {a.alumno_codigo ? ` · código ${a.alumno_codigo}` : ''}
          </p>
        </div>
        <PromedioActual
          promedio={a.promedio_actual}
          nivel={a.nivel_actual}
          nivelNombre={a.nivel_actual_nombre}
        />
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Diagnóstico" value={<Nota promedio={a.promedio_diagnostico} nivel={a.nivel_diagnostico} />} />
        <Stat label="Avance desde el diagnóstico" value={signo(a.delta)} tone={(a.delta ?? 0) >= 0 ? 'ok' : 'bad'} />
        <Stat label="Evaluaciones" value={a.notas} />
        <Stat label="Último registro" value={
          <span className="text-xl">
            {a.fecha_ultima ? new Date(`${a.fecha_ultima}T00:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          </span>
        } />
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
            <span key={`p-${i}`} className="font-semibold"><Nota promedio={d.promedio} nivel={d.nivel} /></span>,
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
