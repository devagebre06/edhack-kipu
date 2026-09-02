import { useMemo, useState } from 'react'
import * as Iconos from 'lucide-react'
import { Search, BookOpen, type LucideIcon } from 'lucide-react'
import { GLOSARIO, type EntradaGlosario } from '@/config/glosario'
import { ArbolJerarquia } from '@/components'
import { GRAFICOS, GRAFICOS_ANCHOS as ANCHOS } from '@/components/glosario'

const icono = (nombre?: string): LucideIcon | null =>
  (nombre && (Iconos as unknown as Record<string, LucideIcon>)[nombre]) || null
import { Input } from '@/components/ui'
import { cn } from '@/lib/utils'

// ── Reparto del bento ────────────────────────────────────────────────────────
// CSS Grid no es masonry: con anchos fijos, cualquier número de tarjetas que no
// sea múltiplo exacto deja la última fila a medias. Por eso el ancho no se
// declara por tarjeta, se CALCULA: se parte la sección en filas de 2, 3 o 4
// tarjetas y cada fila reparte las 12 columnas a partes iguales (6+6, 4+4+4,
// 3+3+3+3). Así toda fila cierra exacta y no queda un solo hueco.

/** Cuántas tarjetas van en cada fila, evitando dejar una sola al final. */
function filasDe(n: number): number[] {
  const filas: number[] = []
  let restantes = n
  while (restantes > 0) {
    let k: number
    if (restantes <= 4) k = restantes
    else if (restantes % 3 === 0) k = 3
    else {
      k = 4
      if (restantes - k === 1) k = 3          // no dejar una tarjeta suelta
    }
    filas.push(k)
    restantes -= k
  }
  return filas
}

/** Cuánto "pesa" una entrada: las más densas merecen las filas más anchas. */
const peso = (e: EntradaGlosario) =>
  (e.span ?? 1) * 10 + (e.valores?.length ?? 0) * 3 + e.definicion.length / 40

/** Asigna a cada entrada el nº de columnas (de 12) que le toca. */
function repartir(entradas: EntradaGlosario[]) {
  const salida: { entrada: EntradaGlosario; cols: number }[] = []
  // Los diagramas que piden ancho ocupan su propia fila completa: una fila de una
  // sola tarjeta también suma 12, así que no rompe el «sin huecos».
  const conGrafico = entradas.filter((e) => e.grafico && ANCHOS.has(e.grafico))
  const resto = entradas.filter((e) => !(e.grafico && ANCHOS.has(e.grafico)))
  for (const entrada of conGrafico) salida.push({ entrada, cols: 12 })

  const orden = [...resto].sort((a, b) => peso(b) - peso(a))
  const filas = filasDe(orden.length).sort((a, b) => a - b) // filas anchas primero
  let i = 0
  for (const k of filas) {
    for (let j = 0; j < k; j++) salida.push({ entrada: orden[i++], cols: 12 / k })
  }
  return salida
}

