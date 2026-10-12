import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, GeoJSON, Popup, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { divIcon, latLngBounds, point } from 'leaflet'
import type { Feature, Geometry } from 'geojson'
import type { Map as LeafletMap, Layer, Polygon, PathOptions } from 'leaflet'
import { useMapa, useProfesores } from '@/hooks'
import { PROFESOR_SCORE_LABELS } from '@/config/scoringLabels'
import { Section, Spinner, Stat } from '@/components'
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import type { MapaBucket, MapaColegio, MapaDistribution, ProfesorResumen } from '@/types'
import distritosGeo from '@/data/distritos-ugel06.json'

// La vista y sus límites se calculan con los mismos seis distritos dibujados.
const DISTRICT_BOUNDS = latLngBounds(
  distritosGeo.features.flatMap(({ geometry }) =>
    geometry.coordinates.flatMap(ring => ring.map(([longitude, latitude]) => [latitude, longitude] as [number, number])),
  ),
)
const MAP_LIMITS = DISTRICT_BOUNDS.pad(0.12)
const DISTRICT_VIEW_PADDING: [number, number] = [24, 24]

function DistrictMapLimits() {
  const map = useMap()

  useEffect(() => {
    const updateMinZoom = () => {
      map.setMinZoom(0)
      map.setMinZoom(map.getBoundsZoom(DISTRICT_BOUNDS, false, point(48, 48)))
    }
    const fitDistricts = () => {
      updateMinZoom()
      map.fitBounds(DISTRICT_BOUNDS, { padding: DISTRICT_VIEW_PADDING })
    }
    map.setMaxBounds(MAP_LIMITS)
    fitDistricts()

    const onResize = () => {
      const atOverview = map.getZoom() <= map.getMinZoom()
      updateMinZoom()
      if (atOverview) map.fitBounds(DISTRICT_BOUNDS, { padding: DISTRICT_VIEW_PADDING })
    }
    map.on('resize', onResize)
    return () => { map.off('resize', onResize) }
  }, [map])

  return null
}
const COURSES = [
  { key: 'all', label: 'Ambos cursos' },
  { key: 'matematica', label: 'Matemática' },
  { key: 'comunicacion', label: 'Comunicación' },
]
const BUCKET_ORDER: MapaBucket[] = ['critico', 'intermedio', 'logrado']
const BUCKET_LABEL: Record<MapaBucket, string> = { critico: 'En inicio', intermedio: 'En proceso', logrado: 'Logrado' }
const BUCKET_TEXT_COLOR: Record<MapaBucket, string> = {
  critico: '#C62828', intermedio: '#9A6700', logrado: '#2E7D32',
}
const SORTED_BUCKETS: MapaBucket[] = ['logrado', 'intermedio', 'critico']

// ── Distritos de la UGEL 06 ──────────────────────────────────────────────────
// Paleta por distrito (misma del análisis) y helpers para casar el string de
// distrito que llega de la DB (canales.distrito) con la clave canónica.
const DISTRICT_PALETTE: Record<string, string> = {
  ATE: '#e6194B',
  CHACLACAYO: '#3cb44b',
  CIENEGUILLA: '#4363d8',
  'LA MOLINA': '#f58231',
  LURIGANCHO: '#911eb4',
  'SANTA ANITA': '#008080',
}
const DISTRICT_LABEL: Record<string, string> = {
  ATE: 'Ate', CHACLACAYO: 'Chaclacayo', CIENEGUILLA: 'Cieneguilla',
  'LA MOLINA': 'La Molina', LURIGANCHO: 'Lurigancho–Chosica', 'SANTA ANITA': 'Santa Anita',
}
const DISTRICT_ORDER = ['ATE', 'CHACLACAYO', 'CIENEGUILLA', 'LA MOLINA', 'LURIGANCHO', 'SANTA ANITA']
const NO_DISTRICT = '#94a3b8' // slate para distrito no reconocido
// Normaliza acentos, guiones y el sufijo "-Chosica" a la clave canónica.
const normDistrict = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[–—]/g, '-').replace(/\s*-\s*CHOSICA/, '').trim()
const districtColor = (district: string | null | undefined) => DISTRICT_PALETTE[normDistrict(district)] ?? NO_DISTRICT
type MapView = 'performance' | 'locations'
type LocatedSchool = MapaColegio & { latitude: number; longitude: number }
const hasCoordinates = (school: MapaColegio): school is LocatedSchool =>
  school.latitude != null && school.longitude != null

