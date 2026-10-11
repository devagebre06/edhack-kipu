import { useState } from 'react'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { STATUS_LABEL } from '@/config/labels'
import { ARTIFACT_STATUS_FILTERS } from '@/config/constants'
import { useUgelData } from '@/hooks'
import { unitsWithSessions, subjectName, isValid, countByStatus, artifactScore } from '@/factories'
import { Badge, Section, Spinner, Stat, ArtifactBlock } from '@/components'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import type { Artifact, Institution } from '@/types'

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

const docente = (a: Artifact) => a.profiles?.full_name ?? 'Docente sin identificar'
const aula = (a: Artifact) => {
  const g = a.student_groups
  return g ? [g.grade, g.name].filter(Boolean).join(' ') : ''
}

export default function UgelEvidencias() {
  const { data, isLoading } = useUgelData()
  const [buscar, setBuscar] = useState('')
  const [colegio, setColegio] = useState('')
  const [estado, setEstado] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)

  if (isLoading || !data) return <Spinner text="Cargando unidades y sesiones…" />
  const { artifacts, institutions } = data as { artifacts: Artifact[]; institutions: Institution[] }

  const nombreColegio = new Map(institutions.map(i => [i.id, i.name]))
  const grupos = unitsWithSessions(artifacts)

  // Se filtra por unidad: si la unidad calza, se muestra con todas sus sesiones.
  const texto = buscar.trim().toLowerCase()
  const filtrados = grupos.filter(({ unit, sessions }) => {
    if (colegio && unit.institution_id !== colegio) return false
    if (estado && unit.status !== estado && !sessions.some(s => s.status === estado)) return false
    if (texto) {
      const heno = [
        unit.name, docente(unit), subjectName(unit), aula(unit),
        nombreColegio.get(unit.institution_id ?? '') ?? '',
      ].join(' ').toLowerCase()
      if (!heno.includes(texto)) return false
    }
    return true
  })

  const sesiones = grupos.flatMap(g => g.sessions)
  const { approved, revision } = countByStatus(artifacts)
  const puntajes = artifacts.map(artifactScore).filter((s): s is number => s != null)
  const promedio = puntajes.length ? Math.round(puntajes.reduce((a, b) => a + b, 0) / puntajes.length) : null

  // Instituciones que realmente tienen entregas (no las 166 de la UGEL).
  const conEntregas = institutions
    .filter(i => artifacts.some(a => a.institution_id === i.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Unidades y sesiones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas las entregas de la UGEL con el mismo visor que ve el docente: el documento y su evaluación, lado a lado.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Unidades" value={grupos.length} />
        <Stat label="Sesiones" value={sesiones.length} />
        <Stat label="Aprobadas" value={approved} tone="ok" />
        <Stat label="Por corregir" value={revision} tone={revision ? 'warn' : undefined} />
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="relative w-72">
          <Label className="text-muted-foreground">Buscar</Label>
          <Search className="absolute left-2.5 top-[30px] size-4 text-muted-foreground" />
          <Input value={buscar} onChange={e => setBuscar(e.target.value)} className="mt-1 pl-8"
            placeholder="Unidad, docente, curso o aula…" aria-label="Buscar entregas" />
        </div>
        <div>
          <Label className="text-muted-foreground">Institución</Label>
          <Select value={colegio || 'all'} onValueChange={v => setColegio(v === 'all' ? '' : v)}>
            <SelectTrigger className="mt-1 w-auto min-w-56" aria-label="Filtrar por institución"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las instituciones</SelectItem>
              {conEntregas.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-muted-foreground">Estado</Label>
          <Select value={estado || 'all'} onValueChange={v => setEstado(v === 'all' ? '' : v)}>
            <SelectTrigger className="mt-1 w-auto min-w-44" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo estado</SelectItem>
              {ARTIFACT_STATUS_FILTERS.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s] ?? s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {promedio != null && (
          <span className="pb-2 text-sm text-muted-foreground">Puntaje promedio: <strong>{promedio}/100</strong></span>
        )}
      </div>

      <Section title={`Entregas (${filtrados.length} de ${grupos.length})`}>
        <div className="space-y-2">
          {!filtrados.length && (
            <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              Ninguna unidad coincide con los filtros.
            </p>
          )}

          {filtrados.map(({ unit, sessions }) => {
            const open = abierta === unit.id
            const validas = sessions.filter(isValid).length
            const colegioNombre = nombreColegio.get(unit.institution_id ?? '') ?? '—'
            return (
              <div key={unit.id} className="overflow-hidden rounded-xl border bg-card shadow-xs">
                <button onClick={() => setAbierta(open ? null : unit.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted">
                  <div className="min-w-0">
                    <span className="font-medium">{unit.name?.trim() || subjectName(unit)}</span>
                    <span className="ml-2 truncate text-sm text-muted-foreground">
                      {docente(unit)} · {colegioNombre}
                    </span>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {[subjectName(unit), aula(unit), fecha(unit.created_at)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                      {validas}/{sessions.length} {sessions.length === 1 ? 'sesión válida' : 'sesiones válidas'}
                    </span>
                    <Badge value={unit.status} label={STATUS_LABEL[unit.status]} />
                    {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                  </div>
                </button>

                {open && (
                  <div className="space-y-6 border-t bg-muted/40 px-4 py-4 sm:px-5">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unidad de aprendizaje</p>
                      <ArtifactBlock
                        artifact={unit}
                        title={unit.name?.trim() || subjectName(unit)}
                        subtitle={`${docente(unit)} · ${colegioNombre}`}
                      />
                    </div>

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
                          {sessions.map(s => (
                            <ArtifactBlock
                              key={s.id}
                              artifact={s}
                              title={s.name?.trim() || `Sesión · ${fecha(s.created_at)}`}
                              subtitle={`${docente(s)} · ${colegioNombre}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
