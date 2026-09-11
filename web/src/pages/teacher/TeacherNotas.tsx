import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Upload, Save, RotateCcw } from 'lucide-react'
import { useProfile, useTeacherDictados, useRegistroNotas, useGuardarNotas } from '@/hooks'
import { cn } from '@/lib/utils'
import { descargarPlantilla, leerExcelNotas } from '@/services/notasExcel'
import { Modal, Section, Spinner, Stat } from '@/components'
import {
  Button, Card, CardContent, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Alert, AlertDescription,
} from '@/components/ui'
import type { RegistroNotas } from '@/types'

const COLOR: Record<string, string> = { C: '#D32F2F', B: '#FBC02D', A: '#43A047', AD: '#2E7D32' }

/** Una celda que cambiaría al aplicar el archivo. */
type CambioImportado = { alumnoId: string; alumno: string; competencia: string; previo: string; nuevo: string }
type Previsualizacion = {
  archivo: string
  notas: Record<string, Record<string, string>>
  reconocidos: number
  avisos: string[]
  cambios: CambioImportado[]
}
const VALOR: Record<string, number> = { C: 1, B: 2, A: 3, AD: 4 }

/**
 * Celda de nota: botones C/B/A/AD en vez de un desplegable. Con 33 alumnos × 4
 * competencias son 132 celdas, y un select por celda obliga a dos clics y a leer
 * un texto largo dentro de un espacio mínimo. Aquí basta un clic; volver a
 * pulsar el nivel activo lo borra.
 */
function CeldaNota({ valor, escala, etiqueta, onChange }: {
  valor: string
  escala: { codigo: string; nombre: string }[]
  etiqueta: string
  onChange: (v: string) => void
}) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex overflow-hidden rounded-md border">
      {escala.map((e) => {
        const activo = valor === e.codigo
        return (
          <button
            key={e.codigo}
            type="button"
            aria-pressed={activo}
            title={`${e.codigo} · ${e.nombre}`}
            onClick={() => onChange(activo ? '' : e.codigo)}
            className={cn(
              'w-9 border-r py-1 text-[11px] font-semibold tabular-nums transition-colors last:border-r-0',
              activo ? 'text-white' : 'text-muted-foreground hover:bg-muted',
            )}
            style={activo ? { background: COLOR[e.codigo] } : undefined}
          >
            {e.codigo}
          </button>
        )
      })}
    </div>
  )
}

const aulaLabel = (d: { curso?: { nombre: string } | null; aula?: { grado: string | null; seccion: string | null; nombre: string | null } | null }) =>
  [d.curso?.nombre, [d.aula?.grado, d.aula?.seccion].filter(Boolean).join(' ') || d.aula?.nombre].filter(Boolean).join(' · ')

/** Promedio y nivel de una fila, con la misma regla que aplica el backend. */
function resumenFila(notas: Record<string, string>, competencias: string[]) {
  const valores = competencias.map(c => notas[c]).filter(Boolean).map(n => VALOR[n])
  if (!valores.length) return { promedio: null as number | null, nivel: null as string | null }
  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length
  const nivel = (['C', 'B', 'A', 'AD'] as const)[Math.min(4, Math.max(1, Math.round(promedio))) - 1]
  return { promedio: Math.round(promedio * 100) / 100, nivel }
}

