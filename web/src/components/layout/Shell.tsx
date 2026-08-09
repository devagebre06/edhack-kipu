import type { Profile } from '@/types'
import { auth } from '@/services'
import { LogOut } from 'lucide-react'
import { Logo } from '../Logo'
import { ThemeToggle } from '../ThemeToggle'
import { Sidebar } from './Sidebar'

const ROLE_LABEL: Record<string, string> = { teacher: 'Docente', director: 'Directivo', ugel: 'UGEL 06' }

// Iniciales para el avatar de pie de barra lateral.
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'

export function Shell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <Logo light />
          <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-accent-foreground">
            {ROLE_LABEL[profile.role]}
          </span>
        </div>

        <Sidebar role={profile.role} />

        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
              {initials(profile.full_name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium leading-tight text-sidebar-foreground">{profile.full_name}</div>
              <button
                onClick={() => auth.signOut().finally(() => location.assign('/'))}
                className="mt-0.5 inline-flex items-center gap-1 text-xs text-sidebar-foreground/55 transition-colors hover:text-sidebar-foreground"
              >
                <LogOut className="size-3" />
                Cerrar sesión
              </button>
            </div>
            <ThemeToggle tone="sidebar" className="shrink-0" />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">{children}</div>
      </main>
    </div>
  )
}
