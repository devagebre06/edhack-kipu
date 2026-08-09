import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STATUS_LABEL } from '@/config/labels'
import { useProfile, useTeacherArtifacts } from '@/hooks'
import { unitsWithSessions, latestVersion, latestEvaluation, previousEvaluation, subjectName, isValid, invalidReason } from '@/factories'
import { Badge, Spinner, Modal, ArtifactPdf, EvaluationView, EvaluationAnnotations } from '@/components'
import { Button } from '@/components/ui'
import { Plus, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from 'lucide-react'
import type { Artifact } from '@/types'

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

/** Chip de validez de la sesión (verde = válida, ámbar = no cuenta). */
function ValidityPill({ valid }: { valid: boolean }) {
  return valid
    ? <span className="inline-flex items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-xs font-medium text-success"><CheckCircle2 className="size-3" /> Válida</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-warning-muted px-2 py-0.5 text-xs font-medium text-warning-foreground"><AlertCircle className="size-3" /> No válida</span>
}

/** Bloque de una entrega (unidad o sesión): documento a la izquierda y la evaluación (citas + recomendaciones) a la derecha. */
function ArtifactBlock({ artifact, title }: { artifact: Artifact; title: string }) {
  const [full, setFull] = useState(false)
  const current = latestVersion(artifact)
  const ev = latestEvaluation(artifact)
  const score = ev?.overall_score
  const valid = isValid(artifact)
  const reason = invalidReason(artifact)

  return (
    <div className={`overflow-hidden rounded-xl border bg-card shadow-xs ${valid ? '' : 'border-warning/40'}`}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{current?.original_filename} · v{artifact.current_version}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ValidityPill valid={valid} />
          <Badge value={artifact.status} label={STATUS_LABEL[artifact.status]} />
        </div>
      </div>

      {!valid && reason && (
        <p className="border-b border-warning/30 bg-warning-muted px-4 py-2 text-xs text-warning-foreground">{reason}</p>
      )}

      <div className="grid lg:grid-cols-2">
        {/* Documento */}
        <div className="border-b lg:border-b-0 lg:border-r">
          <ArtifactPdf versionId={current?.id} filename={current?.original_filename} height="h-96" />
        </div>

        {/* Evaluación: texto evaluado con la recomendación encima */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
            <p className="text-sm font-medium">
              Evaluación {score != null && <span className="font-normal text-muted-foreground">· {score}/100</span>}
            </p>
            {ev && <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setFull(true)}>Ver completa</Button>}
          </div>
          <div className="px-4 py-3 lg:max-h-96 lg:overflow-y-auto">
            {ev ? <EvaluationAnnotations ev={ev} /> : <p className="text-sm text-muted-foreground">Sin evaluación disponible.</p>}
          </div>
        </div>
      </div>

      {full && (
        <Modal title={`Evaluación · ${title}`} onClose={() => setFull(false)}>
          {ev ? <EvaluationView ev={ev} prev={previousEvaluation(artifact)} /> : <p className="text-sm text-muted-foreground">Sin evaluación disponible.</p>}
        </Modal>
      )}
    </div>
  )
}

export default function TeacherUnits() {
  const profile = useProfile()
  const navigate = useNavigate()
  const { data: artifacts, isLoading } = useTeacherArtifacts(profile.id)

  const [openUnit, setOpenUnit] = useState<string | null>(null)
  const groups = unitsWithSessions(artifacts ?? [])

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis unidades</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tus unidades de aprendizaje y las sesiones registradas dentro de cada una.</p>
        </div>
        <Button className="shrink-0" onClick={() => navigate('/profesor/subir')}>
          <Plus /> Nueva entrega
        </Button>
      </div>

      {isLoading ? <Spinner text="Cargando unidades…" /> : (
        <div className="mt-6 space-y-2">
          {!groups.length && (
            <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              Aún no has subido ninguna unidad de aprendizaje.
            </p>
          )}

          {groups.map(({ unit, sessions }) => {
            const unitOpen = openUnit === unit.id
            const validCount = sessions.filter(isValid).length
            return (
              <div key={unit.id} className="overflow-hidden rounded-xl border bg-card shadow-xs">
                <button onClick={() => setOpenUnit(unitOpen ? null : unit.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted">
                  <div className="min-w-0">
                    <span className="font-medium">{unit.name?.trim() || subjectName(unit)}</span>
                    <span className="ml-2 truncate text-sm text-muted-foreground">
                      {subjectName(unit)} · {fecha(unit.created_at)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                      {validCount}/{sessions.length} {sessions.length === 1 ? 'sesión válida' : 'sesiones válidas'}
                    </span>
                    <Badge value={unit.status} label={STATUS_LABEL[unit.status]} />
                    {unitOpen
                      ? <ChevronUp className="size-4 text-muted-foreground" />
                      : <ChevronDown className="size-4 text-muted-foreground" />}
                  </div>
                </button>

                {unitOpen && (
                  <div className="space-y-6 border-t bg-muted/40 px-4 py-4 sm:px-5">
                    {/* La unidad de aprendizaje */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unidad de aprendizaje</p>
                      <ArtifactBlock artifact={unit} title={unit.name?.trim() || subjectName(unit)} />
                    </div>

                    {/* Sus sesiones */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Sesiones {sessions.length > 0 && <span className="font-normal">({sessions.length})</span>}
                      </p>
                      {!sessions.length ? (
                        <p className="rounded-xl border border-dashed bg-card p-4 text-center text-sm text-muted-foreground">
                          Esta unidad aún no tiene sesiones registradas.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {sessions.map(s => <ArtifactBlock key={s.id} artifact={s} title={`Sesión · ${fecha(s.created_at)}`} />)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
