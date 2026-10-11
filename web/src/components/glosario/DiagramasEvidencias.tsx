// Diagramas del glosario · Evidencias y evaluación.
import { FileText, CheckCircle2, AlertCircle, Quote } from 'lucide-react'
import { Marco, Flujo, COLOR, Fila } from './primitivas'

/** Una unidad y las sesiones que cuelgan de ella. */
export function UnidadYSesiones() {
  return (
    <Marco pie="Cada una se sube y se evalúa por separado; la sesión debe ser coherente con su unidad.">
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <span className="text-sm font-medium">Unidad 3 · Formas y movimiento</span>
          <span className="ml-auto text-[11px] text-muted-foreground">1 entrega</span>
        </div>
        <ul className="mt-2 space-y-1 border-l pl-4">
          {['Reconocemos figuras', 'Nos ubicamos en el plano', 'Construimos cuerpos geométricos'].map((s, i) => (
            <li key={s} className="relative text-xs text-muted-foreground">
              <span className="absolute -left-4 top-2 h-px w-3 bg-border" />
              Sesión {i + 1} · {s}
            </li>
          ))}
        </ul>
      </div>
    </Marco>
  )
}

/** Historial de versiones: nada se sobrescribe. */
export function VersionesEvidencia() {
  const versiones = [
    { v: 'v1', estado: 'Necesita corrección', color: COLOR.intermedio, nota: 'primera entrega' },
    { v: 'v2', estado: 'Aprobada', color: COLOR.logrado, nota: 'corrección del docente' },
  ]
  return (
    <Marco pie="La versión anterior se conserva siempre: es el nudo previo de la cuerda.">
      <ol className="space-y-2">
        {versiones.map((x) => (
          <li key={x.v} className="flex items-center gap-2.5 rounded-lg border px-3 py-2">
            <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: x.color }}>
              {x.v}
            </span>
            <span className="text-xs font-medium" style={{ color: x.color }}>{x.estado}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{x.nota}</span>
          </li>
        ))}
      </ol>
    </Marco>
  )
}

/** El circuito de estados por el que pasa una entrega. */
export function CircuitoEstados() {
  return (
    <Marco pie="Cuando la IA no puede decidir, la entrega pasa a revisión humana.">
      <Flujo pasos={[{ titulo: 'En procesamiento', sub: 'la IA la evalúa', color: COLOR.neutro }]} />
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {[
          { t: 'Aprobada', s: 'cumple lo esperado', c: COLOR.logrado },
          { t: 'Necesita corrección', s: 'hay observaciones', c: COLOR.intermedio },
          { t: 'Revisión manual', s: 'la mira una persona', c: COLOR.neutro },
          { t: 'Error de procesamiento', s: 'no se pudo leer', c: COLOR.critico },
        ].map((x) => (
          <div key={x.t} className="flex items-baseline gap-2 rounded-md border px-2.5 py-1.5">
            <span className="size-2 shrink-0 translate-y-1 rounded-full" style={{ background: x.c }} />
            <span className="text-xs font-medium">{x.t}</span>
            <span className="text-[10px] text-muted-foreground">{x.s}</span>
          </div>
        ))}
      </div>
    </Marco>
  )
}

/** El umbral de validez, con un caso a cada lado. */
export function UmbralValidez() {
  const casos = [
    { p: 78, valida: true },
    { p: 52, valida: false },
  ]
  return (
    <Marco pie="Una entrega por debajo del umbral queda registrada, pero no cuenta como sesión o unidad válida.">
      <div className="space-y-2.5">
        {casos.map((c) => (
          <div key={c.p}>
            <div className="relative h-6 overflow-hidden rounded-md bg-muted">
              <div
                className="h-full rounded-md"
                style={{ width: `${c.p}%`, background: c.valida ? COLOR.logrado : COLOR.intermedio }}
              />
              {/* Línea del umbral */}
              <div className="absolute inset-y-0 border-l-2 border-dashed border-foreground/50" style={{ left: '75%' }} />
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              {c.valida
                ? <CheckCircle2 className="size-3.5" style={{ color: COLOR.logrado }} />
                : <AlertCircle className="size-3.5" style={{ color: COLOR.intermedio }} />}
              <span className="font-semibold tabular-nums">{c.p}/100</span>
              <span className="text-muted-foreground">{c.valida ? 'válida' : 'no válida · por debajo del mínimo'}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">La línea punteada marca el mínimo: 75/100.</p>
    </Marco>
  )
}

/** Ocho criterios con igual peso. */
export function ComposicionFicha() {
  const criterios = ['Alineación curricular', 'Pertinencia para 4.º grado', 'Coherencia', 'Secuencia', 'Evidencia y criterios', 'Evaluación y feedback', 'Diversidad', 'Claridad y viabilidad']
  return (
    <Marco pie="Ocho criterios de 0 a 3 puntos: máximo 24; desde 18 puntos la entrega es satisfactoria.">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {criterios.map((nombre, i) => <div key={nombre} className="rounded-md border px-2 py-1 text-xs"><span className="mr-1 font-semibold text-primary">{i + 1}.</span>{nombre}</div>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        {[['Logrado', 3, COLOR.logrado], ['En proceso', 2, COLOR.intermedio], ['Inicio', 1, COLOR.critico], ['Sin evidencia', 0, COLOR.critico]].map(([t, v, c]) => (
          <span key={t as string} className="rounded-full border px-2 py-0.5" style={{ borderColor: c as string, color: c as string }}>
            {t as string} = {v as number}
          </span>
        ))}
      </div>
    </Marco>
  )
}

/** Cómo se llega de los ocho criterios al 0-100. */
export function CalculoPuntaje() {
  return (
    <Marco pie="Los ocho criterios tienen igual peso. El servidor calcula la nota; el modelo solo asigna los puntos.">
      <div className="rounded-lg border p-3">
        <Fila etiqueta="Puntos obtenidos" valor="18" barra={75} color={COLOR.logrado} />
        <Fila etiqueta="Máximo" valor="24" barra={100} color="var(--muted-foreground)" />
        <div className="mt-2 border-t pt-2 text-xs">
          <span className="text-muted-foreground">18 ÷ 24 × 100 = </span>
          <span className="font-semibold tabular-nums" style={{ color: COLOR.logrado }}>75/100</span>
        </div>
      </div>
    </Marco>
  )
}

/** Forma de una anotación: cita del documento + recomendación. */
export function EjemploRetroalimentacion() {
  return (
    <Marco pie="Cada valoración se sustenta en el propio documento; la IA nunca decide sola.">
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: COLOR.intermedio }}>
            En proceso
          </span>
          <span className="font-medium">5 · Evidencia y criterios de evaluación</span>
        </div>
        <p className="mt-2 flex gap-1.5 text-[11px] text-muted-foreground">
          <Quote className="size-3 shrink-0 translate-y-0.5" />
          <span className="italic">«Se enuncian criterios de evaluación alineados a la competencia.»</span>
        </p>
        <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px]">
          <span className="font-medium">Recomendación: </span>
          Explicitar descriptores por cada nivel de logro.
        </p>
      </div>
    </Marco>
  )
}
