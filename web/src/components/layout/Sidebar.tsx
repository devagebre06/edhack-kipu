import { NavLink } from 'react-router-dom'
import type { Role } from '@/types'
import {
  Calendar, Upload, FileText, ListChecks, LayoutDashboard, Bell,
  Globe, Map, Users, Layers, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors outline-none',
          'focus-visible:ring-2 focus-visible:ring-sidebar-ring/60',
          isActive
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-4 shrink-0', isActive ? 'text-sidebar-primary' : 'opacity-80')} />
          {label}
        </>
      )}
    </NavLink>
  )
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function TeacherNav() {
  return (
    <>
      <NavSection label="Planificación">
        <NavItem to="/profesor/calendario" label="Calendario" icon={Calendar} />
      </NavSection>
      <NavSection label="Evidencias">
        <NavItem to="/profesor/subir" label="Nueva entrega" icon={Upload} />
        <NavItem to="/profesor/unidades" label="Mis unidades" icon={FileText} />
        <NavItem to="/profesor/entregas" label="Mis entregas" icon={ListChecks} />
      </NavSection>
    </>
  )
}

function DirectorNav() {
  return (
    <NavSection label="Institución">
      <NavItem to="/director" label="Panel general" icon={LayoutDashboard} />
      <NavItem to="/director/entregas" label="Entregas" icon={FileText} />
      <NavItem to="/director/contextos" label="Contextos" icon={Layers} />
      <NavItem to="/director/horarios" label="Horarios" icon={Calendar} />
      <NavItem to="/director/alertas" label="Alertas" icon={Bell} />
    </NavSection>
  )
}

function UgelNav() {
  return (
    <NavSection label="UGEL 06">
      <NavItem to="/ugel" label="Panel UGEL" icon={Globe} />
      <NavItem to="/ugel/mapa" label="Mapa diagnóstico" icon={Map} />
      <NavItem to="/ugel/usuarios" label="Usuarios" icon={Users} />
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
