import { useMemo, useState } from 'react'
import { STATUS_LABEL } from '@/config/labels'
import { useProfile, useDirectorContexts } from '@/hooks'
import {
  unitsWithSessions, latestVersion, latestEvaluation, previousEvaluation,
  latestContext, subjectName, teacherName, classroomName, isValid,
} from '@/factories'
import { Badge, Spinner, Modal, ArtifactPdf, EvaluationView } from '@/components'
import { Button, Separator, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Artifact, ArtifactContext } from '@/types'

const ALL = '__all__'

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

// ── Vista del contexto de contenido (IA) ──
function ContextView({ context }: { context: ArtifactContext }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-x-6 gap-y-1 rounded-md border bg-muted px-4 py-3 sm:grid-cols-2">
        <p><span className="font-medium">Área:</span> <span className="text-muted-foreground">{context.area}</span></p>
        <p><span className="font-medium">Grado:</span> <span className="text-muted-foreground">{context.grado}</span></p>
        <p><span className="font-medium">Periodo:</span> <span className="text-muted-foreground">{context.periodo}</span></p>
        <p className="truncate"><span className="font-medium">Título:</span> <span className="text-muted-foreground">{context.titulo}</span></p>
      </div>
      <div>
        <p className="font-medium">Resumen del contenido</p>
        <p className="mt-1 text-muted-foreground">{context.resumen}</p>
      </div>
      {context.temas?.length > 0 && (
        <div>
          <p className="font-medium">Temas / competencias</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {context.temas.map((t, i) => <li key={i} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Card de una entrega (unidad o sesión) con preview + modales ──
function ArtifactCard({ artifact, title, unitContext }: { artifact: Artifact; title: string; unitContext?: ArtifactContext }) {
  const [modal, setModal] = useState<'eval' | 'context' | null>(null)
  const current = latestVersion(artifact)
  const ev = latestEvaluation(artifact)
  const ctx = latestContext(artifact)
  const isSession = artifact.type === 'DAILY_SESSION'
  const valid = isValid(artifact)

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{current?.original_filename} · v{artifact.current_version}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isSession && (valid
            ? <span className="inline-flex items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-xs font-medium text-success"><CheckCircle2 className="size-3" /> Válida</span>
            : <span className="inline-flex items-center gap-1 rounded-full bg-warning-muted px-2 py-0.5 text-xs font-medium text-warning-foreground"><AlertTriangle className="size-3" /> No válida</span>)}
          <Badge value={artifact.status} label={STATUS_LABEL[artifact.status]} />
        </div>
      </div>

      <ArtifactPdf versionId={current?.id} filename={current?.original_filename} height="h-64" />

      <div className="flex items-center gap-2 border-t px-4 py-2.5">
        <Button variant="outline" onClick={() => setModal('eval')} disabled={!ev} className="flex-1">
          Evaluación
        </Button>
        <Button onClick={() => setModal('context')} disabled={!ctx} className="flex-1">
          Contexto
        </Button>
      </div>

      {modal === 'eval' && (
        <Modal title={`Evaluación · ${title}`} onClose={() => setModal(null)}>
          {ev ? <EvaluationView ev={ev} prev={previousEvaluation(artifact)} /> : <p className="text-sm text-muted-foreground">Sin evaluación disponible.</p>}
        </Modal>
      )}
      {modal === 'context' && (
        <Modal title={`Contexto · ${title}`} onClose={() => setModal(null)}>
          <div className="space-y-6">
            <section>
              <h3 className="mb-2 text-sm font-semibold">{isSession ? 'Contexto de la sesión' : 'Contexto de la unidad'}</h3>
              {ctx ? <ContextView context={ctx} /> : <p className="text-sm text-muted-foreground">Sin contexto disponible.</p>}
            </section>
            {isSession && (
              <>
                <Separator />
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Contexto de la unidad relacionada</h3>
                  {unitContext ? <ContextView context={unitContext} /> : <p className="text-sm text-muted-foreground">La unidad relacionada no tiene contexto disponible.</p>}
                </section>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default function DirectorContexts() {
  const profile = useProfile()
  const { data, isLoading } = useDirectorContexts(profile.institution_id!)
  const [teacherId, setTeacherId] = useState('')
  const [aula, setAula] = useState('')

  const artifacts = useMemo(() => data ?? [], [data])

  // Docentes con unidades/sesiones (para el filtro).
  const teachers = useMemo(() => Array.from(new Map(artifacts.map(a => [a.teacher_id, teacherName(a)])).entries())
    .map(([id, name]) => ({ id: id!, name }))
    .sort((a, b) => a.name.localeCompare(b.name)), [artifacts])

  // Unidades (con sus sesiones) del docente elegido, agrupadas por aula.
  const byAula = useMemo(() => {
    if (!teacherId) return []
    const groups = unitsWithSessions(artifacts.filter(a => a.teacher_id === teacherId))
    const map = new Map<string, ReturnType<typeof unitsWithSessions>>()
    for (const g of groups) {
      // Nunca vacío: Radix Select rechaza SelectItem con value="" y tumba la vista.
      const key = classroomName(g.unit).trim() || 'Sin aula'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(g)
    }
    return [...map.entries()].map(([aula, units]) => ({ aula, units })).sort((a, b) => a.aula.localeCompare(b.aula))
  }, [artifacts, teacherId])

  const aulas = byAula.map(a => a.aula)
  const visible = aula ? byAula.filter(a => a.aula === aula) : byAula

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Contextos de planificación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revisa las unidades y sesiones de cada docente por aula, con su documento, evaluación y el contexto de contenido que la IA extrajo.
        </p>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Select value={teacherId || undefined} onValueChange={v => { setTeacherId(v); setAula('') }}>
          <SelectTrigger className="w-auto min-w-56" aria-label="Filtrar por docente">
            <SelectValue placeholder="Selecciona un docente…" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {teacherId && aulas.length > 0 && (
          <Select value={aula || ALL} onValueChange={v => setAula(v === ALL ? '' : v)}>
            <SelectTrigger className="w-auto min-w-44" aria-label="Filtrar por aula"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las aulas</SelectItem>
              {aulas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? <Spinner text="Cargando…" /> : (
        <div className="mt-6">
          {!teacherId ? (
            <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              Selecciona un docente para ver sus unidades y sesiones por aula.
            </p>
          ) : !visible.length ? (
            <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              Este docente aún no tiene unidades registradas.
            </p>
          ) : (
            <div className="space-y-8">
              {visible.map(({ aula, units }) => (
                <section key={aula}>
                  <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-sm text-primary">Aula {aula}</span>
                    <span className="text-sm font-normal text-muted-foreground">{units.length} {units.length === 1 ? 'unidad' : 'unidades'}</span>
                  </h2>

                  <div className="space-y-6">
                    {units.map(({ unit, sessions }) => {
                      const unitCtx = latestContext(unit)
                      return (
                        <div key={unit.id} className="rounded-xl border bg-muted p-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unidad</p>
                              <ArtifactCard artifact={unit} title={unit.name?.trim() || subjectName(unit)} />
                            </div>
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Sesiones ({sessions.length})
                              </p>
                              {sessions.length ? (
                                <div className="space-y-4">
                                  {sessions.map(s => (
                                    <ArtifactCard key={s.id} artifact={s} title={`Sesión · ${fecha(s.created_at)}`} unitContext={unitCtx} />
                                  ))}
                                </div>
                              ) : (
                                <p className="rounded-md border border-dashed bg-card p-4 text-center text-sm text-muted-foreground">
                                  Sin sesiones registradas en esta unidad.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
