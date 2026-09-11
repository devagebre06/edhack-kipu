import { Fragment, useEffect, useRef, useState } from 'react'
import {
  ScrollText, Cpu, Server, FileText, Layers, ChevronDown, ChevronUp, Copy, Check, ShieldCheck, ExternalLink, FileBadge,
  Play, Pause, RotateCcw, ArrowRight, ArrowDown, CornerDownRight,
} from 'lucide-react'
import { useConfigEvaluacion, useProfile } from '@/hooks'
import { Section, Spinner, Stat } from '@/components'
import { Button, Card, CardContent } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { PasoEvaluacion } from '@/types'

const TIPO = { UNIDAD: 'Unidad', SESION: 'Sesión' } as const
type Tipo = keyof typeof TIPO

const COLOR_VAL: Record<string, string> = {
  LOGRADO: '#43A047', PROCESO: '#FBC02D', INICIO: '#D32F2F',
  NO_EVIDENCIADO: '#94a3b8', NO_APLICA: '#94a3b8',
}
const COLOR_ESTADO: Record<string, string> = {
  APPROVED: '#43A047', NEEDS_REVISION: '#FBC02D', MANUAL_REVIEW: '#94a3b8', PROCESSING_ERROR: '#D32F2F',
}

/** Nodo del pipeline: número, quién lo ejecuta y etiqueta corta. */
function Nodo({ paso, n, estado, onClick, refNodo }: {
  paso: PasoEvaluacion
  n: number
  estado: 'pendiente' | 'activo' | 'hecho'
  onClick: () => void
  refNodo: (el: HTMLButtonElement | null) => void
}) {
  const Icono = paso.quien === 'IA' ? Cpu : Server
  const activo = estado === 'activo'
  const hecho = estado === 'hecho'
  return (
    <button
      ref={refNodo}
      type="button"
      role="tab"
      id={`paso-tab-${paso.clave}`}
      aria-selected={activo}
      aria-controls="paso-detalle"
      tabIndex={activo ? 0 : -1}
      onClick={onClick}
      title={paso.titulo}
      className="group flex w-[7.5rem] shrink-0 flex-col items-center gap-1.5 rounded-lg px-1 py-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-auto lg:flex-1"
    >
      <span
        className={cn(
          'relative grid size-11 place-items-center rounded-full border-2 transition-all duration-300',
          activo && 'scale-110 border-primary bg-primary text-primary-foreground shadow-sm',
          hecho && 'border-primary/50 bg-primary/10 text-primary',
          estado === 'pendiente' && 'border-border bg-card text-muted-foreground group-hover:border-primary/40',
        )}
      >
        <Icono className="size-4.5" />
        <span
          className={cn(
            'absolute -right-1 -top-1 grid size-4.5 place-items-center rounded-full border text-[10px] font-semibold tabular-nums',
            activo || hecho ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
          )}
        >
          {n}
        </span>
      </span>
      <span className={cn('text-xs leading-tight', activo ? 'font-semibold' : 'text-muted-foreground')}>
        {paso.etiqueta}
      </span>
      <span className={cn(
        'text-[10px] uppercase tracking-wide',
        paso.quien === 'IA' ? 'text-primary/80' : 'text-muted-foreground/70',
      )}>
        {paso.quien === 'IA' ? 'IA' : 'servidor'}
      </span>
    </button>
  )
}

/** Conector entre dos nodos: se rellena conforme avanza el recorrido. */
function Conector({ lleno }: { lleno: boolean }) {
  return (
    <span aria-hidden className="mt-[1.375rem] hidden h-0.5 w-6 shrink-0 self-start overflow-hidden rounded-full bg-border sm:block lg:w-auto lg:min-w-6 lg:flex-1">
      <span className={cn('block h-full bg-primary transition-all duration-500', lleno ? 'w-full' : 'w-0')} />
    </span>
  )
}

