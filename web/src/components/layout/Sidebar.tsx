import { NavLink } from 'react-router-dom'
import type { Role } from '@/types'
import { ICONS } from './icons'

function NavItem({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <NavLink to={to} className={({ isActive }) =>
      `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${isActive ? 'bg-nav-soft font-medium text-white' : 'text-white/65 hover:bg-nav-soft/50 hover:text-white'}`
    }>
      <span className="size-4 shrink-0 opacity-80">{icon}</span>
      {label}
    </NavLink>
  )
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/35">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function TeacherNav() {
  return (
    <>
      <NavSection label="Planificación">
        <NavItem to="/profesor/calendario" label="Calendario" icon={ICONS.calendar} />
      </NavSection>
      <NavSection label="Evidencias">
        <NavItem to="/profesor/subir" label="Nueva entrega" icon={ICONS.upload} />
        <NavItem to="/profesor/entregas" label="Mis entregas" icon={ICONS.list} />
      </NavSection>
    </>
  )
}

function DirectorNav() {
  return (
    <NavSection label="Institución">
      <NavItem to="/director" label="Panel general" icon={ICONS.chart} />
      <NavItem to="/director/entregas" label="Entregas" icon={ICONS.doc} />
      <NavItem to="/director/alertas" label="Alertas" icon={ICONS.bell} />
    </NavSection>
  )
}

function UgelNav() {
  return (
    <NavSection label="UGEL 06">
      <NavItem to="/ugel" label="Panel UGEL" icon={ICONS.globe} />
    </NavSection>
  )
}

export function Sidebar({ role }: { role: Role }) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 pb-4">
      {role === 'teacher' && <TeacherNav />}
      {role === 'director' && <DirectorNav />}
      {role === 'ugel' && <UgelNav />}
    </nav>
  )
}
