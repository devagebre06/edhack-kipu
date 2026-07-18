import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib'
import { useProfile } from '../App'
import { Badge, Spinner, Stat } from '../ui'

export default function DirectorPanel() {
  const profile = useProfile()

  const { data, isLoading } = useQuery({
    queryKey: ['director-panel'],
    queryFn: async () => {
      const [teachers, artifacts] = await Promise.all([
        supabase.from('profiles').select('*').eq('institution_id', profile.institution_id!).eq('role', 'teacher'),
        supabase.from('artifacts').select('id, status, type, teacher_id, profiles(full_name), artifact_versions(evaluations(overall_score))')
          .eq('institution_id', profile.institution_id!),
      ])
      return { teachers: teachers.data || [], artifacts: artifacts.data || [] }
    },
  })

  if (isLoading || !data) return <Spinner text="Cargando panel…" />
  const { teachers, artifacts } = data

  const approved = artifacts.filter(a => a.status === 'APPROVED').length
  const revision = artifacts.filter(a => a.status === 'NEEDS_REVISION').length
  const manual = artifacts.filter(a => a.status === 'MANUAL_REVIEW').length

  const scores = artifacts.flatMap(a => (a.artifact_versions as any[]).flatMap(v => (v.evaluations as any[]).map((e: any) => e.overall_score)))
  const avg = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : null

  // Por docente: cuántas aprobadas vs total
  const byTeacher = teachers.map(t => {
    const arts = artifacts.filter(a => a.teacher_id === t.id)
    const ok = arts.filter(a => a.status === 'APPROVED').length
    return { name: t.full_name, total: arts.length, ok, pct: arts.length ? Math.round((ok / arts.length) * 100) : null }
  }).sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1))

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">Panel general</h1>
      <p className="mt-1 text-sm text-ink-soft">Resumen de evidencias docentes de tu institución.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Docentes" value={teachers.length} />
        <Stat label="Entregas totales" value={artifacts.length} />
        <Stat label="Aprobadas" value={approved} tone="ok" />
        <Stat label="Por corregir" value={revision} tone={revision > 0 ? 'warn' : undefined} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revisión manual" value={manual} tone={manual > 0 ? 'warn' : undefined} />
        <Stat label="Puntaje promedio" value={avg !== null ? `${avg}/100` : '—'} />
        <Stat label="Tasa de aprobación" value={artifacts.length ? `${Math.round((approved / artifacts.length) * 100)}%` : '—'} tone={approved / (artifacts.length || 1) >= 0.7 ? 'ok' : 'warn'} />
        <Stat label="Aprobación bimestral" value="—" />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">Avance por docente</h2>
        <div className="space-y-2">
          {byTeacher.map(t => (
            <div key={t.name} className="flex items-center gap-4 rounded-lg border border-line bg-surface px-4 py-3">
              <span className="w-40 shrink-0 truncate text-sm font-medium">{t.name}</span>
              <div className="flex-1">
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-line">
                  {t.pct !== null && <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${t.pct}%` }} />}
                </div>
              </div>
              <span className="w-20 shrink-0 text-right text-sm text-ink-soft">
                {t.ok}/{t.total} {t.pct !== null ? `(${t.pct}%)` : ''}
              </span>
              <Badge
                value={t.pct === null ? 'PROCESSING' : t.pct >= 70 ? 'APPROVED' : t.pct >= 40 ? 'NEEDS_REVISION' : 'MANUAL_REVIEW'}
                label={t.pct === null ? 'Sin entregas' : t.pct >= 70 ? 'En nivel' : t.pct >= 40 ? 'Regular' : 'Bajo'}
              />
            </div>
          ))}
          {!teachers.length && <p className="text-sm text-ink-soft">No hay docentes registrados.</p>}
        </div>
      </section>
    </div>
  )
}
