import { useState } from 'react'
import { auth } from '@/services'
import { Logo, ThemeToggle } from '@/components'
import { Button, Input, Label, Alert, AlertDescription } from '@/components/ui'
import { AlertCircle } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await auth.signIn(email, password)
    if (error) { setError('Correo o contraseña incorrectos.'); setBusy(false) }
  }

  return (
    <div className="relative grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      {/* Panel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--sidebar-primary), transparent 70%)' }}
          aria-hidden
        />
        <Logo light size={28} />
        <div className="relative">
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Trazabilidad pedagógica que acompaña.
          </h1>
          <p className="mt-4 max-w-md text-sidebar-foreground/75">
            Cada evidencia que registras es un nudo en la cuerda: retroalimentación inmediata para ti,
            visión clara para tu institución y tu UGEL.
          </p>
        </div>
        <p className="relative text-sm text-sidebar-foreground/50">
          Las evaluaciones usan inteligencia artificial y siempre quedan sujetas a revisión humana.
        </p>
      </div>

      {/* Formulario */}
      <div className="grid place-items-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="lg:hidden"><Logo size={26} /></div>
          <h2 className="mt-6 text-xl font-semibold tracking-tight lg:mt-0">Inicia sesión</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ingresa con tu cuenta institucional.</p>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" placeholder="correo@ejemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" placeholder="••••••••" />
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={busy} size="lg" className="mt-6 w-full">
            {busy ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
