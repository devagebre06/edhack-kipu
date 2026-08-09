import { useState } from 'react'
import { useHorarios, useCreateHorario, useDeleteHorario } from '@/hooks'
import { Section, Spinner } from '@/components'
import {
  Button, Input, Label, Alert, AlertDescription,
  Card, CardContent, CardHeader, CardTitle, CardDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui'
import { CalendarClock, AlertCircle, Trash2 } from 'lucide-react'
import type { NewHorario } from '@/types'

// 0=domingo … 6=sábado (coincide con horarios.dia_semana y Date.getDay()).
const WEEKDAYS = [
  { n: 1, label: 'Lunes' }, { n: 2, label: 'Martes' }, { n: 3, label: 'Miércoles' },
  { n: 4, label: 'Jueves' }, { n: 5, label: 'Viernes' }, { n: 6, label: 'Sábado' }, { n: 0, label: 'Domingo' },
]
const dayLabel = (n: number) => WEEKDAYS.find((d) => d.n === n)?.label ?? '—'
const hhmm = (t: string) => String(t).slice(0, 5)
const aulaLabel = (a: { grado: string | null; seccion: string | null; nombre: string | null } | null) =>
  a ? [a.grado, a.seccion].filter(Boolean).join(' ') || a.nombre || '—' : '—'

const EMPTY: NewHorario = { profesor_id: '', curso_id: '', aula_id: '', periodo_id: '', dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:30' }

export default function DirectorHorarios() {
  const { data, isLoading } = useHorarios()
  const createHorario = useCreateHorario()
  const deleteHorario = useDeleteHorario()
  const [form, setForm] = useState<NewHorario>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  if (isLoading || !data) return <Spinner text="Cargando horarios…" />
  const { teachers, cursos, aulas, periodos } = data

  const set = <K extends keyof NewHorario>(k: K, v: NewHorario[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.profesor_id || !form.curso_id || !form.aula_id || !form.periodo_id) {
      setError('Selecciona profesor, curso, aula y periodo.')
      return
    }
    createHorario.mutate(form, {
      onSuccess: () => setForm((f) => ({ ...EMPTY, profesor_id: f.profesor_id })),
      onError: (err: any) => setError(err.message),
    })
  }

  const noCatalog = cursos.length === 0 || aulas.length === 0 || periodos.length === 0

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Horarios de clase</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Asigna horarios a cada profesor. El horario se registra en su dictado (curso + aula + periodo).
        </p>
      </header>

      {/* Formulario de alta */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" /> Asignar un horario
          </CardTitle>
          <CardDescription>Define profesor, curso, aula, periodo, día y rango horario.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            {noCatalog && (
              <Alert variant="warning" className="mb-4">
                <AlertCircle />
                <AlertDescription>Tu colegio no tiene cursos, aulas o periodos registrados; no es posible crear horarios todavía.</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Profesor</Label>
                <Select value={form.profesor_id || undefined} onValueChange={(v) => set('profesor_id', v)}>
                  <SelectTrigger><SelectValue placeholder="— Selecciona —" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Curso</Label>
                <Select value={form.curso_id || undefined} onValueChange={(v) => set('curso_id', v)}>
                  <SelectTrigger><SelectValue placeholder="— Selecciona —" /></SelectTrigger>
                  <SelectContent>
                    {cursos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Aula</Label>
                <Select value={form.aula_id || undefined} onValueChange={(v) => set('aula_id', v)}>
                  <SelectTrigger><SelectValue placeholder="— Selecciona —" /></SelectTrigger>
                  <SelectContent>
                    {aulas.map((a) => <SelectItem key={a.id} value={a.id}>{aulaLabel(a)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Periodo</Label>
                <Select value={form.periodo_id || undefined} onValueChange={(v) => set('periodo_id', v)}>
                  <SelectTrigger><SelectValue placeholder="— Selecciona —" /></SelectTrigger>
                  <SelectContent>
                    {periodos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Día</Label>
                <Select value={String(form.dia_semana)} onValueChange={(v) => set('dia_semana', Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d) => <SelectItem key={d.n} value={String(d.n)}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="hora_inicio">Inicio</Label>
                  <Input id="hora_inicio" type="time" value={form.hora_inicio} onChange={(e) => set('hora_inicio', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hora_fin">Fin</Label>
                  <Input id="hora_fin" type="time" value={form.hora_fin} onChange={(e) => set('hora_fin', e.target.value)} />
                </div>
              </div>
            </div>
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="mt-4">
              <Button type="submit" disabled={createHorario.isPending || noCatalog}>
                {createHorario.isPending ? 'Agregando…' : 'Agregar horario'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Listado por profesor */}
      <Section title={`Profesores (${teachers.length})`}>
        {teachers.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            Tu colegio aún no tiene profesores registrados.
          </p>
        ) : (
          <div className="space-y-3">
            {teachers.map((t) => {
              const horarios = t.dictados.flatMap((d) =>
                d.horarios.map((h) => ({ ...h, curso: d.curso?.nombre ?? '—', aula: aulaLabel(d.aula) })),
              ).sort((a, b) => a.dia_semana - b.dia_semana || String(a.hora_inicio).localeCompare(String(b.hora_inicio)))
              return (
                <div key={t.id} className="rounded-xl border bg-card p-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-medium">{t.full_name}</span>
                    {t.dni && <span className="text-xs text-muted-foreground">DNI {t.dni}</span>}
                  </div>
                  {horarios.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">Sin horarios asignados.</p>
                  ) : (
                    <ul className="mt-3 divide-y">
                      {horarios.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="w-20 font-medium">{dayLabel(s.dia_semana)}</span>
                            <span className="tabular-nums text-muted-foreground">{hhmm(s.hora_inicio)}–{hhmm(s.hora_fin)}</span>
                            <span>{s.curso}</span>
                            <span className="text-muted-foreground">{s.aula}</span>
                          </span>
                          <Button
                            variant="outline" size="sm"
                            onClick={() => deleteHorario.mutate(s.id)}
                            disabled={deleteHorario.isPending}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Eliminar horario de ${dayLabel(s.dia_semana)}`}
                          >
                            <Trash2 /> Eliminar
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}
