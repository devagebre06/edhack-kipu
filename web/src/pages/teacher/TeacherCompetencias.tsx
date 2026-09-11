import { useState } from 'react'
import { toast } from 'sonner'
import { Target, Save, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useCompetencias, useGuardarCompetencia } from '@/hooks'
import { Section, Spinner, Stat } from '@/components'
import { Button, Card, CardContent, Textarea } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { CompetenciaDocente, DictadoCompetencias, EstadoCompetencia, MapaBucket, MapaDistribution } from '@/types'

const BUCKET_ORDER: MapaBucket[] = ['critico', 'intermedio', 'logrado']
const BUCKET_LABEL: Record<MapaBucket, string> = { critico: 'En inicio', intermedio: 'En proceso', logrado: 'En logro' }
const NIVEL_COLOR: Record<string, string> = { C: '#D32F2F', B: '#FBC02D', A: '#43A047', AD: '#2E7D32' }
const ESTADO_COLOR: Record<EstadoCompetencia, string> = {
  PENDIENTE: 'var(--muted-foreground)', FOCO: '#D32F2F', REFORZANDO: '#FBC02D', CONSOLIDADA: '#43A047',
}

function DistBar({ distribution }: { distribution: MapaDistribution }) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {BUCKET_ORDER.map(b => (
        <div key={b} style={{ width: `${distribution[b].pct}%`, background: distribution[b].color }} />
      ))}
    </div>
  )
}

function Tendencia({ avance }: { avance: number | null }) {
  if (avance == null) return <span className="text-xs text-muted-foreground">sin comparación</span>
  const Icono = avance > 0.05 ? TrendingUp : avance < -0.05 ? TrendingDown : Minus
  const color = avance > 0.05 ? 'text-success' : avance < -0.05 ? 'text-destructive' : 'text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', color)}>
      <Icono className="size-3.5" />
      {avance >= 0 ? '+' : ''}{avance.toFixed(2)} desde el diagnóstico
    </span>
  )
}

