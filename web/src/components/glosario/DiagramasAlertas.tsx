// Diagramas del glosario · Alertas y procedencia de los datos.
import { Cpu, Hand, FlaskConical, ArrowRight } from 'lucide-react'
import { Marco, COLOR } from './primitivas'

/** Qué mira cada regla y con qué umbral se dispara. */
export function ReglasMotor() {
  const reglas = [
    { r: 'Aula en inicio', fuente: 'notas del último periodo', umbral: '> 30% en nivel C' },
    { r: 'Caída del promedio', fuente: 'notas de dos periodos', umbral: '≥ 0.25 puntos abajo' },
    { r: 'Evidencias observadas', fuente: 'evidencias evaluadas', umbral: '≥ 2 por corregir' },
    { r: 'Sin evidencias', fuente: 'dictados y unidades', umbral: 'ninguna entrega' },
    { r: 'Competencia rezagada', fuente: 'notas por competencia', umbral: '≤ 2.1 de promedio' },
  ]
  return (
    <Marco pie="Reejecutar el motor no duplica: si la situación ya tiene una alerta abierta, se omite.">
      <ul className="space-y-1">
        {reglas.map((x) => (
          <li key={x.r} className="grid items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] sm:grid-cols-[1fr_auto_1fr]">
            <span className="text-muted-foreground">{x.fuente}</span>
            <span className="hidden justify-self-center text-muted-foreground/60 sm:block">→</span>
            <span>
              <span className="font-medium">{x.r}</span>
              <span className="ml-1.5 rounded-full border px-1.5 py-0.5 tabular-nums text-muted-foreground">{x.umbral}</span>
            </span>
          </li>
        ))}
      </ul>
    </Marco>
  )
}

/** Escala de severidad, de menor a mayor urgencia. */
export function EscalaSeveridad() {
  const niveles = [
    { s: 'Baja', q: 'conviene mirarlo', color: COLOR.neutro },
    { s: 'Media', q: 'requiere seguimiento', color: COLOR.intermedio },
    { s: 'Alta', q: 'necesita acción pronto', color: COLOR.critico },
    { s: 'Crítica', q: 'atención inmediata', color: COLOR.critica },
  ]
  return (
    <Marco pie="La severidad la fija la regla según cuánto se aleja del umbral.">
      <ul className="space-y-1">
        {niveles.map((n, i) => (
          <li key={n.s} className="flex items-center gap-2">
            <span className="h-6 rounded-md" style={{ width: `${28 + i * 18}px`, background: n.color }} />
            <span className="text-xs font-medium">{n.s}</span>
            <span className="text-[11px] text-muted-foreground">{n.q}</span>
          </li>
        ))}
      </ul>
    </Marco>
  )
}

/** La máquina de estados por la que pasa una alerta. */
export function MaquinaEstadosAlerta() {
  const Caja = ({ t, c }: { t: string; c?: string }) => (
    <span
      className="rounded-lg border px-2.5 py-1.5 text-xs font-medium"
      style={c ? { borderColor: c, color: c } : undefined}
    >
      {t}
    </span>
  )
  return (
    <Marco pie="Cada transición queda registrada en el historial de la alerta y en la auditoría.">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Caja t="Nueva" c={COLOR.critico} />
          <ArrowRight className="size-3.5 text-muted-foreground/60" />
          <Caja t="En revisión" c={COLOR.intermedio} />
          <ArrowRight className="size-3.5 text-muted-foreground/60" />
          <Caja t="Resuelta" c={COLOR.logrado} />
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-1 text-[11px] text-muted-foreground">
          <span>desde «Nueva» también puede ir a</span>
          <Caja t="Escalada" />
          <span>o</span>
          <Caja t="Descartada" />
        </div>
      </div>
    </Marco>
  )
}

/** De dónde salió la alerta. */
export function OrigenAlerta() {
  const origenes = [
    { o: 'Motor', icono: Cpu, d: 'la generó una regla sobre los datos' },
    { o: 'Manual', icono: Hand, d: 'la creó una persona desde el panel' },
    { o: 'Demo', icono: FlaskConical, d: 'viene del sembrado de demostración' },
  ]
  return (
    <Marco>
      <ul className="space-y-1.5">
        {origenes.map(({ o, icono: Icono, d }) => (
          <li key={o} className="flex items-center gap-2.5 rounded-md border px-2.5 py-1.5">
            <Icono className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs font-medium">{o}</span>
            <span className="text-[11px] text-muted-foreground">{d}</span>
          </li>
        ))}
      </ul>
    </Marco>
  )
}

