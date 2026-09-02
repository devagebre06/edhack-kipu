// Diagramas del glosario · Indicadores y scoring.
import { Marco, BarraApilada, Regla, COLOR, Fila } from './primitivas'

/** Cómo se agrupan los cuatro niveles en los tres colores del mapa. */
export function NivelesMapa() {
  return (
    <Marco pie="Los cuatro niveles de la escala se agrupan en tres para que el mapa sea legible de un vistazo.">
      <div className="grid gap-1.5">
        {[
          { bucket: 'Crítico', de: 'nivel C', color: COLOR.critico },
          { bucket: 'Intermedio', de: 'nivel B', color: COLOR.intermedio },
          { bucket: 'Logrado', de: 'niveles A y AD', color: COLOR.logrado },
        ].map((x) => (
          <div key={x.bucket} className="flex items-center gap-2.5 rounded-md border px-2.5 py-1.5">
            <span className="size-3.5 shrink-0 rounded-full" style={{ background: x.color }} />
            <span className="text-xs font-medium">{x.bucket}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{x.de}</span>
          </div>
        ))}
      </div>
      <div className="mt-2.5">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Ejemplo · un colegio</p>
        <BarraApilada
          segmentos={[
            { etiqueta: 'Crítico', valor: 8, color: COLOR.critico },
            { etiqueta: 'Intermedio', valor: 22, color: COLOR.intermedio },
            { etiqueta: 'Logrado', valor: 70, color: COLOR.logrado },
          ]}
        />
      </div>
    </Marco>
  )
}

/** De qué está hecho el score: los tres componentes ponderados. */
export function ComposicionScore() {
  const comp = [
    { etiqueta: 'Logro', bruto: 64, peso: 0.55, color: 'var(--chart-1)' },
    { etiqueta: 'Equidad', bruto: 99, peso: 0.3, color: 'var(--chart-2)' },
    { etiqueta: 'Cobertura', bruto: 95, peso: 0.15, color: 'var(--chart-3)' },
  ]
  const total = Math.round(comp.reduce((s, c) => s + c.bruto * c.peso, 0))
  return (
    <Marco pie="El aporte de cada componente es su valor por su peso; la suma es el score.">
      <div className="space-y-1.5">
        {comp.map((c) => (
          <Fila
            key={c.etiqueta}
            etiqueta={`${c.etiqueta} · ${Math.round(c.peso * 100)}%`}
            valor={`${c.bruto} → ${Math.round(c.bruto * c.peso)}`}
            barra={c.bruto}
            color={c.color}
          />
        ))}
      </div>
      <div className="mt-2 border-t pt-2">
        <BarraApilada
          alto="h-4"
          leyenda={false}
          segmentos={comp.map((c) => ({ etiqueta: c.etiqueta, valor: c.bruto * c.peso, color: c.color }))}
        />
        <div className="mt-1.5 text-xs">
          <span className="text-muted-foreground">Score compuesto: </span>
          <span className="font-semibold tabular-nums">{total}/100</span>
        </div>
      </div>
    </Marco>
  )
}

/** Los cortes que traducen el score a una etiqueta de lectura. */
export function LecturaScore() {
  return (
    <Marco pie="La etiqueta describe una situación del grupo, no una calificación de la persona.">
      <Regla
        marca={{ valor: 74, etiqueta: '74' }}
        tramos={[
          { desde: 0, etiqueta: 'Prioridad de acompañamiento', color: COLOR.critico },
          { desde: 45, etiqueta: 'En progreso', color: COLOR.intermedio },
          { desde: 60, etiqueta: 'Desempeño esperado', color: COLOR.logrado },
          { desde: 75, etiqueta: 'Desempeño destacado', color: COLOR.destacado },
        ]}
      />
    </Marco>
  )
}

/** Docente contra el promedio de su distrito. */
export function ValorAgregado() {
  const distrito = 2.48
  const docente = 2.75
  const pos = (v: number) => ((v - 1) / 3) * 100
  return (
    <Marco pie="Compara con el entorno real del docente, no con la UGEL entera.">
      <div className="relative h-16 rounded-lg border px-3 pt-6">
        <div className="absolute inset-x-3 top-9 h-1 rounded-full bg-muted" />
        {[
          { v: distrito, et: 'Su distrito', color: 'var(--muted-foreground)', arriba: true },
          { v: docente, et: 'El docente', color: COLOR.logrado, arriba: false },
        ].map((m) => (
          <div
            key={m.et}
            className="absolute flex -translate-x-1/2 flex-col items-center"
            style={{ left: `calc(0.75rem + ${pos(m.v)}% - ${pos(m.v) * 0.015}rem)`, top: m.arriba ? 4 : 44 }}
          >
            {!m.arriba && <span className="size-2.5 rounded-full" style={{ background: m.color }} />}
            <span className="whitespace-nowrap text-[10px]" style={{ color: m.color }}>
              {m.et} {m.v.toFixed(2)}
            </span>
            {m.arriba && <span className="mt-0.5 size-2.5 rounded-full" style={{ background: m.color }} />}
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-xs">
        <span className="text-muted-foreground">Valor agregado: </span>
        <span className="font-semibold tabular-nums" style={{ color: COLOR.logrado }}>
          +{(docente - distrito).toFixed(2)}
        </span>
        <span className="text-muted-foreground"> · rinde por encima de su entorno</span>
      </div>
    </Marco>
  )
}

/** Qué parte de las entregas quedó observada. */
export function TasaInvalidez() {
  const total = 12
  const observadas = 4
  return (
    <Marco pie="Una tasa alta señala dónde acompañar, no a quién sancionar.">
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="size-6 rounded-md"
            style={{ background: i < observadas ? COLOR.intermedio : COLOR.logrado }}
            title={i < observadas ? 'Necesita corrección' : 'Aprobada'}
          />
        ))}
      </div>
      <div className="mt-2 text-xs">
        <span className="font-semibold tabular-nums">{observadas} de {total}</span>
        <span className="text-muted-foreground"> entregas observadas = </span>
        <span className="font-semibold tabular-nums" style={{ color: COLOR.intermedio }}>
          {Math.round((observadas / total) * 100)}% de invalidez
        </span>
      </div>
    </Marco>
  )
}

/** La proporción del aula en el nivel más bajo, contra el umbral de alerta. */
export function PorcentajeEnInicio() {
  const enInicio = 9
  const total = 30
  const pct = Math.round((enInicio / total) * 100)
  return (
    <Marco pie="Al superar el 30% el motor de alertas marca el aula para acompañamiento.">
      <div className="relative">
        <BarraApilada
          alto="h-5"
          leyenda={false}
          segmentos={[
            { etiqueta: 'En inicio', valor: enInicio, color: COLOR.critico },
            { etiqueta: 'Resto del aula', valor: total - enInicio, color: 'var(--muted)' },
          ]}
        />
        <div className="absolute inset-y-0 border-l-2 border-dashed border-foreground/60" style={{ left: '30%' }} />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 text-xs">
        <span>
          <span className="font-semibold tabular-nums" style={{ color: COLOR.critico }}>{pct}%</span>
          <span className="text-muted-foreground"> en inicio ({enInicio} de {total})</span>
        </span>
        <span className="text-[11px] text-muted-foreground">línea punteada = umbral de alerta (30%)</span>
      </div>
    </Marco>
  )
}