// Asigna cada resultado sintético a una ubicación real libre del mismo distrito.
// La asociación solo se usa en este mapa y no modifica los datos del colegio.
function assignDemoResults(schools: MapaColegio[]) {
  const real = schools.filter((school): school is LocatedSchool => !school.synthetic && hasCoordinates(school))
  const demo = schools.filter((school): school is LocatedSchool => school.synthetic && school.total_students > 0 && hasCoordinates(school))
  const available = new Map(real.map((school) => [school.school_key, school]))
  const results = new Map<string, LocatedSchool>()

  for (const sample of [...demo].sort((a, b) => a.school_key.localeCompare(b.school_key))) {
    const candidates = [...available.values()].filter((school) => normDistrict(school.district) === normDistrict(sample.district))
    const distance = (school: LocatedSchool) => {
      const latitude = school.latitude - sample.latitude
      const longitude = (school.longitude - sample.longitude) * Math.cos(sample.latitude * Math.PI / 180)
      return latitude * latitude + longitude * longitude
    }
    const closest = candidates.reduce<LocatedSchool | null>((best, school) =>
      !best || distance(school) < distance(best) ? school : best, null)
    if (!closest) continue
    results.set(closest.school_key, sample)
    available.delete(closest.school_key)
  }

  return { real, results }
}

const sortedPerformance = (distribution: MapaDistribution) => [...SORTED_BUCKETS]
  .sort((a, b) => distribution[b].pct - distribution[a].pct)

function donutIcon(distribution: MapaDistribution, size: number) {
  const total = SORTED_BUCKETS.reduce((sum, bucket) => sum + distribution[bucket].count, 0)
  const startYellow = total ? 100 * distribution.critico.count / total : 0
  const startGreen = total ? 100 * (distribution.critico.count + distribution.intermedio.count) / total : 0
  const gradient = `conic-gradient(#D32F2F 0 ${startYellow.toFixed(2)}%, #FBC02D ${startYellow.toFixed(2)}% ${startGreen.toFixed(2)}%, #43A047 ${startGreen.toFixed(2)}% 100%)`
  const half = size / 2
  return divIcon({
    className: 'kipu-performance-icon',
    html: `<span class="kipu-performance-donut" style="--donut-size:${size}px;--donut-inset:${Math.round(size * 0.25)}px;background:${gradient}"></span>`,
    iconSize: [size, size], iconAnchor: [half, half], popupAnchor: [0, -half], tooltipAnchor: [0, -half],
  })
}

// Estilo de cada polígono de distrito (borde de color, relleno tenue).
const distritoStyle = (feature?: Feature<Geometry, { distrito: string }>): PathOptions => {
  const color = DISTRICT_PALETTE[feature?.properties?.distrito ?? ''] ?? NO_DISTRICT
  return { color, weight: 2, fillColor: color, fillOpacity: 0.1 }
}
// Nombre del distrito como etiqueta permanente centrada + click → zoom al área.
const makeOnEachDistrito = (getMap: () => LeafletMap | null) =>
  (feature: Feature<Geometry, { nombre: string }>, layer: Layer) => {
    if (feature.properties?.nombre) {
      layer.bindTooltip(feature.properties.nombre, { permanent: true, direction: 'center', className: 'distrito-label' })
    }
    layer.on('click', () => {
      const map = getMap()
      if (map) map.fitBounds((layer as Polygon).getBounds(), { padding: [24, 24] })
    })
  }

function DistBar({ distribution }: { distribution: MapaDistribution }) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      {BUCKET_ORDER.map((b) => (
        <div key={b} style={{ width: `${distribution[b].pct}%`, background: distribution[b].color }} />
      ))}
    </div>
  )
}

