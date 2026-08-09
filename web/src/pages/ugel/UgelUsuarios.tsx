import { useState } from 'react'
import { toast } from 'sonner'
import { useUsuarios, useCreateUsuario, useUpdateUsuario, useUsuarioLifecycle } from '@/hooks'
import { Section, Spinner, Badge } from '@/components'
import {
  Button, Input, Label, Separator, Alert, AlertDescription,
  Card, CardContent, CardHeader, CardTitle, CardDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui'
import { UserPlus, Mail, KeyRound, Trash2, RotateCcw, ShieldAlert, Settings2, AlertCircle } from 'lucide-react'
import type { NewUsuario, Role, UsuarioRow } from '@/types'

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'ugel', label: 'Usuario UGEL' },
  { value: 'director', label: 'Director' },
  { value: 'teacher', label: 'Profesor' },
]
const ROLE_LABEL: Record<Role, string> = { ugel: 'UGEL', director: 'Director', teacher: 'Profesor' }
const needsInstitution = (role: Role) => role === 'director' || role === 'teacher'

const EMPTY: NewUsuario = { email: '', password: '', full_name: '', role: 'teacher', institution_id: '' }

export default function UgelUsuarios() {
  const { data, isLoading } = useUsuarios()
  const createUsuario = useCreateUsuario()
  const [form, setForm] = useState<NewUsuario>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [managed, setManaged] = useState<UsuarioRow | null>(null)

  if (isLoading || !data) return <Spinner text="Cargando usuarios…" />
  const { institutions, users } = data

  const set = <K extends keyof NewUsuario>(k: K, v: NewUsuario[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.email || !form.password || !form.full_name) {
      setError('Completa nombre, correo y contraseña.')
      return
    }
    if (needsInstitution(form.role) && !form.institution_id) {
      setError('Selecciona la institución del director o profesor.')
      return
    }
    const payload: NewUsuario = { ...form, institution_id: needsInstitution(form.role) ? form.institution_id : null }
    createUsuario.mutate(payload, {
      onSuccess: (u) => {
        toast.success(`Usuario ${u.full_name} creado como ${ROLE_LABEL[u.role]}.`)
        setForm((f) => ({ ...EMPTY, role: f.role, institution_id: f.institution_id }))
      },
      onError: (err: any) => setError(err.message),
    })
  }

  const noInstitutions = institutions.length === 0

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Gestión de usuarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea cuentas de acceso para UGEL, directores y profesores. Directores y profesores se asignan a una institución.
        </p>
      </header>

      {/* Formulario de alta */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" /> Crear usuario
          </CardTitle>
          <CardDescription>La cuenta queda activa de inmediato, sin verificación de correo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input id="full_name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)}
                placeholder="Nombre y apellidos" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(v) => set('role', v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="correo@ejemplo.com" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => set('password', e.target.value)}
                placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
            </div>
            {needsInstitution(form.role) && (
              <div className="space-y-1.5">
                <Label>Institución</Label>
                <Select value={form.institution_id ?? ''} onValueChange={(v) => set('institution_id', v)} disabled={noInstitutions}>
                  <SelectTrigger><SelectValue placeholder="— Selecciona —" /></SelectTrigger>
                  <SelectContent>
                    {institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="sm:col-span-2">
              {noInstitutions && needsInstitution(form.role) && (
                <Alert variant="warning" className="mb-3">
                  <AlertCircle />
                  <AlertDescription>No hay instituciones registradas; no es posible crear directores o profesores todavía.</AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive" className="mb-3">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={createUsuario.isPending}>
                {createUsuario.isPending ? 'Creando…' : 'Crear usuario'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Listado */}
      <Section title={`Usuarios registrados (${users.length})`}>
        {users.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            Aún no hay usuarios registrados.
          </p>
        ) : (
          <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
            {users.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${u.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {initials(u.full_name)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-medium ${u.active ? '' : 'text-muted-foreground'}`}>{u.full_name}</span>
                      <Badge value={u.role} label={ROLE_LABEL[u.role]} />
                      {!u.active && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Dado de baja</span>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {u.email ?? '—'}{u.institution_name ? ` · ${u.institution_name}` : ''}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setManaged(u)}>
                  <Settings2 /> Gestionar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {managed && <ManageDialog user={managed} onClose={() => setManaged(null)} />}
    </div>
  )
}

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'

// ── Diálogo de gestión de un usuario ──────────────────────────────────────────
function ManageDialog({ user, onClose }: { user: UsuarioRow; onClose: () => void }) {
  const update = useUpdateUsuario()
  const { softDelete, hardDelete, restore } = useUsuarioLifecycle()
  const [email, setEmail] = useState(user.email ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmHard, setConfirmHard] = useState(false)

  const busy = update.isPending || softDelete.isPending || hardDelete.isPending || restore.isPending

  const run = (p: Promise<unknown>, okMsg: string, close = false) => {
    setError(null)
    p.then(() => { toast.success(okMsg); setPassword(''); if (close) onClose() })
     .catch((err: any) => setError(err.message))
  }

  const saveEmail = () => {
    if (!email || email === user.email) { setError('Ingresa un correo distinto.'); return }
    run(update.mutateAsync({ id: user.id, email }), 'Correo actualizado.')
  }
  const savePassword = () => {
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    run(update.mutateAsync({ id: user.id, password }), 'Contraseña actualizada.')
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gestionar · {user.full_name}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Correo */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground"><Mail className="size-3.5" /> Correo</Label>
            <div className="flex gap-2">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
              <Button onClick={saveEmail} disabled={busy} className="shrink-0">Actualizar</Button>
            </div>
          </div>

          {/* Contraseña */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground"><KeyRound className="size-3.5" /> Nueva contraseña</Label>
            <div className="flex gap-2">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy}
                placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
              <Button onClick={savePassword} disabled={busy} className="shrink-0">Cambiar</Button>
            </div>
          </div>

          <Separator />

          {/* Estado de la cuenta */}
          <div>
            <p className="text-sm font-medium">Estado de la cuenta</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              La baja lógica bloquea el acceso pero conserva el registro y sus datos. Reversible.
            </p>
            <div className="mt-2">
              {user.active ? (
                <Button variant="outline" disabled={busy}
                  onClick={() => run(softDelete.mutateAsync(user.id), 'Usuario dado de baja.', true)}
                  className="text-warning-foreground hover:bg-warning-muted">
                  <Trash2 /> Dar de baja
                </Button>
              ) : (
                <Button variant="outline" disabled={busy}
                  onClick={() => run(restore.mutateAsync(user.id), 'Usuario reactivado.', true)}>
                  <RotateCcw /> Reactivar usuario
                </Button>
              )}
            </div>
          </div>

          {/* Baja definitiva */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
              <ShieldAlert className="size-4" /> Zona de peligro · baja definitiva
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Elimina el perfil de la base de datos y la cuenta de acceso. No se puede deshacer.
            </p>
            {confirmHard ? (
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button variant="destructive" disabled={busy}
                  onClick={() => run(hardDelete.mutateAsync(user.id), 'Usuario eliminado.', true)}>
                  {hardDelete.isPending ? 'Eliminando…' : 'Sí, eliminar definitivamente'}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setConfirmHard(false)}>Cancelar</Button>
              </div>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => { setError(null); setConfirmHard(true) }}
                className="mt-2.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 /> Eliminar definitivamente
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