/** Detalle del paso seleccionado: qué entra, qué sale y qué prompt se usa. */
function DetallePaso({ paso, n, total, prompts, onVerPrompt }: {
  paso: PasoEvaluacion
  n: number
  total: number
  prompts: { clave: string; titulo: string }[]
  onVerPrompt: (clave: string) => void
}) {
  const Icono = paso.quien === 'IA' ? Cpu : Server
  const usados = prompts.filter(p => paso.prompts.includes(p.clave))
  return (
    <div
      id="paso-detalle"
      role="tabpanel"
      aria-labelledby={`paso-tab-${paso.clave}`}
      className="rounded-xl border bg-card p-4 shadow-xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs tabular-nums text-muted-foreground">Paso {n} de {total}</span>
        <span className="font-medium">{paso.titulo}</span>
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
          paso.quien === 'IA' ? 'border-primary/40 text-primary' : 'text-muted-foreground',
        )}>
          <Icono className="size-3" /> {paso.quien === 'IA' ? 'Lo hace la IA' : 'Lo hace el servidor'}
        </span>
        {paso.aplica.length === 1 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            solo en sesiones
          </span>
        )}
      </div>

      <p className="mt-2 max-w-[80ch] text-sm text-muted-foreground">{paso.descripcion}</p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="flex-1 rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Entra</p>
          <p className="mt-0.5 text-sm">{paso.entrada}</p>
        </div>
        <span className="grid shrink-0 place-items-center text-muted-foreground">
          <ArrowRight className="hidden size-4 sm:block" />
          <ArrowDown className="size-4 sm:hidden" />
        </span>
        <div className="flex-1 rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sale</p>
          <p className="mt-0.5 text-sm">{paso.salida}</p>
        </div>
      </div>

      {paso.devuelve && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Campos que devuelve: {paso.devuelve.documentos.join(', ')} · {paso.devuelve.identificacion.join(', ')}
        </p>
      )}

      {usados.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-[11px] text-muted-foreground">Prompt que se envía aquí:</span>
          {usados.map(p => (
            <Button key={p.clave} variant="outline" size="sm" onClick={() => onVerPrompt(p.clave)}>
              <CornerDownRight className="size-3.5" /> {p.titulo}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Prompt desplegable, con copiar al portapapeles. Lo abre también el pipeline. */
function BloquePrompt({ clave, titulo, cuando, texto, abierto, onToggle }: {
  clave: string
  titulo: string
  cuando: string
  texto: string
  abierto: boolean
  onToggle: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch { /* el navegador puede bloquear el portapapeles */ }
  }
  return (
    <div
      id={`prompt-${clave}`}
      className={cn('overflow-hidden rounded-xl border bg-card shadow-xs transition-colors scroll-mt-20', abierto && 'border-primary/50')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button onClick={onToggle} className="flex min-w-0 items-center gap-2 text-left">
          {abierto ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
          <span className="min-w-0">
            <span className="block text-sm font-medium">{titulo}</span>
            <span className="block text-xs text-muted-foreground">{cuando}</span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {texto.length.toLocaleString('es-PE')} caracteres
          </span>
          <Button variant="ghost" size="sm" onClick={copiar}>
            {copiado ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      </div>
      {abierto && (
        <pre className="max-h-[28rem] overflow-auto border-t bg-muted/40 px-4 py-3 text-[11px] leading-relaxed whitespace-pre-wrap">
          {texto}
        </pre>
      )}
    </div>
  )
}

export default function ComoSeEvalua() {
  const { data, isLoading, error } = useConfigEvaluacion()
  const docente = useProfile()?.role === 'teacher'
  const [tipo, setTipo] = useState<Tipo>('SESION')
  const [activo, setActivo] = useState(0)
  const [reproduciendo, setReproduciendo] = useState(false)
  const [promptAbierto, setPromptAbierto] = useState<string | null>(null)
  const nodos = useRef<(HTMLButtonElement | null)[]>([])

  const pasosDelTipo = (data?.pasos ?? []).filter(p => p.aplica.includes(tipo))
  const ultimo = pasosDelTipo.length - 1

  // Reproducción automática: avanza un paso cada 2.2 s y se detiene al final.
  useEffect(() => {
    if (!reproduciendo || ultimo < 0) return
    const t = setTimeout(() => {
      setActivo(i => {
        if (i >= ultimo) { setReproduciendo(false); return i }
        return i + 1
      })
    }, 2200)
    return () => clearTimeout(t)
  }, [reproduciendo, activo, ultimo])

  // El nodo activo siempre visible en el riel (que hace scroll horizontal en móvil).
  useEffect(() => {
    nodos.current[activo]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [activo])

  const irA = (i: number) => { setReproduciendo(false); setActivo(i) }
  const cambiarTipo = (t: Tipo) => { setTipo(t); setActivo(0); setReproduciendo(false) }
  const verPrompt = (clave: string) => {
    setPromptAbierto(clave)
    requestAnimationFrame(() =>
      document.getElementById(`prompt-${clave}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
    )
  }
  // Flechas para recorrer el pipeline con el teclado.
  const teclas = (e: React.KeyboardEvent) => {
    const paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!paso) return
    e.preventDefault()
    irA(Math.min(ultimo, Math.max(0, activo + paso)))
    nodos.current[Math.min(ultimo, Math.max(0, activo + paso))]?.focus()
  }

  if (isLoading) return <Spinner text="Cargando el método de evaluación…" />
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Cómo se evalúa</h1>
        <p className="mt-6 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {error ? `No se pudo cargar: ${(error as Error).message}` : 'Sin datos.'}
        </p>
      </div>
    )
  }

  const { motor, decisiones, rubrica, prompts } = data
  const paso = pasosDelTipo[Math.min(activo, ultimo)]
  const porDimension = rubrica.dimensiones.map(d => ({
    ...d,
    items: rubrica.items.filter(i => i.dimension === d.clave),
  }))
  const aplicables = rubrica.items.filter(i => !i.excluido).length

  return (
    <div>
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ScrollText className="size-6 text-muted-foreground" />
          {docente ? 'Cómo se evalúa tu trabajo' : 'Cómo se evalúa el trabajo docente'}
        </h1>
        <p className="mt-1 max-w-[80ch] text-sm text-muted-foreground">
          Todo lo que la plataforma usa para valorar {docente ? 'tus unidades y sesiones' : 'las unidades y sesiones'}:
          el recorrido que sigue cada entrega, la ficha de monitoreo con la que se compara y las instrucciones
          exactas que recibe la IA. Nada de esto es secreto — si un resultado no
          {docente ? ' te cuadra' : ' cuadra'}, aquí está el porqué.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Ítems que puntúan" value={`${aplicables} de ${rubrica.items.length}`} />
        <Stat label="Puntaje mínimo para ser válida" value={`${motor.puntaje_minimo_valida}/100`} />
        <Stat label="Desempeños de aula" value={rubrica.desempenos.length} />
        <Stat label="Rúbrica" value={<span className="text-base">{motor.rubrica_version}</span>} />
      </div>

      {/* ── Recorrido (pipeline interactivo) ── */}
      <Section
        title="El recorrido de una entrega"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border" role="group" aria-label="Tipo de entrega">
              {(Object.keys(TIPO) as Tipo[]).map(t => (
                <button
                  key={t}
                  onClick={() => cambiarTipo(t)}
                  aria-pressed={tipo === t}
                  className={cn(
                    'px-3 py-1.5 text-sm transition-colors',
                    tipo === t ? 'bg-primary font-medium text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {TIPO[t]}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (reproduciendo) return setReproduciendo(false)
                if (activo >= ultimo) setActivo(0)
                setReproduciendo(true)
              }}
            >
              {reproduciendo ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {reproduciendo ? 'Pausar' : 'Reproducir'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => irA(0)} disabled={activo === 0 && !reproduciendo}>
              <RotateCcw className="size-3.5" /> Reiniciar
            </Button>
          </div>
        }
      >
        <p className="mb-4 max-w-[80ch] text-sm text-muted-foreground">
          {tipo === 'SESION'
            ? 'Una sesión pasa por un paso más que una unidad: se comprueba que pertenezca a la unidad que elegiste.'
            : 'Una unidad se evalúa por sí sola: no tiene un documento «padre» contra el que contrastarla.'}
          {' '}Haz clic en cualquier paso —o dale a reproducir— para ver qué entra y qué sale de él.
        </p>

        <div
          role="tablist"
          aria-label="Pasos de la evaluación"
          onKeyDown={teclas}
          className="-mx-1 flex items-start gap-1 overflow-x-auto px-1 pb-2 sm:gap-0"
        >
          {pasosDelTipo.map((p, i) => (
            <Fragment key={p.clave}>
              {i > 0 && <Conector lleno={i <= activo} />}
              <Nodo
                paso={p}
                n={i + 1}
                estado={i === activo ? 'activo' : i < activo ? 'hecho' : 'pendiente'}
                onClick={() => irA(i)}
                refNodo={el => { nodos.current[i] = el }}
              />
            </Fragment>
          ))}
        </div>

        <div className="mt-3">
          {paso && (
            <DetallePaso
              paso={paso}
              n={activo + 1}
              total={pasosDelTipo.length}
              prompts={prompts}
              onVerPrompt={verPrompt}
            />
          )}
        </div>
      </Section>

      {/* ── Estados y validez ── */}
      <Section title="Cómo se decide el resultado">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent>
              <p className="mb-2 text-sm font-medium">El estado de la entrega</p>
              <ul className="space-y-1.5">
                {decisiones.map(d => (
                  <li key={d.estado} className="flex items-baseline gap-2 text-sm">
                    <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: COLOR_ESTADO[d.estado] }} />
                    <span className="font-medium">{d.label}</span>
                    <span className="text-xs text-muted-foreground">{d.regla}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Nivel global: promedio ≥ {motor.cortes_nivel[0].desde} logrado · ≥ {motor.cortes_nivel[1].desde} en proceso · por debajo, inicio.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="size-4 text-muted-foreground" /> Que cuente como válida es otra cosa
              </p>
              <p className="text-sm text-muted-foreground">
                Tu entrega <strong>siempre queda registrada</strong>, aunque necesite corrección. La validez decide
                si cuenta como unidad o sesión completa:
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                <li className="flex gap-2">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  Alcanzar al menos <strong>{motor.puntaje_minimo_valida}/100</strong> de puntaje.
                </li>
                <li className="flex gap-2">
                  <Layers className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  Si es una <strong>sesión</strong>, pertenecer al área y los temas de su unidad.
                </li>
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Si no se cumple, verás el motivo concreto junto a la entrega.
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── Rúbrica ── */}
      <Section title="La ficha de monitoreo (Sección II)">
        {/* De dónde sale la rúbrica: el documento oficial, descargable. */}
        <div className="mb-4 overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="flex flex-wrap items-start gap-3 p-4">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileBadge className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Documento del que sale esta rúbrica
              </p>
              <p className="mt-0.5 text-sm font-medium">{rubrica.fuente.titulo}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{rubrica.fuente.asunto}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {rubrica.fuente.emisor} · {new Date(`${rubrica.fuente.fecha}T00:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}Expediente {rubrica.fuente.expediente}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {rubrica.fuente.secciones.map(s => (
                  <li key={s} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{s}</li>
                ))}
              </ul>
            </div>
          </div>
          <a
            href={rubrica.fuente.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <ExternalLink className="size-3.5 shrink-0" />
            Ver el documento completo (PDF)
          </a>
        </div>

        <p className="mb-3 max-w-[80ch] text-sm text-muted-foreground">
          {rubrica.nota_excluidos} Hoy puntúan <strong>{aplicables} ítems</strong>, agrupados en cuatro dimensiones.
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {porDimension.map(d => (
            <div key={d.clave} className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                  {d.clave}
                </span>
                <span className="text-sm font-medium">{d.nombre}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {d.items.filter(i => !i.excluido).length} de {d.items.length} puntúan
                </span>
              </div>
              <ol className="mt-2 space-y-1">
                {d.items.map(i => (
                  <li key={i.numero} className={cn('flex items-baseline gap-2 text-xs', i.excluido && 'opacity-50')}>
                    <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">{i.numero}</span>
                    <span className={cn(i.excluido && 'line-through')}>{i.nombre}</span>
                    {i.excluido && <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">excluido</span>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card>
            <CardContent>
              <p className="mb-2 text-sm font-medium">Cómo se valora cada ítem</p>
              <ul className="space-y-1.5">
                {rubrica.valoraciones.map(v => (
                  <li key={v.codigo} className="flex items-baseline gap-2 text-sm">
                    <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: COLOR_VAL[v.codigo] }} />
                    <span className="font-medium" style={{ color: COLOR_VAL[v.codigo] }}>{v.label}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {v.puntaje == null ? 'sin puntaje' : `${v.puntaje} pts`}
                    </span>
                    <span className="text-xs text-muted-foreground">{v.nota}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-2 text-sm font-medium">Sección III · Desempeños de aula</p>
              <ol className="space-y-1 text-sm">
                {rubrica.desempenos.map(d => (
                  <li key={d.numero} className="flex items-baseline gap-2">
                    <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">{d.numero}</span>
                    <span className="text-muted-foreground">{d.nombre}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                {rubrica.nota_desempenos}
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── Prompts ── */}
      <Section title="Las instrucciones que recibe la IA">
        <p className="mb-3 max-w-[80ch] text-sm text-muted-foreground">
          Estos son los textos exactos que se envían al modelo, tal como los genera la plataforma. Donde dice
          «aquí va el documento» se inserta tu entrega convertida a texto.
        </p>
        <div className="space-y-2">
          {prompts.map(p => (
            <BloquePrompt
              key={p.clave}
              {...p}
              abierto={promptAbierto === p.clave}
              onToggle={() => setPromptAbierto(v => (v === p.clave ? null : p.clave))}
            />
          ))}
        </div>
      </Section>

      <Section title="Ficha técnica">
        <Card>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Modelo', (
                  <a
                    key="modelo"
                    href={motor.modelo_docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-primary"
                  >
                    {motor.modelo} <ExternalLink className="size-3" />
                  </a>
                )],
                ['Versión de la rúbrica', motor.rubrica_version],
                ['Versión del prompt', motor.prompt_version],
                ['Formatos aceptados', motor.formatos.join(', ')],
                ['Tamaño máximo', `${motor.max_mb} MB`],
                ['Confianza mínima', `${motor.confianza_minima} (por debajo va a revisión humana)`],
                ['Texto máximo analizado', `${motor.limite_texto.toLocaleString('es-PE')} caracteres`],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3 border-b py-1 last:border-b-0">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              La evaluación con IA siempre queda sujeta a revisión humana: acompaña la mirada del especialista, no la
              reemplaza.
            </p>
          </CardContent>
        </Card>
      </Section>
    </div>
  )
}
