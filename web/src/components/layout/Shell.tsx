import type { Profile } from '@/types'
import { auth } from '@/services'
import { Logo } from '../Logo'
import { Sidebar } from './Sidebar'

const ROLE_LABEL: Record<string, string> = { teacher: 'Docente', director: 'Directivo', ugel: 'UGEL 06' }

export function Shell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col bg-nav text-white">
        <div className="px-5 py-5">
          <Logo light />
          <p className="mt-1 text-[10px] text-white/40 uppercase tracking-wider">{ROLE_LABEL[profile.role]}</p>
        </div>
        <Sidebar role={profile.role} />
        <div className="shrink-0 border-t border-white/10 px-4 py-4 text-sm">
          <div className="font-medium leading-tight">{profile.full_name}</div>
          <button onClick={() => auth.signOut().finally(() => location.assign('/'))}
            className="mt-1 text-xs text-white/50 hover:text-white/90 transition-colors">Cerrar sesión</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto bg-bg px-8 py-6">{children}</main>
    </div>
  )
}
