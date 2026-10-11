import type { Evaluation } from '@/types'
import { VAL_LABEL, VAL_BADGE } from '@/config/labels'
import { getFicha, getRubricaKipu, getLegacyCriteria } from '@/factories'
import { Badge } from '../Badge'

type Note = { titulo: string; valoracion?: string; texto: string; recomendacion: string }

// Un texto de evidencia solo sirve como "cita evaluada" si es una cita real del
// documento (no un "No evidenciado…" ni un ítem excluido de la evaluación).
const isRealEvidence = (s?: string) =>
  !!s && !/^no evidenciad/i.test(s.trim()) && !/excluido de la evaluaci/i.test(s)

/** Construye la lista de anotaciones: cada cita textual evaluada con su recomendación. */
function buildNotes(ev: Evaluation): Note[] {
  const rubrica = getRubricaKipu(ev)
  if (rubrica) return rubrica.items
    .filter(it => it.recomendacion?.trim() && isRealEvidence(it.evidencia))
    .map(it => ({ titulo: `${it.numero}. ${it.nombre}`, valoracion: it.nivel, texto: it.evidencia, recomendacion: it.recomendacion }))
  const ficha = getFicha(ev)
  if (ficha) {
    const fromItems = ficha.items
      .filter(it => !it.excluido && it.recomendacion?.trim() && isRealEvidence(it.evidencia))
      .map(it => ({ titulo: `${it.numero}. ${it.nombre}`, valoracion: it.valoracion, texto: it.evidencia, recomendacion: it.recomendacion }))
    const fromDesempenos = ficha.desempenos
      .filter(d => d.recomendacion?.trim() && isRealEvidence(d.evidencia_diseno))
      .map(d => ({ titulo: `${d.numero}. ${d.nombre}`, valoracion: d.valoracion, texto: d.evidencia_diseno, recomendacion: d.recomendacion }))
    return [...fromItems, ...fromDesempenos]
  }
  // Formato legacy: una nota por cita de cada criterio, con su feedback como recomendación.
  return getLegacyCriteria(ev)
    .filter(c => c.feedback?.trim())
    .flatMap(c => (c.evidence?.length ? c.evidence : [{ quote: '', location: '' }])
      .filter(e => isRealEvidence(e.quote))
      .map(e => ({ titulo: c.criterionName, texto: e.quote, recomendacion: c.feedback })))
}

/**
 * Anotaciones formativas: la copia literal del texto evaluado con el comentario
 * de recomendación encima. Pensado para mostrarse al lado del PDF.
 */
export function EvaluationAnnotations({ ev }: { ev: Evaluation }) {
  const notes = buildNotes(ev)
  const priorizadas = getRubricaKipu(ev)?.recomendaciones_priorizadas ?? getFicha(ev)?.recomendaciones_priorizadas ?? []

  if (!notes.length)
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink-soft">No hay citas del documento con recomendación puntual para esta entrega.</p>
        {priorizadas.length > 0 && (
          <div>
            <p className="text-sm font-medium">Recomendaciones priorizadas</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{priorizadas.map((r, i) => <li key={i}>{r}</li>)}</ol>
          </div>
        )}
      </div>
    )

  return (
    <div className="space-y-3">
      {notes.map((n, i) => (
        <div key={i} className="rounded-md border border-line bg-surface p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-ink">{n.titulo}</span>
            {n.valoracion && <Badge value={VAL_BADGE[n.valoracion] || 'PROCESSING'} label={VAL_LABEL[n.valoracion] || n.valoracion} />}
          </div>
          {/* Comentario de recomendación, encima del texto citado. */}
          <div className="mt-2 rounded-md border border-brand/20 bg-brand/5 px-3 py-2 text-sm">
            <span className="font-medium text-brand">Recomendación:</span> {n.recomendacion}
          </div>
          {/* Copia literal del texto evaluado. */}
          <blockquote className="mt-2 border-l-2 border-brand/40 pl-3 text-sm italic text-ink-soft">“{n.texto}”</blockquote>
        </div>
      ))}
    </div>
  )
}
