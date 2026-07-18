import { TYPE_LABEL } from '@/config/labels'
import { useProfile, useArtifactTypes } from '@/hooks'
import {
  CALENDAR, TYPE_DOT, SUBJECT_LABEL, groupByDate, groupByBimestre, calSubjectName,
  type CalItem,
} from '@/data/calendar'
import type { ArtifactType } from '@/types'

const TODAY = new Date().toISOString().slice(0, 10)

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
}

function DateStatus({ date }: { date: string }) {
  const diff = Math.ceil((new Date(date + 'T12:00:00').getTime() - Date.now()) / 86400000)
  if (date < TODAY) return <span className="text-xs text-ink-soft">Vencido</span>
  if (date === TODAY) return <span className="text-xs font-semibold text-bad">Hoy</span>
  if (diff <= 7) return <span className="text-xs font-medium text-warn">En {diff} día{diff !== 1 ? 's' : ''}</span>
  return <span className="text-xs text-ink-soft">{fmtDate(date)}</span>
}

export default function TeacherCalendar() {
  const profile = useProfile()
  const { data: artifacts } = useArtifactTypes(profile.id)

  // Set de entregas ya validadas por (tipo, curso, mes).
  const delivered = new Set<string>()
  for (const a of artifacts ?? []) {
    const m = new Date(a.created_at).toISOString().slice(0, 7)
    const sname = a.subjects?.name ?? ''
    if (a.status !== 'NEEDS_REVISION' && a.status !== 'PROCESSING_ERROR') delivered.add(`${a.type}:${sname}:${m}`)
  }

  const isDelivered = (item: CalItem) =>
    delivered.has(`${item.type}:${calSubjectName(item.subject)}:${item.date.slice(0, 7)}`)

  const sections = groupByBimestre(groupByDate(CALENDAR))
  const total = CALENDAR.length
  const done = CALENDAR.filter(isDelivered).length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Calendario pedagógico 2026</h1>
          <p className="mt-1 text-sm text-ink-soft">4.to grado de primaria · Matemática y Comunicación</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-semibold">{done}<span className="text-base text-ink-soft">/{total}</span></div>
          <div className="text-xs text-ink-soft">entregas validadas</div>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-soft">
        {(Object.entries(TYPE_DOT) as [ArtifactType, string][]).map(([t, dot]) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`inline-block size-2 rounded-full ${dot}`} />
            {TYPE_LABEL[t]}
          </span>
        ))}
      </div>

      <div className="mt-8 space-y-10">
        {sections.map(({ bim, dates }) => {
          const active = TODAY >= bim.start && TODAY <= bim.end
          return (
            <section key={bim.num}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className={`text-base font-semibold ${active ? 'text-brand' : ''}`}>{bim.label}</h2>
                {active && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wide">Actual</span>}
                <span className="text-xs text-ink-soft">{new Date(bim.start + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} – {new Date(bim.end + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="space-y-3">
                {dates.map(({ date, items }) => {
                  const past = date < TODAY
                  const isToday = date === TODAY
                  return (
                    <div key={date} className={`rounded-lg border ${isToday ? 'border-brand/40 bg-brand/5' : past ? 'border-line bg-bg' : 'border-line bg-surface'}`}>
                      <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${past && !isToday ? 'opacity-60' : ''}`}>
                        <div className="flex items-center gap-2.5">
                          <span className={`text-xs font-semibold ${isToday ? 'text-brand' : past ? 'text-ink-soft' : ''}`}>
                            {new Date(date + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', weekday: 'short' })}
                          </span>
                          {isToday && <span className="rounded-sm bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">HOY</span>}
                        </div>
                        <DateStatus date={date} />
                      </div>
                      <div className="border-t border-line/60 px-4 pb-3 pt-2 space-y-1.5">
                        {items.map((it, i) => {
                          const ok = isDelivered(it)
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className={`inline-block size-2 shrink-0 rounded-full ${TYPE_DOT[it.type]}`} />
                              <span className={`flex-1 text-sm ${ok ? 'line-through text-ink-soft' : ''}`}>{it.label}</span>
                              <span className="text-xs text-ink-soft">{SUBJECT_LABEL[it.subject]}</span>
                              {ok
                                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-ok"><span>✓</span> Entregado</span>
                                : <span className={`text-xs ${it.type === 'BIMONTHLY_GRADES' || it.type === 'ANNUAL_GRADE_SUMMARY' ? 'font-medium text-warn' : 'text-ink-soft'}`}>Pendiente</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <p className="mt-10 text-xs text-ink-soft">
        Las sesiones de clase se validan al momento de subirse desde{' '}
        <a href="/profesor/subir" className="underline hover:text-ink">Nueva entrega</a>.
        Las fechas son referenciales según el calendario escolar MINEDU 2026.
      </p>
    </div>
  )
}
