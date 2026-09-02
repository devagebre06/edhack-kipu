import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { toast } from 'sonner'
import { Play, FlaskConical, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { SEVERITY_LABEL, ALERT_STATUS_LABEL } from '@/config/labels'
import {
  useAlertas, useEvaluarAlertas, useCrearAlerta, useCambiarEstadoAlerta, useLimpiarAlertas,
  useRealtimeInvalidate, nextAlertStatus, qk,
} from '@/hooks'
import { Badge, Section, Spinner, Stat, Table } from '@/components'
import {
  Button, Card, CardContent, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea,
} from '@/components/ui'
import type { AlertaFila, EvaluacionAlertas, Severity } from '@/types'

const SEVERIDAD_COLOR: Record<string, string> = {
  LOW: '#94a3b8', MEDIUM: '#FBC02D', HIGH: '#D32F2F', CRITICAL: '#7f1d1d',
}
const ORIGEN_LABEL: Record<string, string> = { motor: 'Motor', manual: 'Manual', seed: 'Demo' }
const ORDEN_SEV = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

function AlertaCard({ a, onEstado }: { a: AlertaFila; onEstado: (id: string, estado: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const cerrada = a.estado === 'RESOLVED' || a.estado === 'DISMISSED'
  const siguiente = nextAlertStatus(a.estado)
  return (
    <div className={`rounded-xl border bg-card p-4 shadow-xs ${cerrada ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge value={a.severidad} label={SEVERITY_LABEL[a.severidad]} />
          <Badge value={a.estado} label={ALERT_STATUS_LABEL[a.estado]} />
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{a.tipo}</span>
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{ORIGEN_LABEL[a.origen]}</span>
          <span className="font-medium">{a.titulo}</span>
        </div>
        {!cerrada && (
          <div className="flex shrink-0 gap-2">
            {siguiente && (
              <Button variant="outline" size="sm" onClick={() => onEstado(a.id, siguiente)}>
                {a.estado === 'NEW' ? 'Tomar en revisión' : 'Marcar resuelta'}
              </Button>
            )}
            {a.estado === 'NEW' && (
              <Button variant="outline" size="sm" onClick={() => onEstado(a.id, 'ESCALATED')}>Escalar</Button>
            )}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onEstado(a.id, 'DISMISSED')}>
              Descartar
            </Button>
          </div>
        )}
      </div>
      <p className="mt-2 max-w-[80ch] text-sm text-muted-foreground">{a.resumen}</p>
      <p className="mt-1.5 text-sm"><span className="font-medium">Acción sugerida:</span> {a.accion_sugerida}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{a.colegio_nombre ?? 'Sin institución'}</span>
        <span>·</span>
        <span>{fecha(a.created_at)}</span>
        <button onClick={() => setAbierto(v => !v)} className="inline-flex items-center gap-1 underline">
          {abierto ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          Evidencia e historial
        </button>
      </div>
      {abierto && (
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <pre className="max-h-56 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
            {JSON.stringify(a.evidencia, null, 2)}
          </pre>
          <ul className="space-y-1 text-xs">
            {a.historial.length ? a.historial.map((h, i) => (
              <li key={i} className="rounded-lg border px-3 py-1.5">
                <span className="font-medium">{ALERT_STATUS_LABEL[h.estado] ?? h.estado}</span>
                {h.desde && <span className="text-muted-foreground"> ← {ALERT_STATUS_LABEL[h.desde] ?? h.desde}</span>}
                <div className="text-muted-foreground">{h.motivo ?? '—'} · {new Date(h.at).toLocaleString('es-PE')}</div>
              </li>
            )) : <li className="text-muted-foreground">Sin movimientos registrados.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function UgelAlertas() {
  const [estado, setEstado] = useState('')
  const [severidad, setSeveridad] = useState('')
  const [tipo, setTipo] = useState('')
  const { data, isLoading } = useAlertas({ estado, severidad, tipo })
  // La bandeja también escucha en vivo: si el motor corre en otra pestaña o un
  // director mueve una alerta, esta lista se entera sola.
  useRealtimeInvalidate('alertas', [['alertas'], qk.ugel])

  const evaluar = useEvaluarAlertas()
  const crear = useCrearAlerta()
  const cambiar = useCambiarEstadoAlerta()
  const limpiar = useLimpiarAlertas()

  const [preview, setPreview] = useState<EvaluacionAlertas | null>(null)
  const [umbrales, setUmbrales] = useState<Record<string, number>>({})
  const [manual, setManual] = useState({
    tipo: 'PRUEBA', severidad: 'MEDIUM' as Severity, titulo: '', resumen: '', accion_sugerida: '',
  })

  if (isLoading || !data) return <Spinner text="Cargando alertas…" />
  const { totals, por_severidad, por_tipo, reglas, alertas } = data

  const umbralDe = (codigo: string) =>
    umbrales[codigo] ?? reglas.find(r => r.codigo === codigo)?.umbral_default ?? 0

  const onEstado = (id: string, nuevo: string) => {
    cambiar.mutate({ id, estado: nuevo, motivo: 'Cambio desde el panel UGEL' }, {
      onSuccess: () => toast.success(`Alerta ${ALERT_STATUS_LABEL[nuevo]?.toLowerCase() ?? nuevo}`),
      onError: (e) => toast.error(String(e)),
    })
  }

  const correr = (dryRun: boolean) => {
    evaluar.mutate({ dry_run: dryRun, umbrales }, {
      onSuccess: (res) => {
        setPreview(res)
        toast.success(dryRun
          ? `${res.candidatas} situaciones detectadas · ${res.omitidas_por_duplicado} ya estaban abiertas`
          : `${res.creadas} alertas generadas`)
      },
      onError: (e) => toast.error(String(e)),
    })
  }

  const crearManual = () => {
    if (!manual.titulo.trim() || !manual.resumen.trim() || !manual.accion_sugerida.trim()) {
      toast.error('Completa título, resumen y acción sugerida.')
      return
    }
    crear.mutate(manual, {
      onSuccess: () => {
        toast.success('Alerta de prueba creada')
        setManual({ ...manual, titulo: '', resumen: '', accion_sugerida: '' })
      },
      onError: (e) => toast.error(String(e)),
    })
  }

  const datosSeveridad = ORDEN_SEV.filter(s => por_severidad[s]).map(s => ({
    severidad: SEVERITY_LABEL[s], total: por_severidad[s], color: SEVERIDAD_COLOR[s],
  }))
  const datosTipo = Object.entries(por_tipo)
    .map(([t, n]) => ({ tipo: t, total: n }))
    .sort((a, b) => b.total - a.total)

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Situaciones que el motor detecta sobre las notas y las evidencias ya cargadas. Cada alerta trae la
          evidencia que la originó y una acción sugerida.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Alertas" value={totals.total} />
        <Stat label="Abiertas" value={totals.abiertas} />
        <Stat label="Nuevas" value={totals.nuevas} tone={totals.nuevas > 0 ? 'warn' : undefined} />
        <Stat label="Alta severidad" value={totals.criticas} tone={totals.criticas > 0 ? 'bad' : undefined} />
      </div>

      <Section title="Cómo se reparten">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">Por severidad.</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={datosSeveridad}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="severidad" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" name="Alertas" radius={[4, 4, 0, 0]}>
                    {datosSeveridad.map(d => <Cell key={d.severidad} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">Por regla que la generó.</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={datosTipo} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="tipo" fontSize={10} width={170} />
                  <Tooltip />
                  <Bar dataKey="total" name="Alertas" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── Banco de pruebas del motor ── */}
      <Section title="Probar el motor">
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cada regla mira una fuente distinta y tiene un umbral ajustable. <strong>Previsualizar</strong> muestra
              qué detectaría sin escribir nada; <strong>Generar</strong> crea las alertas. Reejecutar no duplica: si
              una situación ya tiene una alerta abierta, se omite.
            </p>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {reglas.map(r => (
                <div key={r.codigo} className="rounded-lg border p-3">
                  <div className="text-sm font-medium">{r.nombre}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{r.descripcion}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Label className="shrink-0 text-xs text-muted-foreground" htmlFor={`u-${r.codigo}`}>Umbral</Label>
                    <Input
                      id={`u-${r.codigo}`}
                      type="number"
                      step="0.05"
                      className="h-8 w-24"
                      value={umbralDe(r.codigo)}
                      onChange={(e) => setUmbrales(u => ({ ...u, [r.codigo]: Number(e.target.value) }))}
                    />
                    <span className="text-[11px] text-muted-foreground">{r.umbral_unidad}</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted-foreground">Fuente: {r.fuente}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => correr(true)} disabled={evaluar.isPending}>
                <FlaskConical className="size-4" /> Previsualizar
              </Button>
              <Button onClick={() => correr(false)} disabled={evaluar.isPending}>
                <Play className="size-4" /> Generar alertas
              </Button>
              <Button variant="ghost" className="text-destructive"
                onClick={() => limpiar.mutate('motor', {
                  onSuccess: (r) => toast.success(`${r.borradas} alertas del motor eliminadas`),
                  onError: (e) => toast.error(String(e)),
                })}
                disabled={limpiar.isPending}>
                <Trash2 className="size-4" /> Borrar las generadas por el motor
              </Button>
              {Object.keys(umbrales).length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setUmbrales({})}>Restablecer umbrales</Button>
              )}
            </div>

            {preview && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="text-sm">
                  {preview.dry_run ? 'Previsualización' : 'Ejecución'}: <strong>{preview.candidatas}</strong> situaciones
                  detectadas · <strong>{preview.omitidas_por_duplicado}</strong> ya tenían alerta abierta ·{' '}
                  <strong>{preview.dry_run ? preview.detalle.length : preview.creadas}</strong> {preview.dry_run ? 'se crearían' : 'creadas'}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                  {Object.entries(preview.por_regla).map(([r, n]) => (
                    <span key={r} className="rounded-full border bg-card px-2 py-0.5">{r}: {n}</span>
                  ))}
                </div>
                {preview.dry_run && preview.detalle.length > 0 && (
                  <ul className="mt-2 max-h-56 space-y-1 overflow-auto text-xs">
                    {preview.detalle.map((d, i) => (
                      <li key={i} className="rounded border bg-card px-2 py-1">
                        <span style={{ color: SEVERIDAD_COLOR[d.severidad] }}>[{SEVERITY_LABEL[d.severidad]}]</span>{' '}
                        {d.titulo}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </Section>

      <Section title="Crear una alerta de prueba">
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Inserta una alerta a mano para recorrer el ciclo completo (nueva → en revisión → resuelta) sin esperar
              a que una regla se dispare.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="m-tipo">Tipo</Label>
                <Input id="m-tipo" value={manual.tipo} onChange={e => setManual({ ...manual, tipo: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="m-sev">Severidad</Label>
                <Select value={manual.severidad} onValueChange={v => setManual({ ...manual, severidad: v as Severity })}>
                  <SelectTrigger id="m-sev"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="m-tit">Título</Label>
              <Input id="m-tit" value={manual.titulo} placeholder="Qué ocurre, en una línea"
                onChange={e => setManual({ ...manual, titulo: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="m-res">Resumen</Label>
              <Textarea id="m-res" rows={2} value={manual.resumen} placeholder="Con qué datos se sustenta"
                onChange={e => setManual({ ...manual, resumen: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="m-acc">Acción sugerida</Label>
              <Textarea id="m-acc" rows={2} value={manual.accion_sugerida} placeholder="Qué puede hacer la UGEL"
                onChange={e => setManual({ ...manual, accion_sugerida: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={crearManual} disabled={crear.isPending}>Crear alerta de prueba</Button>
              <Button variant="ghost" className="text-destructive"
                onClick={() => limpiar.mutate('manual', {
                  onSuccess: (r) => toast.success(`${r.borradas} alertas manuales eliminadas`),
                  onError: (e) => toast.error(String(e)),
                })}
                disabled={limpiar.isPending}>
                <Trash2 className="size-4" /> Borrar las creadas a mano
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section
        title={`Bandeja (${alertas.length})`}
        right={
          <div className="flex flex-wrap gap-2">
            <Select value={estado || 'all'} onValueChange={v => setEstado(v === 'all' ? '' : v)}>
              <SelectTrigger size="sm" aria-label="Filtrar por estado" className="w-auto min-w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo estado</SelectItem>
                {Object.entries(ALERT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={severidad || 'all'} onValueChange={v => setSeveridad(v === 'all' ? '' : v)}>
              <SelectTrigger size="sm" aria-label="Filtrar por severidad" className="w-auto min-w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda severidad</SelectItem>
                {Object.entries(SEVERITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tipo || 'all'} onValueChange={v => setTipo(v === 'all' ? '' : v)}>
              <SelectTrigger size="sm" aria-label="Filtrar por regla" className="w-auto min-w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda regla</SelectItem>
                {Object.keys(por_tipo).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {alertas.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No hay alertas con esos filtros.
          </p>
        ) : (
          <div className="space-y-3">
            {alertas.map(a => <AlertaCard key={a.id} a={a} onEstado={onEstado} />)}
          </div>
        )}
      </Section>

      <Section title="Reglas del motor">
        <Table
          head={['Código', 'Qué detecta', 'Fuente', 'Umbral por defecto']}
          empty="Sin reglas registradas."
          rows={reglas.map(r => [
            <span key={`c-${r.codigo}`} className="font-medium">{r.codigo}</span>,
            r.descripcion,
            <span key={`f-${r.codigo}`} className="text-muted-foreground">{r.fuente}</span>,
            `${r.umbral_default} ${r.umbral_unidad}`,
          ])}
        />
      </Section>
    </div>
  )
}