function Chip({ clave, etiqueta, nota, color }: { clave: string; etiqueta: string; nota?: string; color?: string }) {
  return (
    <li className="flex items-baseline gap-2 rounded-lg border bg-background/60 px-2.5 py-1.5">
      <span
        className="mt-1 size-2 shrink-0 rounded-full"
        style={{ background: color ?? 'var(--muted-foreground)' }}
        aria-hidden
      />
      <span className="text-xs font-semibold">{clave}</span>
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      {nota && <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/80">{nota}</span>}
    </li>
  )
}

function Tarjeta({ entrada, grupo, cols, anchaEnMovil }: {
  entrada: EntradaGlosario
  grupo: string
  /** Columnas (de 12) que ocupa en pantalla grande; lo decide `repartir`. */
  cols: number
  anchaEnMovil?: boolean
}) {
  const Icono = icono(entrada.icono)
  const Grafico = entrada.grafico ? GRAFICOS[entrada.grafico] : null
  return (
    <article
      style={{ ['--cols' as string]: cols }}
      className={cn(
        'flex flex-col rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-foreground/20',
        // Las tarjetas con diagrama nunca van a media columna: no cabría.
        anchaEnMovil || entrada.grafico ? 'sm:col-span-2' : 'sm:col-span-1',
        'xl:col-[span_var(--cols)]',
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{grupo}</p>
      <h3 className="mt-1 flex items-center gap-2 text-base font-semibold tracking-tight">
        {Icono && <Icono className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        {entrada.termino}
      </h3>
      <p className="mt-1.5 max-w-[70ch] text-sm text-muted-foreground">{entrada.definicion}</p>

      {/* El árbol de jerarquía comparte fila con su leyenda; el resto de
          diagramas se dibujan a lo ancho de la tarjeta. */}
      {entrada.grafico === 'jerarquia' ? (
        <div className="grid gap-x-6 lg:grid-cols-[minmax(0,auto)_minmax(220px,1fr)]">
          <ArbolJerarquia />
          {entrada.valores && (
            <ul className="mt-3 grid content-start gap-1.5">
              {entrada.valores.map(v => <Chip key={v.clave} {...v} />)}
            </ul>
          )}
        </div>
      ) : Grafico ? (
        <Grafico />
      ) : entrada.valores && (
        <ul className={cn(
          'mt-3 grid gap-1.5',
          cols >= 6 ? 'sm:grid-cols-2' : '',
          cols === 12 ? 'lg:grid-cols-3 2xl:grid-cols-4' : '',
        )}>
          {entrada.valores.map(v => <Chip key={v.clave} {...v} />)}
        </ul>
      )}

      {(entrada.calculo || entrada.donde) && (
        <div className="mt-auto space-y-1 pt-3 text-xs">
          {entrada.calculo && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Cómo se calcula: </span>{entrada.calculo}
            </p>
          )}
          {entrada.donde && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Dónde se ve: </span>{entrada.donde}
            </p>
          )}
        </div>
      )}
    </article>
  )
}

export default function Glosario() {
  const [buscar, setBuscar] = useState('')
  const [grupo, setGrupo] = useState('')

  const texto = buscar.trim().toLowerCase()
  const grupos = useMemo(() => GLOSARIO
    .filter(g => !grupo || g.clave === grupo)
    .map(g => ({
      ...g,
      entradas: g.entradas.filter(e => {
        if (!texto) return true
        const heno = [
          e.termino, e.definicion, e.calculo ?? '', e.donde ?? '',
          ...(e.valores ?? []).flatMap(v => [v.clave, v.etiqueta, v.nota ?? '']),
        ].join(' ').toLowerCase()
        return heno.includes(texto)
      }),
    }))
    .filter(g => g.entradas.length > 0), [texto, grupo])

  const total = GLOSARIO.reduce((n, g) => n + g.entradas.length, 0)
  const visibles = grupos.reduce((n, g) => n + g.entradas.length, 0)

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BookOpen className="size-6 text-muted-foreground" /> Glosario
          </h1>
          <p className="mt-1 max-w-[75ch] text-sm text-muted-foreground">
            Qué significa cada dato de Kipu: la escala con la que se califica, cómo se arma cada indicador y de dónde
            sale cada cifra. Si un número de la plataforma no te cuadra, empieza por aquí.
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="pl-8"
            placeholder="Buscar un término…"
            aria-label="Buscar en el glosario"
          />
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setGrupo('')}
          className={cn(
            'rounded-full border px-3 py-1 text-sm transition-colors',
            !grupo ? 'border-transparent bg-primary text-primary-foreground' : 'hover:bg-muted',
          )}
        >
          Todo ({total})
        </button>
        {GLOSARIO.map(g => (
          <button
            key={g.clave}
            onClick={() => setGrupo(grupo === g.clave ? '' : g.clave)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              grupo === g.clave ? 'border-transparent bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {g.titulo} ({g.entradas.length})
          </button>
        ))}
        {texto && <span className="text-sm text-muted-foreground">{visibles} resultado{visibles !== 1 ? 's' : ''}</span>}
      </div>

      {!grupos.length && (
        <p className="mt-8 rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          Ningún término coincide con «{buscar}».
        </p>
      )}

      {grupos.map(g => (
        <section key={g.clave} className="mt-8">
          <div className="mb-3">
            <h2 className="text-base font-semibold tracking-tight">{g.titulo}</h2>
            <p className="text-sm text-muted-foreground">{g.descripcion}</p>
          </div>
          {/* Bento: filas de 12 columnas repartidas para que ninguna quede a medias. */}
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-12">
            {repartir(g.entradas).map(({ entrada, cols }, i, todas) => (
              <Tarjeta
                key={entrada.termino}
                entrada={entrada}
                grupo={g.titulo}
                cols={cols}
                // En dos columnas, la última impar se estira para no dejar hueco.
                anchaEnMovil={i === todas.length - 1 && todas.length % 2 === 1}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
