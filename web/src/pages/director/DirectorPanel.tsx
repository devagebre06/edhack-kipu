import { useProfile, useDirectorPanel } from '@/hooks'
import { countByStatus, averageScore, progressByTeacher } from '@/factories'
import { Badge, Spinner, Stat } from '@/components'

export default function DirectorPanel() {
  const profile = useProfile()
  const { data, isLoading } = useDirectorPanel(profile.institution_id!)

  if (isLoading || !data) return <Spinner text="Cargando panel…" />
  const { teachers, artifacts } = data

  const { total, approved, revision, manual, approvalRate } = countByStatus(artifacts)
  const avg = averageScore(artifacts)
  const byTeacher = progressByTeacher(teachers, artifacts)

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Panel general</h1>
        <p className="mt-1 text-sm text-muted-foreground">Resumen de evidencias docentes de tu institución.</p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Docentes" value={teachers.length} />
        <Stat label="Entregas totales" value={total} />
        <Stat label="Aprobadas" value={approved} tone="ok" />
        <Stat label="Por corregir" value={revision} tone={revision > 0 ? 'warn' : undefined} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revisión manual" value={manual} tone={manual > 0 ? 'warn' : undefined} />
        <Stat label="Puntaje promedio" value={avg !== null ? `${avg}/100` : '—'} />
        <Stat label="Tasa de aprobación" value={approvalRate !== null ? `${approvalRate}%` : '—'} tone={(approvalRate ?? 0) >= 70 ? 'ok' : 'warn'} />
        <Stat label="Aprobación bimestral" value="—" />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">Avance por docente</h2>
        <div className="space-y-2">
          {byTeacher.map(t => (
            <div key={t.name} className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3 shadow-xs">
              <span className="w-40 shrink-0 truncate text-sm font-medium">{t.name}</span>
              <div className="flex-1">
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                  {t.pct !== null && <div className="h-full rounded-full bg-success transition-all" style={{ width: `${t.pct}%` }} />}
                </div>
              </div>
              <span className="w-20 shrink-0 text-right text-sm text-muted-foreground">
                {t.ok}/{t.total} {t.pct !== null ? `(${t.pct}%)` : ''}
              </span>
              <Badge
                value={t.pct === null ? 'PROCESSING' : t.pct >= 70 ? 'APPROVED' : t.pct >= 40 ? 'NEEDS_REVISION' : 'MANUAL_REVIEW'}
                label={t.pct === null ? 'Sin entregas' : t.pct >= 70 ? 'En nivel' : t.pct >= 40 ? 'Regular' : 'Bajo'}
              />
            </div>
          ))}
          {!teachers.length && <p className="text-sm text-muted-foreground">No hay docentes registrados.</p>}
        </div>
      </section>
    </div>
  )
}
