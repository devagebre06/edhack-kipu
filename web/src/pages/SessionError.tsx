import { auth } from '@/services'
import { Logo } from '@/components'
import { Button } from '@/components/ui'
import { UserX } from 'lucide-react'

// Se muestra cuando hay una sesión de Supabase válida pero no se pudo cargar
// un perfil: la cuenta no tiene fila en `profiles`, o la sesión guardada quedó
// inválida (falla el refresh del token) y RLS devuelve 0 filas.
export default function SessionError() {
  const reset = () => auth.signOut().finally(() => location.assign(import.meta.env.BASE_URL))
  return (
    <div className="grid min-h-screen place-items-center bg-background p-8">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center"><Logo size={26} /></div>
        <div className="mx-auto mt-8 grid size-12 place-items-center rounded-full bg-warning-muted text-warning-foreground">
          <UserX className="size-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">No pudimos cargar tu perfil</h1>
        <p className="mx-auto mt-2 max-w-[42ch] text-sm text-muted-foreground">
          Tu cuenta inició sesión, pero no tiene un perfil asignado o tu sesión expiró.
          Cierra sesión e ingresa de nuevo; si el problema persiste, contacta al administrador.
        </p>
        <Button onClick={reset} size="lg" className="mt-6 w-full">
          Cerrar sesión e intentar de nuevo
        </Button>
      </div>
    </div>
  )
}