/** Tarjeta de una competencia: cómo va el grupo y cómo la está trabajando el docente. */
function TarjetaCompetencia({ c, dictadoId, estados }: {
  c: CompetenciaDocente
  dictadoId: string
  estados: { key: EstadoCompetencia; label: string; descripcion: string }[]
}) {
  const guardar = useGuardarCompetencia()
  const [plan, setPlan] = useState(c.nota)
  const sucio = plan.trim() !== (c.nota ?? '').trim()

  const cambiarEstado = (estado: EstadoCompetencia) => {
    guardar.mutate({ dictado_id: dictadoId, competencia: c.codigo, estado }, {
      onSuccess: () => toast.success(`${c.codigo} · ${estados.find(e => e.key === estado)?.label}`),
      onError: (e: any) => toast.error(e.message ?? 'No se pudo guardar.'),
    })
  }
  const guardarPlan = () => {
    guardar.mutate({ dictado_id: dictadoId, competencia: c.codigo, nota: plan }, {
      onSuccess: () => toast.success(`Plan de ${c.codigo} guardado`),
      onError: (e: any) => toast.error(e.message ?? 'No se pudo guardar.'),
    })
  }

  return (
    <article className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">{c.codigo}</span>
            <span className="text-sm font-medium">{c.nombre}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm">
              <span className="font-semibold tabular-nums" style={{ color: c.nivel ? NIVEL_COLOR[c.nivel] : undefined }}>
                {c.promedio ?? '—'}
              </span>
              <span className="text-muted-foreground">/4 · {c.nivel_nombre ?? 'sin datos'}</span>
            </span>
            <Tendencia avance={c.avance} />
            <span className="text-xs text-muted-foreground">{c.alumnos} estudiantes</span>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium"
          style={{ borderColor: ESTADO_COLOR[c.estado], color: ESTADO_COLOR[c.estado] }}
        >
          {estados.find(e => e.key === c.estado)?.label}
        </span>
      </div>

      {c.alumnos > 0 && (
        <div className="mt-3">
          <DistBar distribution={c.distribution} />
          <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-[11px] text-muted-foreground">
            {BUCKET_ORDER.map(b => (
              <span key={b}>{BUCKET_LABEL[b]}: {c.distribution[b].count} ({c.distribution[b].pct}%)</span>
            ))}
          </div>
        </div>
      )}

      {/* Lo que el docente gestiona */}
      <div className="mt-4 border-t pt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cómo la estás trabajando</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {estados.map(e => (
            <button
              key={e.key}
              type="button"
              title={e.descripcion}
              aria-pressed={c.estado === e.key}
              disabled={guardar.isPending}
              onClick={() => cambiarEstado(e.key)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                c.estado === e.key ? 'font-medium text-white' : 'hover:bg-muted',
              )}
              style={c.estado === e.key ? { background: ESTADO_COLOR[e.key], borderColor: ESTADO_COLOR[e.key] } : undefined}
            >
              {e.label}
            </button>
          ))}
        </div>

        <Textarea
          rows={2}
          value={plan}
          onChange={e => setPlan(e.target.value)}
          placeholder="Tu plan para esta competencia: qué vas a trabajar y con qué evidencia."
          className="mt-2 text-sm"
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {c.actualizado ? `Actualizado el ${new Date(c.actualizado).toLocaleDateString('es-PE')}` : 'Sin plan registrado'}
          </span>
          {sucio && (
            <Button size="sm" variant="outline" onClick={guardarPlan} disabled={guardar.isPending}>
              <Save className="size-3.5" /> Guardar plan
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

export default function TeacherCompetencias() {
  const { data, isLoading, error } = useCompetencias()

  if (isLoading) return <Spinner text="Cargando tus competencias…" />
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Mis competencias</h1>
        <p className="mt-6 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {error ? `No se pudieron cargar: ${(error as Error).message}` : 'Sin datos.'}
        </p>
      </div>
    )
  }

  const todas = data.dictados.flatMap((d: DictadoCompetencias) => d.competencias)
  const cuenta = (estado: EstadoCompetencia) => todas.filter(c => c.estado === estado).length
  const conBrecha = todas.filter(c => c.distribution.critico.pct >= 25).length

  return (
    <div>
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Target className="size-6 text-muted-foreground" /> Mis competencias
        </h1>
        <p className="mt-1 max-w-[75ch] text-sm text-muted-foreground">
          Las competencias del CNEB que trabajas en cada aula, con el desempeño real de tu grupo. Marca cómo las
          estás trabajando y anota tu plan: es tu seguimiento, no se comparte como calificación.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Competencias" value={todas.length} />
        <Stat label="En foco" value={cuenta('FOCO')} tone={cuenta('FOCO') ? 'warn' : undefined} />
        <Stat label="Consolidadas" value={cuenta('CONSOLIDADA')} tone="ok" />
        <Stat label="Con brecha (≥25% en inicio)" value={conBrecha} tone={conBrecha ? 'bad' : undefined} />
      </div>

      {data.dictados.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Todavía no tienes aulas asignadas.
        </p>
      )}

      {data.dictados.map(d => (
        <Section
          key={d.dictado_id}
          title={`${d.curso} · ${d.aula}`}
          right={
            <span className="text-xs text-muted-foreground">
              {[d.turno, d.colegio].filter(Boolean).join(' · ')}
            </span>
          }
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {d.competencias.map(c => (
              <TarjetaCompetencia key={c.codigo} c={c} dictadoId={d.dictado_id} estados={data.estados} />
            ))}
          </div>
        </Section>
      ))}

      <Card className="mt-8">
        <CardContent>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Qué significa cada estado</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {data.estados.map(e => (
              <li key={e.key} className="flex items-baseline gap-2 text-sm">
                <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: ESTADO_COLOR[e.key] }} />
                <span className="font-medium">{e.label}</span>
                <span className="text-xs text-muted-foreground">{e.descripcion}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