export default function TeacherNotas() {
  const profile = useProfile()
  const { data: dictados, isLoading: cargandoDictados } = useTeacherDictados(profile.id)
  const [dictadoId, setDictadoId] = useState('')
  const [periodoId, setPeriodoId] = useState('')

  // Primer dictado por defecto, para que la pantalla no arranque vacía.
  useEffect(() => {
    if (!dictadoId && dictados?.length) setDictadoId(dictados[0].id)
  }, [dictados, dictadoId])

  const { data: registro, isLoading, error } = useRegistroNotas(dictadoId, periodoId || undefined)
  const guardar = useGuardarNotas()
  const fileRef = useRef<HTMLInputElement>(null)

  // Borrador local: lo que el docente está escribiendo antes de guardar.
  const [borrador, setBorrador] = useState<Record<string, Record<string, string>>>({})
  const [avisos, setAvisos] = useState<string[]>([])
  const [preview, setPreview] = useState<Previsualizacion | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const firma = `${registro?.dictado.id}|${registro?.periodo.id}`
  useEffect(() => {
    if (!registro) return
    setBorrador(Object.fromEntries(registro.alumnos.map(a => [a.id, { ...a.notas }])))
    setAvisos([])
    // Se reinicia al cambiar de aula o de periodo: son registros distintos.
  }, [firma]) // eslint-disable-line react-hooks/exhaustive-deps

  const competencias = useMemo(() => registro?.competencias.map(c => c.codigo) ?? [], [registro])
  const conNota = useMemo(
    () => Object.values(borrador).filter(n => competencias.some(c => n[c])).length,
    [borrador, competencias],
  )
  const celdas = useMemo(
    () => Object.values(borrador).reduce((s, n) => s + competencias.filter(c => n[c]).length, 0),
    [borrador, competencias],
  )

  if (cargandoDictados) return <Spinner text="Cargando tus aulas…" />
  if (!dictados?.length) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Registro de notas</h1>
        <p className="mt-6 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Todavía no tienes aulas asignadas. Pídele a tu director que registre tus horarios.
        </p>
      </div>
    )
  }

  const setNota = (alumnoId: string, competencia: string, valor: string) =>
    setBorrador(b => ({ ...b, [alumnoId]: { ...b[alumnoId], [competencia]: valor } }))

  // El archivo nunca se aplica de golpe: primero se calcula qué cambiaría y el
  // docente lo aprueba. Importar debe ser reversible antes de tocar nada.
  const importar = async (archivo: File, reg: RegistroNotas) => {
    setLeyendo(true)
    try {
      const { notas, reconocidos, avisos: nuevos } = await leerExcelNotas(archivo, reg)
      if (!reconocidos) {
        toast.error('No se reconoció ninguna nota en el archivo.')
        setAvisos(nuevos)
        return
      }
      const nombreDe = new Map(reg.alumnos.map(a => [a.id, a.nombre]))
      const cambios: CambioImportado[] = []
      for (const [alumnoId, celdas] of Object.entries(notas)) {
        for (const [competencia, nuevo] of Object.entries(celdas)) {
          const previo = borrador[alumnoId]?.[competencia] ?? ''
          if (previo !== nuevo) {
            cambios.push({ alumnoId, alumno: nombreDe.get(alumnoId) ?? '—', competencia, previo, nuevo })
          }
        }
      }
      setPreview({ archivo: archivo.name, notas, reconocidos, avisos: nuevos, cambios })
    } catch (e: any) {
      toast.error(e.message ?? 'No se pudo leer el archivo.')
    } finally {
      setLeyendo(false)
    }
  }

  /** Aplica al borrador lo previsualizado (sigue sin guardarse en la base). */
  const aplicarImportacion = () => {
    if (!preview) return
    setBorrador(b => {
      const out = { ...b }
      for (const [alumnoId, celdas] of Object.entries(preview.notas)) out[alumnoId] = { ...out[alumnoId], ...celdas }
      return out
    })
    setAvisos(preview.avisos)
    toast.success(`${preview.cambios.length} nota(s) actualizadas. Revisa y pulsa «Guardar notas».`)
    setPreview(null)
  }

  const onGuardar = (reg: RegistroNotas) => {
    const filas = Object.entries(borrador)
      .map(([alumno_id, notas]) => ({
        alumno_id,
        notas: Object.fromEntries(competencias.filter(c => notas[c]).map(c => [c, notas[c]])),
      }))
      .filter(f => Object.keys(f.notas).length)
    if (!filas.length) { toast.error('Aún no has registrado ninguna nota.'); return }

    guardar.mutate({ dictado_id: reg.dictado.id, periodo_id: reg.periodo.id, filas }, {
      onSuccess: (r) => toast.success(`Notas guardadas · ${r.alumnos} alumnos en ${r.periodo}`),
      onError: (e: any) => toast.error(e.message ?? 'No se pudieron guardar las notas.'),
    })
  }

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Registro de notas</h1>
        <p className="mt-1 max-w-[75ch] text-sm text-muted-foreground">
          Registra el nivel de logro de cada estudiante por competencia. Puedes llenarlo aquí mismo o descargar la
          plantilla, completarla en Excel y volver a subirla. La nota general se calcula sola.
        </p>
      </header>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-muted-foreground">Aula y curso</Label>
          <Select value={dictadoId} onValueChange={(v) => { setDictadoId(v); setPeriodoId('') }}>
            <SelectTrigger className="mt-1 w-auto min-w-64" aria-label="Elegir aula y curso"><SelectValue /></SelectTrigger>
            <SelectContent>
              {dictados.map(d => <SelectItem key={d.id} value={d.id}>{aulaLabel(d)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {registro && (
          <div>
            <Label className="text-muted-foreground">Evaluación</Label>
            <Select value={registro.periodo.id} onValueChange={setPeriodoId}>
              <SelectTrigger className="mt-1 w-auto min-w-56" aria-label="Elegir periodo"><SelectValue /></SelectTrigger>
              <SelectContent>
                {registro.periodos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {error ? (
        <Alert className="mt-6">
          <AlertDescription>
            No se pudo cargar la nómina: {(error as Error).message}
          </AlertDescription>
        </Alert>
      ) : isLoading || !registro ? <div className="mt-8"><Spinner text="Cargando la nómina…" /></div> : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Estudiantes" value={registro.alumnos.length} />
            <Stat label="Con nota" value={`${conNota}/${registro.alumnos.length}`} tone={conNota === registro.alumnos.length ? 'ok' : undefined} />
            <Stat label="Competencias" value={competencias.length} />
            <Stat label="Institución" value={<span className="text-base">{registro.dictado.colegio ?? '—'}</span>} />
          </div>

          <Section
            title="Plantilla de Excel"
            right={
              <span className="text-xs text-muted-foreground">
                {registro.dictado.aula}{registro.dictado.turno ? ` · ${registro.dictado.turno}` : ''}
              </span>
            }
          >
            <Card>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" onClick={() => descargarPlantilla(registro)}>
                    <Download className="size-4" /> Descargar plantilla
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    La plantilla trae la nómina de tu aula y una columna por competencia. Si ya registraste notas,
                    vienen precargadas para que puedas corregirlas.
                  </p>
                </div>

                {/* Zona de arrastre: también acepta clic, por teclado y por si el
                    navegador no permite soltar archivos. */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Arrastra aquí el Excel con las notas o pulsa para elegirlo"
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
                  onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
                  onDragLeave={() => setArrastrando(false)}
                  onDrop={e => {
                    e.preventDefault()
                    setArrastrando(false)
                    const f = e.dataTransfer.files?.[0]
                    if (f) importar(f, registro)
                  }}
                  className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
                    arrastrando ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  {leyendo ? (
                    <span className="text-sm text-muted-foreground">Leyendo el archivo…</span>
                  ) : (
                    <>
                      <Upload className={cn('size-6', arrastrando ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="text-sm font-medium">
                        {arrastrando ? 'Suelta el archivo aquí' : 'Arrastra tu Excel o pulsa para elegirlo'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        .xlsx, .xls o .csv · verás una vista previa antes de aplicar nada
                      </span>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) importar(f, registro)
                    e.target.value = ''
                  }}
                />
              </CardContent>
            </Card>

            {avisos.length > 0 && (
              <Alert className="mt-3">
                <AlertDescription>
                  <ul className="list-inside list-disc space-y-0.5 text-sm">
                    {avisos.map(a => <li key={a}>{a}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </Section>

          <Section
            title={`Notas · ${registro.periodo.nombre}`}
            right={
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{celdas} nota(s) por guardar</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBorrador(Object.fromEntries(registro.alumnos.map(a => [a.id, { ...a.notas }])))}
                >
                  <RotateCcw className="size-4" /> Descartar cambios
                </Button>
                <Button size="sm" onClick={() => onGuardar(registro)} disabled={guardar.isPending}>
                  <Save className="size-4" /> {guardar.isPending ? 'Guardando…' : 'Guardar notas'}
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="w-10 px-3 py-2 font-medium text-muted-foreground">N°</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Estudiante</th>
                    {registro.competencias.map(c => (
                      <th key={c.codigo} className="px-2 py-2 text-center font-medium" title={c.nombre}>
                        {c.codigo}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Nota general</th>
                  </tr>
                </thead>
                <tbody>
                  {registro.alumnos.map((a, i) => {
                    const notas = borrador[a.id] ?? {}
                    const { promedio, nivel } = resumenFila(notas, competencias)
                    return (
                      <tr key={a.id} className="border-b last:border-b-0">
                        <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{a.numero ?? i + 1}</td>
                        <td className="px-3 py-1.5">{a.nombre}</td>
                        {competencias.map(c => (
                          <td key={c} className="px-2 py-1.5 text-center">
                            <CeldaNota
                              valor={notas[c] ?? ''}
                              escala={registro.escala}
                              etiqueta={`${c} de ${a.nombre}`}
                              onChange={v => setNota(a.id, c, v)}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-center">
                          {nivel ? (
                            <span className="font-semibold" style={{ color: COLOR[nivel] }}>
                              {nivel} <span className="font-normal text-muted-foreground tabular-nums">({promedio})</span>
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Escala: {registro.escala.map(e => `${e.codigo} = ${e.nombre}`).join(' · ')}. Deja en «—» lo que aún no evalúas.
            </p>
          </Section>

          {preview && (
            <Modal title={`Vista previa · ${preview.archivo}`} onClose={() => setPreview(null)}>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg border px-3 py-2">
                    <div className="text-lg font-semibold tabular-nums">{preview.reconocidos}</div>
                    <div className="text-[11px] text-muted-foreground">estudiantes reconocidos</div>
                  </div>
                  <div className="rounded-lg border px-3 py-2">
                    <div className="text-lg font-semibold tabular-nums">{preview.cambios.length}</div>
                    <div className="text-[11px] text-muted-foreground">notas que cambian</div>
                  </div>
                  <div className="rounded-lg border px-3 py-2">
                    <div className="text-lg font-semibold tabular-nums">{preview.avisos.length}</div>
                    <div className="text-[11px] text-muted-foreground">avisos</div>
                  </div>
                </div>

                {preview.avisos.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      <ul className="list-inside list-disc space-y-0.5 text-sm">
                        {preview.avisos.map(a => <li key={a}>{a}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {preview.cambios.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    El archivo coincide con lo que ya tienes: no hay nada que cambiar.
                  </p>
                ) : (
                  <div className="max-h-80 overflow-y-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-medium text-muted-foreground">Estudiante</th>
                          <th className="px-2 py-2 font-medium text-muted-foreground">Competencia</th>
                          <th className="px-2 py-2 text-center font-medium text-muted-foreground">Antes</th>
                          <th className="px-2 py-2 text-center font-medium text-muted-foreground">Después</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.cambios.map(c => (
                          <tr key={`${c.alumnoId}-${c.competencia}`} className="border-t">
                            <td className="px-3 py-1.5">{c.alumno}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">{c.competencia}</td>
                            <td className="px-2 py-1.5 text-center">
                              {c.previo
                                ? <span className="font-semibold" style={{ color: COLOR[c.previo] }}>{c.previo}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <span className="font-semibold" style={{ color: COLOR[c.nuevo] }}>{c.nuevo}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={() => setPreview(null)}>Cancelar</Button>
                  <Button onClick={aplicarImportacion} disabled={!preview.cambios.length}>
                    Aplicar {preview.cambios.length} cambio(s)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Aplicar solo llena la tabla; las notas se envían cuando pulses «Guardar notas».
                </p>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  )
}
