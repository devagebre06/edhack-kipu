import { useEffect, useState } from 'react'
import type { Profile } from '@/types'
import { auth } from '@/services'
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Logo } from '../Logo'
import { ThemeToggle } from '../ThemeToggle'
import { Sidebar } from './Sidebar'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<string, string> = { teacher: 'Docente', director: 'Directivo', ugel: 'UGEL 06' }
const CLAVE_COLAPSO = 'kipu.sidebar.colapsado'

// Iniciales para el avatar de pie de barra lateral.
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'

export function Shell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  // La preferencia de barra colapsada se recuerda entre sesiones.
  const [colapsado, setColapsado] = useState(() => {
    try { return localStorage.getItem(CLAVE_COLAPSO) === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(CLAVE_COLAPSO, colapsado ? '1' : '0') } catch { /* almacenamiento no disponible */ }
  }, [colapsado])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className={cn(
        'flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        colapsado ? 'w-16' : 'w-60',
      )}>
        <div className={cn('flex items-center pt-5 pb-4', colapsado ? 'flex-col gap-3 px-2' : 'justify-between gap-2 px-5')}>
          {!colapsado && <Logo light />}
          <div className={cn('flex items-center gap-1.5', colapsado && 'flex-col')}>
            {!colapsado && (
              <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-accent-foreground">
                {ROLE_LABEL[profile.role]}
              </span>
            )}
            <button
              onClick={() => setColapsado(v => !v)}
              title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
              aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
              aria-expanded={!colapsado}
              className="grid size-8 shrink-0 place-items-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60"
            >
              {colapsado ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          </div>
        </div>

        <Sidebar role={profile.role} collapsed={colapsado} />

        <div className="shrink-0 border-t border-sidebar-border p-3">
          {colapsado ? (
            <div className="flex flex-col items-center gap-2">
              <span
                title={profile.full_name}
                className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground"
              >
                {initials(profile.full_name)}
              </span>
              <button
                onClick={() => auth.signOut().finally(() => location.assign(import.meta.env.BASE_URL))}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="grid size-8 place-items-center rounded-md text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              >
                <LogOut className="size-4" />
              </button>
              <ThemeToggle tone="sidebar" />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {initials(profile.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium leading-tight text-sidebar-foreground">{profile.full_name}</div>
                <button
                  onClick={() => auth.signOut().finally(() => location.assign(import.meta.env.BASE_URL))}
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-sidebar-foreground/55 transition-colors hover:text-sidebar-foreground"
                >
                  <LogOut className="size-3" />
                  Cerrar sesión
                </button>
              </div>
              <ThemeToggle tone="sidebar" className="shrink-0" />
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">{children}</div>
      </main>
    </div>
  )
}
