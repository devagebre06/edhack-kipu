// Piezas compartidas por los diagramas del glosario. Todas usan tokens de tema
// (bg-card, border, muted-foreground) y colores de dominio pasados por prop, así
// que funcionan igual en claro y en oscuro.
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Colores de dominio, los mismos que usan el mapa, las alertas y el scoring. */
export const COLOR = {
  critico: '#D32F2F',
  intermedio: '#FBC02D',
  logrado: '#43A047',
  destacado: '#2E7D32',
  neutro: '#94a3b8',
  critica: '#7f1d1d',
} as const

/** Envoltorio común: el diagrama y su pie explicativo. */
export function Marco({ children, pie, className }: {
  children: React.ReactNode; pie?: React.ReactNode; className?: string
}) {
  return (
    <figure className={cn('mt-3', className)}>
      {children}
      {pie && <figcaption className="mt-2 text-[11px] text-muted-foreground">{pie}</figcaption>}
    </figure>
  )
}

/** Barra apilada con leyenda: para distribuciones y composiciones. */
export function BarraApilada({ segmentos, alto = 'h-3', leyenda = true }: {
  segmentos: { etiqueta: string; valor: number; color: string; nota?: string }[]
  alto?: string
  leyenda?: boolean
}) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0) || 1
  return (
    <div>
      <div className={cn('flex overflow-hidden rounded-full', alto)}>
        {segmentos.map((s) => (
          <div
            key={s.etiqueta}
            style={{ width: `${(s.valor / total) * 100}%`, background: s.color }}
            title={`${s.etiqueta}: ${s.valor}`}
          />
        ))}
      </div>
      {leyenda && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {segmentos.map((s) => (
            <li key={s.etiqueta} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              <span className="text-muted-foreground">{s.etiqueta}</span>
              <span className="font-medium tabular-nums">{s.nota ?? `${Math.round((s.valor / total) * 100)}%`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Cadena de pasos con flechas: procesos y transformaciones. */
export function Flujo({ pasos, className }: {
  pasos: { titulo: string; sub?: string; color?: string }[]
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-2', className)}>
      {pasos.map((p, i) => (
        <span key={p.titulo} className="flex items-center gap-2">
          <span
            className="rounded-lg border px-2.5 py-1.5 text-center"
            style={p.color ? { borderColor: p.color } : undefined}
          >
            <span className="block text-xs font-medium" style={p.color ? { color: p.color } : undefined}>
              {p.titulo}
            </span>
            {p.sub && <span className="block text-[10px] text-muted-foreground">{p.sub}</span>}
          </span>
          {i < pasos.length - 1 && <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/60" />}
        </span>
      ))}
    </div>
  )
}

/** Regla 0-100 con tramos de color: umbrales y lecturas. */
export function Regla({ tramos, marca }: {
  tramos: { desde: number; etiqueta: string; color: string }[]
  marca?: { valor: number; etiqueta: string }
}) {
  const anchos = tramos.map((t, i) => (i === tramos.length - 1 ? 100 : tramos[i + 1].desde) - t.desde)
  return (
    <div>
      <div className="relative">
        <div className="flex h-2.5 overflow-hidden rounded-full">
          {tramos.map((t, i) => (
            <div key={t.etiqueta} style={{ width: `${anchos[i]}%`, background: t.color }} />
          ))}
        </div>
        {marca && (
          <div className="absolute -top-1 flex -translate-x-1/2 flex-col items-center" style={{ left: `${marca.valor}%` }}>
            <span className="size-4 rounded-full border-2 border-background bg-foreground" />
            <span className="mt-0.5 whitespace-nowrap text-[10px] font-medium">{marca.etiqueta}</span>
          </div>
        )}
      </div>
      <ul className={cn('flex text-[10px] text-muted-foreground', marca && 'mt-5')}>
        {tramos.map((t, i) => (
          <li key={t.etiqueta} style={{ width: `${anchos[i]}%` }} className="pr-1">
            <span className="block font-medium tabular-nums" style={{ color: t.color }}>{t.desde}+</span>
            <span className="block leading-tight">{t.etiqueta}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Fila etiqueta → valor, para comparaciones y fichas. */
export function Fila({ etiqueta, valor, color, barra }: {
  etiqueta: string; valor: string; color?: string; barra?: number
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 text-muted-foreground">{etiqueta}</span>
      {barra != null && (
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full" style={{ width: `${barra}%`, background: color ?? 'var(--primary)' }} />
        </span>
      )}
      <span className="shrink-0 font-semibold tabular-nums" style={color ? { color } : undefined}>{valor}</span>
    </div>
  )
}
