import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, GeoJSON, Popup, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature, Geometry } from 'geojson'
import type { Map as LeafletMap, Layer, Polygon, PathOptions } from 'leaflet'
import { useMapa, useProfesores } from '@/hooks'
import { PROFESOR_SCORE_LABELS } from '@/config/scoringLabels'
import { Section, Spinner, Stat } from '@/components'
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import type { MapaBucket, MapaColegio, MapaDistribution, ProfesorResumen } from '@/types'
import distritosGeo from '@/data/distritos-ugel06.json'

// Centro aproximado de la UGEL 06 (Ate / La Molina / Cieneguilla).
const CENTER: [number, number] = [-12.06, -76.9]
const COURSES = [
  { key: 'all', label: 'Ambos cursos' },
  { key: 'matematica', label: 'Matemática' },
  { key: 'comunicacion', label: 'Comunicación' },
]
const BUCKET_ORDER: MapaBucket[] = ['critico', 'intermedio', 'logrado']
const BUCKET_LABEL: Record<MapaBucket, string> = { critico: 'Crítico', intermedio: 'Intermedio', logrado: 'Logrado' }

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
const NO_DATA_COLOR = '#cbd5e1' // gris para colegio sin evaluación (modo logro)
// Normaliza acentos, guiones y el sufijo "-Chosica" a la clave canónica.
const normDistrict = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[–—]/g, '-').replace(/\s*-\s*CHOSICA/, '').trim()
const districtColor = (d: string | null | undefined) => DISTRICT_PALETTE[normDistrict(d)] ?? NO_DISTRICT

type ColorMode = 'logro' | 'distrito'
const COLOR_MODES: { key: ColorMode; label: string }[] = [
  { key: 'logro', label: 'Nivel de logro' },
  { key: 'distrito', label: 'Distrito' },
]

// Origen de los colegios a mostrar: reales (MINEDU) vs demo (sintéticos).
type DataSource = 'todos' | 'reales' | 'demo'
const DATA_SOURCES: { key: DataSource; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'reales', label: 'Reales' },
  { key: 'demo', label: 'Demo (sintéticos)' },
]

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

export default function MapaDiagnostico() {
  const [course, setCourse] = useState('all')
  const [colorMode, setColorMode] = useState<ColorMode>('distrito')
  const [source, setSource] = useState<DataSource>('reales')
  const mapRef = useRef<LeafletMap | null>(null)
  const cajaRef = useRef<HTMLDivElement | null>(null)
  const { data, isLoading } = useMapa(course)

  // Leaflet calcula su tamaño al montar: si el contenedor cambia de ancho
  // (colapsar la barra lateral, redimensionar la ventana) hay que avisarle, o
  // quedan franjas sin teselas y el centro se desplaza.
  useEffect(() => {
    const caja = cajaRef.current
    if (!caja) return
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize())
    ro.observe(caja)
    return () => ro.disconnect()
  }, [isLoading])
  const { data: profesores } = useProfesores(course, 4)

  if (isLoading || !data) return <Spinner text="Cargando mapa diagnóstico…" />

  const conCoords = data.colegios
    .filter((c): c is MapaColegio & { latitude: number; longitude: number } => c.latitude != null && c.longitude != null)
    .filter((c) => source === 'todos' || (source === 'reales' ? !c.synthetic : c.synthetic))

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Mapa diagnóstico — UGEL 06</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Colegios de la UGEL 06 sobre los seis distritos. El color de cada punto indica{' '}
            {colorMode === 'logro' ? 'el nivel de logro dominante' : 'el distrito al que pertenece'}.
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground">Datos</Label>
            <Select value={source} onValueChange={(v) => setSource(v as DataSource)}>
              <SelectTrigger size="sm" aria-label="Origen de datos" className="w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_SOURCES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground">Colorear por</Label>
            <Select value={colorMode} onValueChange={(v) => setColorMode(v as ColorMode)}>
              <SelectTrigger size="sm" aria-label="Colorear por" className="w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOR_MODES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat label="Colegios" value={data.totals.colegios} />
        <Stat label="Distritos" value={data.totals.distritos} />
        <Stat label="Evaluaciones" value={data.totals.evaluaciones} />
      </div>

      {/* Leyenda de logro (arriba del mapa). En modo distrito la leyenda va
          como caja sobre el mapa (ver abajo). */}
      {colorMode === 'logro' && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {BUCKET_ORDER.map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full" style={{ background: data.buckets[b].color }} />
              {data.buckets[b].label}
              <span className="text-muted-foreground">({data.buckets[b].grades.join(', ')})</span>
            </span>
          ))}
        </div>
      )}

      <Section title="Mapa por colegio">
        <div ref={cajaRef} className="relative overflow-hidden rounded-lg border">
          <MapContainer ref={mapRef} center={CENTER} zoom={11} minZoom={10} maxZoom={18} style={{ height: 480, width: '100%' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Polígonos de distrito: con datos reales o todos; ocultos en "Demo".
                Click en un distrito → zoom a esa sección. */}
            {source !== 'demo' && (
              <GeoJSON data={distritosGeo as never} style={distritoStyle} onEachFeature={makeOnEachDistrito(() => mapRef.current)} />
            )}
            {conCoords.map((c) => (
              <CircleMarker
                key={c.school_key}
                center={[c.latitude, c.longitude]}
                radius={c.total_students ? radiusFor(c.total_students) : 5}
                pathOptions={{
                  color: '#fff',
                  weight: 1.2,
                  fillColor: colorMode === 'distrito'
                    ? districtColor(c.district)
                    : c.dominant ? data.buckets[c.dominant].color : NO_DATA_COLOR,
                  fillOpacity: c.total_students ? 0.85 : 0.6,
                }}
              >
                <Tooltip>{c.school_name}</Tooltip>
                <Popup>
                  <div className="min-w-[200px] space-y-1.5">
                    <div className="font-semibold">{c.school_name}</div>
                    <div className="text-xs text-gray-500">{c.district}{c.network_name ? ` · ${c.network_name}` : ''}</div>
                    {c.total_students ? (
                      <>
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
                      </>
                    ) : (
                      <div className="text-xs text-gray-500">Sin evaluación diagnóstica registrada.</div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          {colorMode === 'distrito' && (
            <div className="absolute bottom-4 left-4 z-[1000] rounded-lg border bg-card/95 p-3 text-xs text-card-foreground shadow-md backdrop-blur-sm">
              <div className="mb-1.5 font-semibold">Distritos</div>
              <ul className="space-y-1">
                {DISTRICT_ORDER.map((d) => (
                  <li key={d} className="flex items-center gap-2">
                    <span className="size-3 rounded-sm" style={{ background: DISTRICT_PALETTE[d] }} />
                    <span>{DISTRICT_LABEL[d]}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-1.5 flex items-center gap-2 border-t pt-1.5 text-muted-foreground">
                <span className="size-2 rounded-full bg-slate-400" />
                Colegios
              </div>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Mostrando {conCoords.length} colegio(s) en el mapa
          {source !== 'todos' && ` · origen: ${source === 'reales' ? 'reales (MINEDU)' : 'demo (sintéticos)'}`}.
        </p>
      </Section>

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
    </div>
  )
}
