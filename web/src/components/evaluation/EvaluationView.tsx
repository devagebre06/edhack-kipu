import type { Evaluation, Ficha } from '@/types'
import { STATUS_LABEL, DIMENSION_LABEL, VAL_LABEL, VAL_BADGE, ID_LABEL, DOC_LABEL } from '@/config/labels'
import { getFicha, getLegacyCriteria, scoreDelta, fichaItemsByDimension } from '@/factories'
import { Badge } from '../Badge'

function ItemDetail({ nombre, valoracion, evidencia, recomendacion }: { nombre: string; valoracion: string; evidencia: string; recomendacion: string }) {
  return (
    <details className="rounded-md border border-line bg-bg px-4 py-2.5 open:bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
        <span className="font-medium">{nombre}</span>
        <Badge value={VAL_BADGE[valoracion] || 'PROCESSING'} label={VAL_LABEL[valoracion] || valoracion} />
      </summary>
      {evidencia && <blockquote className="mt-2 border-l border-line pl-3 text-sm italic text-ink-soft">{evidencia}</blockquote>}
      {recomendacion && <p className="mt-2 max-w-[70ch] text-sm"><span className="font-medium">Recomendación:</span> {recomendacion}</p>}
    </details>
  )
}

function FichaView({ ficha }: { ficha: Ficha }) {
  const dims = fichaItemsByDimension(ficha)
  const id = ficha.extraccion?.identificacion || {}
  const docs = ficha.extraccion?.documentos_presentes || {}
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-line bg-bg px-4 py-3 text-sm">
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {Object.entries(ID_LABEL).filter(([k]) => id[k] && id[k] !== 'No consignado').map(([k, l]) => (
            <p key={k}><span className="font-medium">{l}:</span> <span className="text-ink-soft">{id[k]}</span></p>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Documentos analizados: {Object.entries(DOC_LABEL).filter(([k]) => docs[k]).map(([, l]) => l).join(' · ') || '—'}
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h4 className="text-sm font-semibold">Sección II · Planificación del docente</h4>
          <span className="text-sm tabular-nums text-ink-soft">{ficha.puntaje_total}/{ficha.puntaje_max} pts · prom. {ficha.promedio} · {VAL_LABEL[ficha.nivel_global] || ficha.nivel_global}</span>
        </div>
        <div className="space-y-4">
          {dims.map(([d, items]) => items.length > 0 && (
            <div key={d}>
              <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">{DIMENSION_LABEL[d]}</h5>
              <div className="space-y-2">
                {items.map(it => <ItemDetail key={it.numero} nombre={`${it.numero}. ${it.nombre}`} valoracion={it.valoracion} evidencia={it.evidencia} recomendacion={it.recomendacion} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-1 text-sm font-semibold">Sección III · Diseño de la sesión frente al desempeño docente</h4>
        <p className="mb-2 max-w-[80ch] text-xs text-ink-soft">Se valora únicamente lo que la sesión <em>planifica</em>. La valoración definitiva de estos desempeños requiere observación de aula en vivo.</p>
        <div className="space-y-2">
          {ficha.desempenos.map(d => <ItemDetail key={d.numero} nombre={`${d.numero}. ${d.nombre}`} valoracion={d.valoracion} evidencia={d.evidencia_diseno} recomendacion={d.recomendacion} />)}
        </div>
      </div>

      {ficha.recomendaciones_priorizadas?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Recomendaciones priorizadas</h4>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{ficha.recomendaciones_priorizadas.map((r, i) => <li key={i}>{r}</li>)}</ol>
        </div>
      )}

      {(ficha.compromisos_docente?.length > 0 || ficha.compromisos_especialista?.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold">Compromisos del docente</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{ficha.compromisos_docente.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Compromisos del especialista/directivo</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{ficha.compromisos_especialista.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        </div>
      )}
      <p className="text-xs text-ink-soft">Monitoreo con enfoque formativo — Ficha UGEL 06 · AGEBRE · 2026. Puntaje referencial; decisión final del especialista.</p>
    </div>
  )
}

export function EvaluationView({ ev, prev }: { ev: Evaluation; prev?: Evaluation }) {
  const ficha = getFicha(ev)
  const legacy = getLegacyCriteria(ev)
  const delta = scoreDelta(ev, prev)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="text-4xl font-semibold">{ev.overall_score}<span className="text-lg text-ink-soft">/100</span></div>
        <Badge value={ev.decision} label={STATUS_LABEL[ev.decision]} />
        {delta !== null && <span className={`text-sm font-medium ${delta >= 0 ? 'text-ok' : 'text-warn'}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} pts vs. versión anterior
        </span>}
      </div>
      <p className="max-w-[70ch] text-sm">{ev.summary}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-ok">Fortalezas</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{ev.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-warn">Para mejorar</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {ev.improvements.length ? ev.improvements.map((s, i) => <li key={i}>{s}</li>) : <li className="text-ink-soft">Nada pendiente. Buen trabajo.</li>}
          </ul>
        </div>
      </div>
      {ficha && <FichaView ficha={ficha} />}
      {legacy.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Resultado por criterio</h4>
          <div className="space-y-2">
            {legacy.map(c => (
              <details key={c.criterionCode} className="rounded-md border border-line bg-bg px-4 py-2.5 open:bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{c.criterionName}</span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-ink-soft">{c.score}/{c.maxScore}</span>
                    <Badge value={c.status === 'PASS' ? 'APPROVED' : c.status === 'FAIL' ? 'NEEDS_REVISION' : 'PROCESSING'} label={c.status === 'PASS' ? 'Logrado' : c.status === 'FAIL' ? 'No logrado' : 'Parcial'} />
                  </span>
                </summary>
                <p className="mt-2 max-w-[70ch] text-sm text-ink-soft">{c.feedback}</p>
                {c.evidence.map((e, i) => <blockquote key={i} className="mt-2 border-l border-line pl-3 text-sm italic text-ink-soft">"{e.quote}" <span className="not-italic">— {e.location}</span></blockquote>)}
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
