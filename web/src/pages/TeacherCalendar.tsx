import { useQuery } from '@tanstack/react-query'
import { supabase, TYPE_LABEL } from '../lib'
import { useProfile } from '../App'

// Calendario escolar 2026 — 4to primaria · Matemática y Comunicación
// Cada entrada define qué debe subirse en qué fecha y de qué tipo
type DeadlineType = 'DAILY_SESSION' | 'MONTHLY_UNIT' | 'BIMONTHLY_GRADES' | 'ANNUAL_GRADE_SUMMARY'
type CalItem = {
  date: string        // YYYY-MM-DD
  type: DeadlineType
  label: string       // descripción humana
  subject: 'MAT' | 'COM' | 'AMBOS'
  bimestre?: number
  optional?: boolean
}

const BIMESTRES = [
  { num: 1, label: '1.er Bimestre', start: '2026-03-16', end: '2026-05-22' },
  { num: 2, label: '2.do Bimestre', start: '2026-06-01', end: '2026-07-31' },
  { num: 3, label: '3.er Bimestre', start: '2026-08-17', end: '2026-10-16' },
  { num: 4, label: '4.to Bimestre', start: '2026-10-19', end: '2026-12-18' },
]

// Sesiones de clase: el profesor debe subir la sesión del día
// (representamos una por semana representativa; en prod vendrían del schedule)
// Unidades: 1 por mes x bimestre x curso (Matemática + Comunicación)
// Registro de notas: al cierre de cada bimestre x curso
// Balance anual: diciembre
const CALENDAR: CalItem[] = [
  // ── Unidades (MONTHLY_UNIT) ── subir al inicio de cada mes escolar ──
  // Bimestre 1
  { date: '2026-03-20', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Marzo (Mat)', subject: 'MAT', bimestre: 1 },
  { date: '2026-03-20', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Marzo (Com)', subject: 'COM', bimestre: 1 },
  { date: '2026-04-20', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Abril (Mat)', subject: 'MAT', bimestre: 1 },
  { date: '2026-04-20', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Abril (Com)', subject: 'COM', bimestre: 1 },
  { date: '2026-05-18', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Mayo (Mat)', subject: 'MAT', bimestre: 1 },
  { date: '2026-05-18', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Mayo (Com)', subject: 'COM', bimestre: 1 },
  // Bimestre 2
  { date: '2026-06-03', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Junio (Mat)', subject: 'MAT', bimestre: 2 },
  { date: '2026-06-03', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Junio (Com)', subject: 'COM', bimestre: 2 },
  { date: '2026-07-01', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Julio (Mat)', subject: 'MAT', bimestre: 2 },
  { date: '2026-07-01', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Julio (Com)', subject: 'COM', bimestre: 2 },
  // Bimestre 3
  { date: '2026-08-19', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Agosto (Mat)', subject: 'MAT', bimestre: 3 },
  { date: '2026-08-19', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Agosto (Com)', subject: 'COM', bimestre: 3 },
  { date: '2026-09-18', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Setiembre (Mat)', subject: 'MAT', bimestre: 3 },
  { date: '2026-09-18', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Setiembre (Com)', subject: 'COM', bimestre: 3 },
  { date: '2026-10-14', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Octubre (Mat)', subject: 'MAT', bimestre: 3 },
  { date: '2026-10-14', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Octubre (Com)', subject: 'COM', bimestre: 3 },
  // Bimestre 4
  { date: '2026-10-21', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Nov (Mat)', subject: 'MAT', bimestre: 4 },
  { date: '2026-10-21', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Nov (Com)', subject: 'COM', bimestre: 4 },
  { date: '2026-11-18', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Nov 2.ª quincena (Mat)', subject: 'MAT', bimestre: 4 },
  { date: '2026-11-18', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Nov 2.ª quincena (Com)', subject: 'COM', bimestre: 4 },
  { date: '2026-12-09', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Diciembre (Mat)', subject: 'MAT', bimestre: 4 },
  { date: '2026-12-09', type: 'MONTHLY_UNIT', label: 'Unidad de aprendizaje — Diciembre (Com)', subject: 'COM', bimestre: 4 },

  // ── Registro de notas bimestral (BIMONTHLY_GRADES) ──
  { date: '2026-05-22', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 1.er Bimestre (Mat)', subject: 'MAT', bimestre: 1 },
  { date: '2026-05-22', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 1.er Bimestre (Com)', subject: 'COM', bimestre: 1 },
  { date: '2026-07-31', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 2.do Bimestre (Mat)', subject: 'MAT', bimestre: 2 },
  { date: '2026-07-31', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 2.do Bimestre (Com)', subject: 'COM', bimestre: 2 },
  { date: '2026-10-16', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 3.er Bimestre (Mat)', subject: 'MAT', bimestre: 3 },
  { date: '2026-10-16', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 3.er Bimestre (Com)', subject: 'COM', bimestre: 3 },
  { date: '2026-12-18', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 4.to Bimestre (Mat)', subject: 'MAT', bimestre: 4 },
  { date: '2026-12-18', type: 'BIMONTHLY_GRADES', label: 'Registro de notas — 4.to Bimestre (Com)', subject: 'COM', bimestre: 4 },

  // ── Balance anual (ANNUAL_GRADE_SUMMARY) ──
  { date: '2026-12-18', type: 'ANNUAL_GRADE_SUMMARY', label: 'Balance anual de notas (Mat)', subject: 'MAT' },
  { date: '2026-12-18', type: 'ANNUAL_GRADE_SUMMARY', label: 'Balance anual de notas (Com)', subject: 'COM' },
]

const TYPE_DOT: Record<DeadlineType, string> = {
  DAILY_SESSION: 'bg-ok',
  MONTHLY_UNIT: 'bg-nav',
  BIMONTHLY_GRADES: 'bg-warn',
  ANNUAL_GRADE_SUMMARY: 'bg-bad',
}
const SUBJECT_LABEL: Record<string, string> = { MAT: 'Matemática', COM: 'Comunicación', AMBOS: 'Ambos' }

const TODAY = new Date().toISOString().slice(0, 10)

function groupByDate(items: CalItem[]) {
  const map = new Map<string, CalItem[]>()
  for (const it of items) {
    const arr = map.get(it.date) || []
    arr.push(it)
    map.set(it.date, arr)
  }
  return map
}

function groupByBimestre(grouped: Map<string, CalItem[]>) {
  const res: { bim: typeof BIMESTRES[0]; dates: { date: string; items: CalItem[] }[] }[] = []
  for (const bim of BIMESTRES) {
    const dates: { date: string; items: CalItem[] }[] = []
    for (const [date, items] of grouped) {
      if (date >= bim.start && date <= bim.end) dates.push({ date, items })
    }
    dates.sort((a, b) => a.date.localeCompare(b.date))
    if (dates.length) res.push({ bim, dates })
  }
  // Fuera de bimestres (balance anual)
  const extra: { date: string; items: CalItem[] }[] = []
  for (const [date, items] of grouped) {
    const inBim = BIMESTRES.some(b => date >= b.start && date <= b.end)
    if (!inBim) extra.push({ date, items })
  }
  if (extra.length) {
    extra.sort((a, b) => a.date.localeCompare(b.date))
    res.push({ bim: { num: 0, label: 'Cierre anual', start: '2026-12-01', end: '2026-12-31' }, dates: extra })
  }
  return res
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
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

  const { data: artifacts } = useQuery({
    queryKey: ['artifacts-types'],
    queryFn: async () => (await supabase.from('artifacts')
      .select('type, status, subject_id, subjects(name), created_at')
      .eq('teacher_id', profile.id)
      .order('created_at', { ascending: false })
    ).data || [],
  })

  // Construir un set de tipos ya entregados por (type, subject, mes/bimestre)
  // para simplificar: mapeamos por (type, subjectName, month)
  const delivered = new Set<string>()
  for (const a of (artifacts || [])) {
    const m = new Date(a.created_at).toISOString().slice(0, 7)
    const sname: string = (a as any).subjects?.name || ''
    if (a.status !== 'NEEDS_REVISION' && a.status !== 'PROCESSING_ERROR') {
      delivered.add(`${a.type}:${sname}:${m}`)
    }
  }

  function isDelivered(item: CalItem): boolean {
    const m = item.date.slice(0, 7)
    const sname = item.subject === 'MAT' ? 'Matemática' : item.subject === 'COM' ? 'Comunicación' : ''
    return delivered.has(`${item.type}:${sname}:${m}`)
  }

  const grouped = groupByDate(CALENDAR)
  const sections = groupByBimestre(grouped)

  const total = CALENDAR.length
  const done = CALENDAR.filter(it => isDelivered(it)).length
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

      {/* Barra de progreso */}
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-soft">
        {(Object.entries(TYPE_DOT) as [DeadlineType, string][]).map(([t, dot]) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`inline-block size-2 rounded-full ${dot}`} />
            {TYPE_LABEL[t]}
          </span>
        ))}
      </div>

      {/* Timeline por bimestre */}
      <div className="mt-8 space-y-10">
        {sections.map(({ bim, dates }) => {
          const bStart = bim.start
          const bEnd = bim.end
          const active = TODAY >= bStart && TODAY <= bEnd
          return (
            <section key={bim.num}>
              <div className={`mb-3 flex items-center gap-3`}>
                <h2 className={`text-base font-semibold ${active ? 'text-brand' : ''}`}>{bim.label}</h2>
                {active && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wide">Actual</span>}
                <span className="text-xs text-ink-soft">{new Date(bStart + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} – {new Date(bEnd + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</span>
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
                          const done = isDelivered(it)
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className={`inline-block size-2 shrink-0 rounded-full ${TYPE_DOT[it.type]}`} />
                              <span className={`flex-1 text-sm ${done ? 'line-through text-ink-soft' : ''}`}>{it.label}</span>
                              <span className="text-xs text-ink-soft">{SUBJECT_LABEL[it.subject]}</span>
                              {done
                                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-ok"><span>✓</span> Entregado</span>
                                : <span className={`text-xs ${it.type === 'BIMONTHLY_GRADES' || it.type === 'ANNUAL_GRADE_SUMMARY' ? 'font-medium text-warn' : 'text-ink-soft'}`}>Pendiente</span>
                              }
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
