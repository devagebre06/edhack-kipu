import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STATUS_LABEL } from '@/config/labels'
import { useProfile, useTeacherArtifacts } from '@/hooks'
import { unitsWithSessions, subjectName, isValid } from '@/factories'
import { Badge, Spinner, ArtifactBlock } from '@/components'
import { Button } from '@/components/ui'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

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
