import { useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useMapa, useProfesores } from '@/hooks'
import { Section, Spinner, Stat } from '@/components'
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import type { MapaBucket, MapaColegio, MapaDistribution, ProfesorResumen } from '@/types'

// Centro aproximado de la UGEL 06 (Ate / La Molina / Cieneguilla).
const CENTER: [number, number] = [-12.06, -76.9]
const COURSES = [
  { key: 'all', label: 'Ambos cursos' },
  { key: 'matematica', label: 'Matemática' },
  { key: 'comunicacion', label: 'Comunicación' },
]
const BUCKET_ORDER: MapaBucket[] = ['critico', 'intermedio', 'logrado']
const BUCKET_LABEL: Record<MapaBucket, string> = { critico: 'Crítico', intermedio: 'Intermedio', logrado: 'Logrado' }

// Radio del punto en función del nº de estudiantes evaluados.
const radiusFor = (total: number) => 8 + Math.min(18, total / 12)

function DistBar({ distribution }: { distribution: MapaDistribution }) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      {BUCKET_ORDER.map((b) => (
        <div key={b} style={{ width: `${distribution[b].pct}%`, background: distribution[b].color }} />
      ))}
    </div>
  )
}

// Tarjeta de profesor: a la izquierda su desempeño diagnóstico (score, % logrado,
// distribución) y al lado la card con su contexto sociodemográfico.
function ProfesorCard({ p }: { p: ProfesorResumen }) {
  const ctx = p.contexto
  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4 shadow-xs md:grid-cols-[1fr_16rem]">
      {/* Desempeño */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">{p.full_name}</span>
          <span className="text-xs text-muted-foreground">{p.course_name} · DNI {p.dni}</span>
        </div>
        <div className="mt-3 flex items-center gap-6">
          <div>
            <div className="text-2xl font-semibold tabular-nums">{p.average_score_1_to_4 ?? '—'}<span className="text-sm text-muted-foreground">/4</span></div>
            <div className="text-xs text-muted-foreground">Promedio</div>
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums text-success">{p.pct_logrado}%</div>
            <div className="text-xs text-muted-foreground">En nivel logrado</div>
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums">{p.total_evaluaciones}</div>
            <div className="text-xs text-muted-foreground">Estudiantes</div>
          </div>
        </div>
        <div className="mt-3"><DistBar distribution={p.distribution} /></div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          {BUCKET_ORDER.map((b) => (
            <span key={b}>{BUCKET_LABEL[b]}: {p.distribution[b].count} ({p.distribution[b].pct}%)</span>
          ))}
        </div>
      </div>

      {/* Card demográfica */}
      <aside className="rounded-lg border bg-muted p-3 text-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contexto</div>
        <div className="mt-1.5 font-medium">{ctx.school_name ?? '—'}</div>
        {ctx.codigo_local && <div className="text-xs text-muted-foreground">Código local {ctx.codigo_local}</div>}
        {ctx.address && <div className="mt-1.5 text-xs">{ctx.address}</div>}
        <div className="mt-1.5 text-xs text-muted-foreground">{[ctx.district, ctx.network_name].filter(Boolean).join(' · ') || '—'}</div>
        {ctx.educational_levels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {ctx.educational_levels.map((lvl) => (
              <span key={lvl} className="rounded-full border px-2 py-0.5 text-xs">{lvl}</span>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}

export default function MapaDiagnostico() {
  const [course, setCourse] = useState('all')
  const { data, isLoading } = useMapa(course)
  const { data: profesores } = useProfesores(course, 4)

  if (isLoading || !data) return <Spinner text="Cargando mapa diagnóstico…" />

  const conCoords = data.colegios.filter((c): c is MapaColegio & { latitude: number; longitude: number } =>
    c.latitude != null && c.longitude != null)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Mapa diagnóstico — UGEL 06</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resultados de la evaluación diagnóstica por colegio. El color indica el nivel de logro dominante.
          </p>
        </header>
        <div className="flex items-center gap-2">
          <Label className="text-muted-foreground">Curso</Label>
          <Select value={course} onValueChange={setCourse}>
            <SelectTrigger size="sm" aria-label="Filtrar por curso" className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COURSES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat label="Colegios" value={data.totals.colegios} />
        <Stat label="Distritos" value={data.totals.distritos} />
        <Stat label="Evaluaciones" value={data.totals.evaluaciones} />
      </div>

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        {BUCKET_ORDER.map((b) => (
          <span key={b} className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{ background: data.buckets[b].color }} />
            {data.buckets[b].label}
            <span className="text-muted-foreground">({data.buckets[b].grades.join(', ')})</span>
          </span>
        ))}
      </div>

      <Section title="Mapa por colegio">
        <div className="overflow-hidden rounded-lg border">
          <MapContainer center={CENTER} zoom={11} style={{ height: 480, width: '100%' }} scrollWheelZoom={false}>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {conCoords.map((c) => (
              <CircleMarker
                key={c.school_key}
                center={[c.latitude, c.longitude]}
                radius={radiusFor(c.total_students)}
                pathOptions={{ color: '#fff', weight: 1.5, fillColor: data.buckets[c.dominant].color, fillOpacity: 0.85 }}
              >
                <Tooltip>{c.school_name}</Tooltip>
                <Popup>
                  <div className="min-w-[200px] space-y-1.5">
                    <div className="font-semibold">{c.school_name}</div>
                    <div className="text-xs text-gray-500">{c.district} · {c.network_name}</div>
                    <div className="text-xs">
                      {c.total_students} evaluaciones · promedio {c.average_score_1_to_4 ?? '—'}/4
                    </div>
                    <DistBar distribution={c.distribution} />
                    <ul className="text-xs">
                      {BUCKET_ORDER.map((b) => (
                        <li key={b} className="flex justify-between">
                          <span>{BUCKET_LABEL[b]}</span>
                          <span>{c.distribution[b].count} ({c.distribution[b].pct}%)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        {conCoords.length < data.colegios.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            {data.colegios.length - conCoords.length} colegio(s) sin coordenadas no se muestran en el mapa.
          </p>
        )}
      </Section>

      <Section title="Profesores destacados y su contexto">
        {profesores?.profesores.length ? (
          <div className="space-y-3">
            {profesores.profesores.map((p) => <ProfesorCard key={p.dni} p={p} />)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin datos de profesores para este curso.</p>
        )}
      </Section>

      <Section title="Resumen por distrito">
        <div className="space-y-2">
          {data.distritos.map((d) => (
            <div key={d.district} className="rounded-lg border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">{d.district}</span>
                <span className="text-sm text-muted-foreground">{d.schools} colegios · {d.total_students} evaluaciones</span>
              </div>
              <div className="mt-2"><DistBar distribution={d.distribution} /></div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                {BUCKET_ORDER.map((b) => (
                  <span key={b}>{BUCKET_LABEL[b]}: {d.distribution[b].count} ({d.distribution[b].pct}%)</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
