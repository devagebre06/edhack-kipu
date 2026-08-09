import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile, useTeacherDictados, useTeacherUnits, useSubmitArtifact } from '@/hooks'
import { Spinner } from '@/components'
import {
  Button, Input, Label, Alert, AlertDescription, Separator,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui'
import { CheckCircle2, AlertCircle, FileText, Upload, ArrowRight } from 'lucide-react'
import type { Artifact, Dictado } from '@/types'

// Tipos de evidencia que sube el docente en el modelo unificado.
const TIPOS = [
  { k: 'UNIDAD', label: 'Unidad de aprendizaje' },
  { k: 'SESION', label: 'Sesión de clase' },
]

const dictadoLabel = (d: Dictado) =>
  `${d.curso?.nombre ?? 'Curso'} · ${[d.aula?.grado, d.aula?.seccion].filter(Boolean).join(' ') || d.aula?.nombre || 'Aula'}${d.periodo ? ` · ${d.periodo.nombre}` : ''}`

export default function TeacherUpload() {
  const profile = useProfile()
  const navigate = useNavigate()
  const { data: dictados } = useTeacherDictados(profile.id)
  const { data: units } = useTeacherUnits(profile.id)
  const submitArtifact = useSubmitArtifact()

  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [tipo, setTipo] = useState('UNIDAD')
  const [dictadoId, setDictadoId] = useState('')
  const [unidadId, setUnidadId] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ score: number; valid: boolean; reason?: string | null } | null>(null)

  const isUnit = tipo === 'UNIDAD'
  const isSession = tipo === 'SESION'
  const busy = submitArtifact.isPending

  // Sesión: unidades ya subidas por el docente (excluyendo las que fallaron al procesar).
  const availableUnits = (units ?? []).filter(u => u.status !== 'PROCESSING_ERROR')
  const unitBlocked = isSession && availableUnits.length === 0

  const canSubmit = !!file && !!nombre.trim() && (isUnit ? !!dictadoId : !!unidadId)

  const changeTipo = (value: string) => {
    setTipo(value); setDictadoId(''); setUnidadId(''); setNombre(''); setError('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    if (!nombre.trim()) { setError('Ponle un nombre a la evidencia.'); return }
    const form = new FormData()
    form.append('file', file)
    form.append('tipo', tipo)
    form.append('nombre', nombre.trim())
    if (isUnit) {
      if (!dictadoId) { setError('Selecciona el dictado (curso/aula) de la unidad.'); return }
      form.append('dictado_id', dictadoId)
    } else {
      if (!unidadId) { setError('Selecciona la unidad de aprendizaje de la sesión.'); return }
      form.append('unidad_id', unidadId)
    }

    setError(''); setDone(null)
    try {
      const result = await submitArtifact.mutateAsync({ form })
      setFile(null); setDictadoId(''); setUnidadId(''); setNombre('')
      setDone({ score: result.evaluation?.overall_score ?? 0, valid: result.is_valid ?? false, reason: result.invalid_reason })
    } catch (err: any) { setError(err.message) }
  }

  const unitLabel = (u: Artifact) => {
    const date = new Date(u.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
    const rev = u.status === 'NEEDS_REVISION' ? ' · por corregir' : ''
    return `${u.name?.trim() || u.subjects?.name || 'Unidad'} · ${date}${rev}`
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Nueva entrega</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sube tu documento de planificación para recibir retroalimentación inmediata.</p>

      {done && (
        done.valid ? (
          <Alert variant="success" className="mt-4">
            <CheckCircle2 />
            <AlertDescription className="flex flex-col gap-2">
              <span className="font-medium">Entrega válida registrada — puntaje {done.score}/100</span>
              <span className="flex gap-3">
                <Button variant="link" size="sm" className="h-auto p-0 text-success" onClick={() => setDone(null)}>Subir otra</Button>
                <Button variant="link" size="sm" className="h-auto p-0 text-success" onClick={() => navigate('/profesor/entregas')}>Ver mis entregas</Button>
              </span>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="warning" className="mt-4">
            <AlertCircle />
            <AlertDescription className="flex flex-col gap-2">
              <span className="font-medium">Documento subido, pero no cuenta como entrega válida — puntaje {done.score}/100</span>
              <span className="text-muted-foreground">{done.reason || 'No alcanzó los criterios mínimos. Puedes subir una versión corregida desde «Mis entregas».'}</span>
              <span className="flex gap-3">
                <Button variant="link" size="sm" className="h-auto p-0 text-warning-foreground" onClick={() => setDone(null)}>Subir otra</Button>
                <Button variant="link" size="sm" className="h-auto p-0 text-warning-foreground" onClick={() => navigate('/profesor/entregas')}>Ver mis entregas</Button>
              </span>
            </AlertDescription>
          </Alert>
        )
      )}

      {!done && (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border bg-card p-5 shadow-xs">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo de evidencia</Label>
              <Select value={tipo} onValueChange={changeTipo}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.k} value={t.k}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isUnit && (
              <div className="space-y-1.5">
                <Label>Dictado (curso · aula)</Label>
                <Select value={dictadoId} onValueChange={setDictadoId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {(dictados ?? []).map(d => <SelectItem key={d.id} value={d.id}>{dictadoLabel(d)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!dictados?.length && <p className="text-xs text-warning-foreground">No tienes dictados asignados.</p>}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre de la {isUnit ? 'unidad' : 'sesión'}</Label>
            <Input id="nombre" type="text" required value={nombre} onChange={e => setNombre(e.target.value)}
              maxLength={120} placeholder={isUnit ? 'Ej. Unidad 3 · Fracciones y decimales' : 'Ej. Sesión 1 · Suma de fracciones'} />
          </div>

          {isSession && (
            unitBlocked ? (
              <Alert variant="warning">
                <AlertCircle />
                <AlertDescription className="flex flex-col gap-1">
                  <span className="font-medium">Falta la unidad de aprendizaje</span>
                  <span className="text-muted-foreground">
                    Antes de registrar una sesión debes subir su Unidad de aprendizaje. Cambia el tipo a «Unidad de aprendizaje» y súbela primero.
                  </span>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-1.5">
                <Label>Unidad de aprendizaje</Label>
                <Select value={unidadId} onValueChange={setUnidadId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona la unidad…" /></SelectTrigger>
                  <SelectContent>
                    {availableUnits.map(u => <SelectItem key={u.id} value={u.unit_id || u.id}>{unitLabel(u)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">La sesión se registra dentro de una unidad ya subida.</p>
              </div>
            )
          )}

          <div className="space-y-1.5">
            <Label>Documento de la evidencia</Label>
            <label
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f) }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'bg-muted/40 hover:border-primary/60 hover:bg-muted'}`}>
              <input type="file" accept=".pdf,.pptx,.xlsx" onChange={e => setFile(e.target.files?.[0] || null)} className="sr-only" />
              {file ? (
                <>
                  <FileText className="size-8 text-success" />
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB · Haz clic o arrastra otro archivo para reemplazarlo</p>
                </>
              ) : (
                <>
                  <Upload className="size-8 text-primary" />
                  <p className="font-medium text-foreground">Arrastra tu documento aquí o haz clic para seleccionarlo</p>
                  <p className="text-sm text-muted-foreground">Sube el archivo de tu planificación y lo evaluaremos al instante.</p>
                  <p className="text-xs text-muted-foreground">Formatos aceptados: PDF, PPTX o XLSX · máximo 15 MB</p>
                </>
              )}
            </label>
          </div>

          {isSession && (
            <p className="text-xs text-muted-foreground">Las sesiones solo pueden subirse desde 30 min antes del inicio de tu clase hasta su término.</p>
          )}

          {error && (
            <Alert variant="destructive" role="alert">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={busy || !canSubmit}>
            {busy ? 'Procesando…' : 'Enviar evidencia'}
          </Button>

          {busy && <Spinner text="Convirtiendo el documento y evaluando con los criterios pedagógicos. Esto toma menos de un minuto." />}
        </form>
      )}

      <div className="mt-6 rounded-xl border bg-card p-4 text-sm shadow-xs">
        <h3 className="font-semibold">¿Qué subir y cuándo?</h3>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li><span className="font-medium text-foreground">Unidad de aprendizaje</span> — al inicio de cada mes escolar. Debe subirse antes que sus sesiones.</li>
          <li><span className="font-medium text-foreground">Sesión de clase</span> — el mismo día, dentro de la ventana horaria y ligada a una unidad ya subida.</li>
        </ul>
        <Separator className="my-3" />
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/profesor/calendario')}>
          Ver calendario completo <ArrowRight />
        </Button>
      </div>
    </div>
  )
}
