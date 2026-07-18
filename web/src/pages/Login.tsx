import { useState } from 'react'
import { supabase } from '../lib'
import { Logo } from '../ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Correo o contraseña incorrectos.'); setBusy(false) }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-nav p-10 text-white lg:flex">
        <Logo light size={28} />
        <div>
          <h1 className="max-w-md text-3xl font-semibold leading-tight">Trazabilidad pedagógica que acompaña.</h1>
          <p className="mt-4 max-w-md text-white/75">Cada evidencia que registras es un nudo en la cuerda: retroalimentación inmediata para ti, visión clara para tu institución y tu UGEL.</p>
        </div>
        <p className="text-sm text-white/50">Las evaluaciones usan inteligencia artificial y siempre quedan sujetas a revisión humana.</p>
      </div>
      <div className="grid place-items-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="lg:hidden"><Logo size={26} /></div>
          <h2 className="mt-6 text-xl font-semibold">Inicia sesión</h2>
          <label className="mt-6 block text-sm font-medium" htmlFor="email">Correo</label>
          <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25" />
          <label className="mt-4 block text-sm font-medium" htmlFor="password">Contraseña</label>
          <input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25" />
          {error && <p className="mt-3 rounded-md bg-bad-bg px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
          <button disabled={busy} className="mt-6 w-full rounded-md bg-brand px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-deep disabled:opacity-60">
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