/** Qué guarda la evidencia de una alerta. */
export function EvidenciaAlerta() {
  const campos = [
    ['aula', '4° B · Mañana'],
    ['periodo', 'Bimestre 4'],
    ['alumnos', '30'],
    ['en_inicio', '9 (30%)'],
    ['promedio', '2.31'],
  ]
  return (
    <Marco pie="Con estos campos se puede verificar la alerta sin salir de ella.">
      <dl className="divide-y overflow-hidden rounded-lg border text-[11px]">
        {campos.map(([k, v]) => (
          <div key={k} className="flex justify-between px-2.5 py-1.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </Marco>
  )
}

// ── Procedencia de los datos ────────────────────────────────────────────────

/** Contraste entre una fila real y una sintética. */
export function DatoSintetico() {
  return (
    <Marco pie="La marca viaja en la propia fila, así que siempre se puede separar la demo de lo real.">
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { t: 'Real', d: 'Colegio con código MINEDU', marca: 'es_sintetico = false', color: COLOR.logrado },
          { t: 'Sintético', d: 'Alumno «Aarón Mamani Ubaldo»', marca: 'es_sintetico = true', color: COLOR.intermedio },
        ].map((x) => (
          <div key={x.t} className="rounded-lg border p-2.5" style={{ borderColor: x.color }}>
            <div className="text-xs font-semibold" style={{ color: x.color }}>{x.t}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{x.d}</div>
            <code className="mt-1.5 block rounded bg-muted px-1.5 py-0.5 text-[10px]">{x.marca}</code>
          </div>
        ))}
      </div>
    </Marco>
  )
}

/** Cuántos colegios son reales y cuántos de demostración. */
export function ColegiosReales() {
  return (
    <Marco pie="En el mapa se pueden mostrar por separado con el filtro «Datos».">
      <div className="flex flex-wrap gap-[3px]">
        {Array.from({ length: 166 }, (_, i) => (
          <span
            key={i}
            className="size-2 rounded-full"
            style={{ background: i < 151 ? COLOR.logrado : COLOR.intermedio, opacity: i < 151 ? 0.75 : 1 }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: COLOR.logrado }} />
          151 reales (MINEDU)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: COLOR.intermedio }} />
          15 de demostración
        </span>
      </div>
    </Marco>
  )
}

/** Cómo el adapter traduce una llave externa al identificador interno. */
export function AdapterIngesta() {
  return (
    <Marco pie="Por eso reimportar un archivo no duplica filas: la llave ya está mapeada.">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-[11px]">
        <div className="rounded-md border px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Archivo</div>
          <code>dni · 98000001</code>
        </div>
        <ArrowRight className="size-3.5 text-muted-foreground/60" />
        <div className="rounded-md bg-primary px-2 py-1.5 text-primary-foreground">
          <div className="text-[10px] uppercase tracking-wide opacity-80">Mapeo</div>
          <span>llave externa → uuid</span>
        </div>
        <ArrowRight className="size-3.5 text-muted-foreground/60" />
        <div className="rounded-md border px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Base de datos</div>
          <code>usuario · 3f9a…</code>
        </div>
      </div>
    </Marco>
  )
}

/** El quipu: cada hito queda como un nudo en la cuerda. */
export function CuerdaTrazabilidad() {
  const nudos = [
    { t: 'v1 subida', s: '12 mar' },
    { t: 'Observada', s: '12 mar' },
    { t: 'v2 subida', s: '19 mar' },
    { t: 'Aprobada', s: '19 mar' },
  ]
  return (
    <Marco pie="Nada se sobrescribe: el historial completo queda disponible para revisarlo después.">
      <div className="relative">
        <div className="absolute inset-x-0 top-2 h-px bg-border" aria-hidden />
        <ol className="relative flex justify-between gap-2">
          {nudos.map((n, i) => (
            <li key={n.t} className="flex flex-1 flex-col items-center text-center">
              <span
                className="size-4 rounded-full border-2 border-background"
                style={{ background: i === nudos.length - 1 ? COLOR.logrado : 'var(--muted-foreground)' }}
              />
              <span className="mt-1 text-[11px] font-medium leading-tight">{n.t}</span>
              <span className="text-[10px] text-muted-foreground">{n.s}</span>
            </li>
          ))}
        </ol>
      </div>
    </Marco>
  )
}
