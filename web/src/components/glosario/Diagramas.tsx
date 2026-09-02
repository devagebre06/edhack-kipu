// Diagramas del glosario para la sección «Aprendizaje». Cada uno explica de un
// vistazo algo que en texto se lee lento: la escala ordinal, cómo se promedia
// una nota, qué competencias tiene cada área, el calendario del año y qué es
// «avanzar». Son SVG/flex con tokens de tema, sin dependencias.
import { Calculator, BookOpenText, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const NIVELES = [
  { codigo: 'C', nombre: 'En inicio', valor: 1, color: '#D32F2F' },
  { codigo: 'B', nombre: 'En proceso', valor: 2, color: '#FBC02D' },
  { codigo: 'A', nombre: 'Logro esperado', valor: 3, color: '#43A047' },
  { codigo: 'AD', nombre: 'Logro destacado', valor: 4, color: '#2E7D32' },
]

/** Regla de los cuatro niveles: deja ver que la escala es ordinal y creciente. */
export function EscalaLogro() {
  return (
    <figure className="mt-3">
      <div className="flex overflow-hidden rounded-lg border">
        {NIVELES.map((n) => (
          <div key={n.codigo} className="flex-1 border-r last:border-r-0">
            <div className="h-1.5" style={{ background: n.color }} />
            <div className="px-2.5 py-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold" style={{ color: n.color }}>{n.codigo}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">= {n.valor}</span>
              </div>
              <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{n.nombre}</div>
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>◀ menor logro</span>
        <span>mayor logro ▶</span>
      </figcaption>
    </figure>
  )
}

/** Cómo se arma la nota general: competencias → promedio → nivel. */
export function FormulaNotaGeneral() {
  const ejemplo = [
    { c: 'C1', n: 'A', v: 3 },
    { c: 'C2', n: 'A', v: 3 },
    { c: 'C3', n: 'B', v: 2 },
    { c: 'C4', n: 'AD', v: 4 },
  ]
  const promedio = ejemplo.reduce((s, e) => s + e.v, 0) / ejemplo.length
  const color = (n: string) => NIVELES.find((x) => x.codigo === n)?.color

  return (
    <figure className="mt-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {ejemplo.map((e, i) => (
          <span key={e.c} className="flex items-center gap-2">
            <span className="rounded-md border px-2 py-1 text-xs">
              <span className="text-muted-foreground">{e.c} </span>
              <span className="font-semibold" style={{ color: color(e.n) }}>{e.n}</span>
              <span className="ml-1 tabular-nums text-muted-foreground">({e.v})</span>
            </span>
            {i < ejemplo.length - 1 && <span className="text-muted-foreground">+</span>}
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">÷ {ejemplo.length} competencias =</span>
        <span className="rounded-md bg-muted px-2 py-1 font-semibold tabular-nums">{promedio.toFixed(2)}</span>
        <span className="text-muted-foreground">→ se redondea →</span>
        <span className="rounded-md px-2 py-1 font-semibold text-white" style={{ background: color('A') }}>
          A · Logro esperado
        </span>
      </div>
      <figcaption className="mt-2 text-[11px] text-muted-foreground">
        Ejemplo con Matemática (4 competencias). En Comunicación son 3.
      </figcaption>
    </figure>
  )
}

const AREAS = [
  {
    area: 'Matemática', icono: Calculator, color: 'var(--chart-1)',
    competencias: [
      'Resuelve problemas de cantidad',
      'Regularidad, equivalencia y cambio',
      'Forma, movimiento y localización',
      'Gestión de datos e incertidumbre',
    ],
  },
  {
    area: 'Comunicación', icono: BookOpenText, color: 'var(--chart-2)',
    competencias: [
      'Se comunica oralmente en su lengua materna',
      'Lee diversos tipos de textos escritos',
      'Escribe diversos tipos de textos',
    ],
  },
]

/** Las competencias agrupadas por área, que es como el docente las piensa. */
export function CompetenciasPorArea() {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {AREAS.map(({ area, icono: Icono, color, competencias }) => (
        <figure key={area} className="rounded-lg border p-3">
          <figcaption className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md" style={{ background: color }}>
              <Icono className="size-4 text-white" />
            </span>
            <span className="text-sm font-semibold">{area}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {competencias.length} competencias
            </span>
          </figcaption>
          <ol className="mt-2 space-y-1">
            {competencias.map((c, i) => (
              <li key={c} className="flex items-baseline gap-2 text-xs">
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 font-semibold tabular-nums"
                  style={{ background: color, color: 'white' }}
                >
                  C{i + 1}
                </span>
                <span className="text-muted-foreground">{c}</span>
              </li>
            ))}
          </ol>
        </figure>
      ))}
    </div>
  )
}

const PERIODOS = [
  { nombre: 'Diagnóstico', fecha: '20 mar', nota: 'foto inicial', hito: true },
  { nombre: 'Bimestre 1', fecha: '15 may' },
  { nombre: 'Bimestre 2', fecha: '31 jul' },
  { nombre: 'Bimestre 3', fecha: '9 oct' },
  { nombre: 'Bimestre 4', fecha: '18 dic' },
]

/** El año escolar como línea de tiempo: se ve que el diagnóstico abre la serie. */
export function LineaTiempoPeriodos() {
  return (
    <figure className="mt-3">
      <div className="relative">
        {/* Riel */}
        <div className="absolute inset-x-0 top-[7px] h-px bg-border" aria-hidden />
        <ol className="relative flex justify-between gap-2">
          {PERIODOS.map((p) => (
            <li key={p.nombre} className="flex min-w-0 flex-1 flex-col items-center text-center">
              <span
                className={cn(
                  'size-3.5 rounded-full border-2 border-background',
                  p.hito ? 'bg-primary' : 'bg-muted-foreground/60',
                )}
              />
              <span className="mt-1.5 text-[11px] font-medium leading-tight">{p.nombre}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">{p.fecha}</span>
              {p.nota && <span className="text-[10px] text-muted-foreground/80">{p.nota}</span>}
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="mt-2 text-[11px] text-muted-foreground">
        Las series de notas usan la fecha de cierre de cada periodo.
      </figcaption>
    </figure>
  )
}

/** Sparkline del avance: la misma forma que ve el usuario en la ficha del alumno. */
export function MiniAvance() {
  const puntos = [2.1, 2.4, 2.5, 2.8, 3.0]
  const ancho = 220
  const alto = 56
  const min = 1
  const max = 4
  const x = (i: number) => (i / (puntos.length - 1)) * (ancho - 8) + 4
  const y = (v: number) => alto - 6 - ((v - min) / (max - min)) * (alto - 14)
  const d = puntos.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(v)}`).join(' ')
  const delta = (puntos[puntos.length - 1] - puntos[0]).toFixed(1)

  return (
    <figure className="mt-3 flex items-center gap-4 rounded-lg border p-3">
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="h-14 w-full max-w-[220px]" role="img"
        aria-label="Ejemplo de avance: la nota sube del diagnóstico al último bimestre">
        <path d={`${d} L ${x(puntos.length - 1)} ${alto} L ${x(0)} ${alto} Z`} className="fill-success/10" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth={2} className="text-success" />
        {puntos.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={2.5} className="fill-success" />
        ))}
      </svg>
      <div className="shrink-0">
        <div className="flex items-baseline gap-1.5">
          <TrendingUp className="size-4 text-success" />
          <span className="text-lg font-semibold tabular-nums text-success">+{delta}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          de {puntos[0].toFixed(1)} a {puntos[puntos.length - 1].toFixed(1)} · ejemplo
        </div>
      </div>
    </figure>
  )
}

/** Miniatura del acta diagnóstica: la nómina con una columna por competencia. */
export function ActaDiagnostica() {
  const filas = [
    ['Alumno 1', 'A', 'AD', 'B', 'A'],
    ['Alumno 2', 'B', 'B', 'C', 'B'],
    ['Alumno 3', 'AD', 'A', 'A', 'AD'],
  ]
  const color = (n: string) => NIVELES.find((x) => x.codigo === n)?.color
  return (
    <figure className="mt-3 overflow-hidden rounded-lg border">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">Acta · 1° A · Matemática</span>
        <span className="ml-auto">C1 · C2 · C3 · C4</span>
      </div>
      <table className="w-full text-[11px]">
        <tbody>
          {filas.map((f) => (
            <tr key={f[0]} className="border-b last:border-b-0">
              <td className="px-3 py-1 text-muted-foreground">{f[0]}</td>
              {f.slice(1).map((n, i) => (
                <td key={i} className="px-1 py-1 text-center font-semibold" style={{ color: color(n) }}>{n}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