// Barra de un scoring 0-100 con su etiqueta.
function ScoreBar({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

// Tarjeta de profesor: a la izquierda su desempeño diagnóstico (scorings, %
// logrado, distribución) y al lado la card con su contexto sociodemográfico.
function ProfesorCard({ p }: { p: ProfesorResumen }) {
  const ctx = p.contexto
  const s = p.scores
  const va = s.valor_agregado
  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4 shadow-xs md:grid-cols-[1fr_16rem]">
      {/* Desempeño */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">
            <span className="mr-1.5 text-muted-foreground tabular-nums">#{p.ranking}</span>
            {p.full_name}
          </span>
          <span className="text-xs text-muted-foreground">{p.course_name} · DNI {p.dni}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-6">
          <div>
            <div className="text-2xl font-semibold tabular-nums" style={{ color: s.nivel_color }}>
              {s.global}<span className="text-sm text-muted-foreground">/100</span>
            </div>
            <div className="text-xs" style={{ color: s.nivel_color }}>{s.nivel_label}</div>
          </div>
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
          {va != null && (
            <div>
              <div className={`text-2xl font-semibold tabular-nums ${va >= 0 ? 'text-success' : 'text-destructive'}`}>
                {va >= 0 ? '+' : ''}{va.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">vs. su distrito ({s.referencia_distrito ?? '—'})</div>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ScoreBar label={PROFESOR_SCORE_LABELS.logro} value={s.logro} hint="Promedio diagnóstico convertido de 1–4 a 0–100" />
          <ScoreBar label={PROFESOR_SCORE_LABELS.equidad} value={s.equidad} hint="Estudiantes en B, A o AD" />
          <ScoreBar label={PROFESOR_SCORE_LABELS.cobertura} value={s.cobertura} hint="Comparado con el mayor grupo evaluado" />
        </div>

        <div className="mt-4"><DistBar distribution={p.distribution} /></div>
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

function SchoolDetails({ school, demo }: { school: LocatedSchool; demo: LocatedSchool }) {
  const levels = sortedPerformance(demo.distribution)
  return (
    <Popup>
      <div className="min-w-[205px] space-y-1.5">
        <div className="font-semibold">{school.school_name}</div>
        <div className="text-xs text-gray-500">Ubicación real · desempeño simulado de las secciones de 4.º</div>
        <div className="text-xs">{school.district} · {demo.total_students} evaluaciones de muestra</div>
        <DistBar distribution={demo.distribution} />
        <ul className="text-xs">
          {levels.map((level) => (
            <li key={level} className="grid grid-cols-[5.25rem_max-content] gap-x-2">
              <span className="font-semibold">{BUCKET_LABEL[level]}</span>
              <span className="font-medium" style={{ color: BUCKET_TEXT_COLOR[level] }}>
                {demo.distribution[level].count} ({demo.distribution[level].pct}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Popup>
  )
}

function SchoolMarkers({ schools, results, view }: {
  schools: LocatedSchool[]
  results: Map<string, LocatedSchool>
  view: MapView
}) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  useEffect(() => {
    const updateZoom = () => setZoom(map.getZoom())
    map.on('zoomend', updateZoom)
    updateZoom()
    return () => { map.off('zoomend', updateZoom) }
  }, [map])
  const donutSize = Math.min(82, Math.round(28 + Math.max(0, zoom - 12) * 9))

  return schools.map((school) => {
    if (view === 'locations') return (
      <CircleMarker key={school.school_key} center={[school.latitude, school.longitude]} radius={5}
        pathOptions={{ color: '#fff', weight: 1, fillColor: districtColor(school.district), fillOpacity: 0.85 }}>
        <Tooltip direction="top"><strong>{school.school_name}</strong> · {school.district}</Tooltip>
      </CircleMarker>
    )
    const demo = results.get(school.school_key)
    return demo ? (
      <Marker key={school.school_key} position={[school.latitude, school.longitude]} icon={donutIcon(demo.distribution, donutSize)}>
        <SchoolDetails school={school} demo={demo} />
      </Marker>
    ) : (
      <CircleMarker key={school.school_key} center={[school.latitude, school.longitude]} radius={4}
        pathOptions={{ color: '#fff', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.75 }}>
        <Tooltip direction="top">{school.school_name} · Sin desempeño simulado asignado</Tooltip>
      </CircleMarker>
    )
  })
}

export default function MapaDiagnostico() {
  const [course, setCourse] = useState('all')
  const [mapView, setMapView] = useState<MapView>('performance')
  const mapRef = useRef<LeafletMap | null>(null)
  const cajaRef = useRef<HTMLDivElement | null>(null)
  const { data, isLoading } = useMapa(course)

  // Leaflet necesita actualizar el tamaño al colapsar la barra lateral o
  // redimensionar la ventana; el límite de zoom se recalcula en el mapa.
  useEffect(() => {
    const caja = cajaRef.current
    if (!caja) return
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize())
    ro.observe(caja)
    return () => ro.disconnect()
  }, [isLoading])
  const { data: profesores } = useProfesores(course, 4)

  if (isLoading || !data) return <Spinner text="Cargando mapa diagnóstico…" />

  const { real: schools, results } = assignDemoResults(data.colegios)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Mapa diagnóstico — UGEL 06</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mapView === 'performance'
              ? 'Ubicaciones reales de colegios en los seis distritos. Las donas muestran resultados simulados de 4.º de primaria.'
              : 'Ubicaciones reales de colegios en los seis distritos de la UGEL 06.'}
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-4">
          <div role="group" aria-label="Vista del mapa" className="inline-flex rounded-lg border bg-card p-1 text-sm">
            {([
              ['performance', 'Desempeño'],
              ['locations', 'Solo ubicaciones'],
            ] as const).map(([view, label]) => (
              <button key={view} type="button" aria-pressed={mapView === view} onClick={() => setMapView(view)}
                className={`rounded-md px-3 py-1.5 transition-colors ${mapView === view ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                {label}
              </button>
            ))}
          </div>
          {mapView === 'performance' && (
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
          )}
        </div>
      </div>

      <div className={`mt-6 grid gap-4 ${mapView === 'performance' ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Stat label="Colegios ubicados" value={schools.length} />
        <Stat label="Distritos" value={DISTRICT_ORDER.length} />
        {mapView === 'performance' && <Stat label="Colegios con muestra" value={results.size} />}
      </div>

      <Section title="Mapa por colegio">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Colores de los distritos">
          <span className="font-medium">Distritos</span>
          {DISTRICT_ORDER.map((district) => (
            <span key={district} className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-full" style={{ background: DISTRICT_PALETTE[district] }} />
              {DISTRICT_LABEL[district]}
            </span>
          ))}
        </div>
        <div ref={cajaRef} className="relative overflow-hidden rounded-lg border">
          <MapContainer ref={mapRef} className="kipu-diagnostic-map" bounds={DISTRICT_BOUNDS} maxBounds={MAP_LIMITS} maxBoundsViscosity={1} maxZoom={18} zoomSnap={0.25} zoomDelta={0.5} style={{ height: 'clamp(620px, 68vh, 760px)', width: '100%' }} scrollWheelZoom>
            <DistrictMapLimits />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* El mapa base queda atenuado; los distritos y colegios conservan su color. */}
            <GeoJSON data={distritosGeo as never} style={distritoStyle} onEachFeature={makeOnEachDistrito(() => mapRef.current)} />
            <SchoolMarkers schools={schools} results={results} view={mapView} />
          </MapContainer>
          <button type="button" aria-label="Volver a la vista inicial del mapa" title="Volver a la vista inicial"
            onClick={() => {
              const map = mapRef.current
              if (!map) return
              map.closePopup()
              map.fitBounds(DISTRICT_BOUNDS, { padding: DISTRICT_VIEW_PADDING })
            }}
            className="absolute bottom-4 left-4 z-[1000] rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-md transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Vista inicial
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {mapView === 'performance'
            ? `Mostrando ${schools.length} ubicaciones reales · ${results.size} donas con resultados sintéticos; los puntos grises no tienen muestra. Acércate para ampliar las donas. Estos resultados no representan el desempeño real de los colegios.`
            : `Mostrando ${schools.length} ubicaciones reales de colegios, sin datos de desempeño.`}
        </p>
      </Section>

      {mapView === 'performance' && <>
      <Section title="Docentes destacados · scoring y contexto">
        {profesores?.profesores.length ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              El score compuesto combina{' '}
              <strong>{PROFESOR_SCORE_LABELS.logro}</strong> ({Math.round(profesores.scoring.pesos.logro * 100)}%),{' '}
              <strong>{PROFESOR_SCORE_LABELS.equidad}</strong> ({Math.round(profesores.scoring.pesos.equidad * 100)}%) y{' '}
              <strong>{PROFESOR_SCORE_LABELS.cobertura}</strong> ({Math.round(profesores.scoring.pesos.cobertura * 100)}%), calculados
              sobre las notas diagnósticas de sus alumnos. El valor agregado compara su promedio con el de su
              distrito. Referencia UGEL: {profesores.scoring.referencias.promedio_ugel ?? '—'}/4 sobre{' '}
              {profesores.scoring.referencias.alumnos_evaluados} alumnos.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {profesores.scoring.niveles.map((n) => (
                <span key={n.key} className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: n.color }} />
                  {n.label} <span className="text-muted-foreground">(≥{n.min})</span>
                </span>
              ))}
            </div>
            {profesores.profesores.map((p) => <ProfesorCard key={p.dni} p={p} />)}
            <p className="text-xs text-muted-foreground">
              Mostrando {profesores.profesores.length} de {profesores.total} docentes, por score compuesto.
            </p>
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
      </>}
    </div>
  )
}
