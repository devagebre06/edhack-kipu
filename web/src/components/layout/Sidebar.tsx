import { NavLink } from 'react-router-dom'
import type { Role } from '@/types'
import {
  Calendar, Upload, FileText, ListChecks, LayoutDashboard, Bell,
  Globe, Map, Users, Layers, GraduationCap, UserRound, BookOpen, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function NavItem({ to, label, icon: Icon, collapsed }: {
  to: string; label: string; icon: LucideIcon; collapsed?: boolean
}) {
  return (
    <NavLink
      to={to}
      end
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-md text-sm transition-colors outline-none',
          'focus-visible:ring-2 focus-visible:ring-sidebar-ring/60',
          collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
          isActive
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-4 shrink-0', isActive ? 'text-sidebar-primary' : 'opacity-80')} />
          {!collapsed && label}
        </>
      )}
    </NavLink>
  )
}

function NavSection({ label, collapsed, children }: {
  label: string; collapsed?: boolean; children: React.ReactNode
}) {
  return (
    <div className={cn('mt-5 first:mt-0', collapsed && 'border-t border-sidebar-border/60 pt-3 first:border-t-0 first:pt-0')}>
      {!collapsed && (
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">{label}</p>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function TeacherNav({ collapsed }: { collapsed?: boolean }) {
  return (
    <>
      <NavSection label="Planificación" collapsed={collapsed}>
        <NavItem to="/profesor/calendario" label="Calendario" icon={Calendar} collapsed={collapsed} />
      </NavSection>
      <NavSection label="Evidencias" collapsed={collapsed}>
        <NavItem to="/profesor/subir" label="Nueva entrega" icon={Upload} collapsed={collapsed} />
        <NavItem to="/profesor/unidades" label="Mis unidades" icon={FileText} collapsed={collapsed} />
        <NavItem to="/profesor/entregas" label="Mis entregas" icon={ListChecks} collapsed={collapsed} />
      </NavSection>
    </>
  )
}

function DirectorNav({ collapsed }: { collapsed?: boolean }) {
  return (
    <NavSection label="Institución" collapsed={collapsed}>
      <NavItem to="/director" label="Panel general" icon={LayoutDashboard} collapsed={collapsed} />
      <NavItem to="/director/entregas" label="Entregas" icon={FileText} collapsed={collapsed} />
      <NavItem to="/director/contextos" label="Contextos" icon={Layers} collapsed={collapsed} />
      <NavItem to="/director/horarios" label="Horarios" icon={Calendar} collapsed={collapsed} />
      <NavItem to="/director/alertas" label="Alertas" icon={Bell} collapsed={collapsed} />
    </NavSection>
  )
}

function UgelNav({ collapsed }: { collapsed?: boolean }) {
  return (
    <>
      <NavSection label="UGEL 06" collapsed={collapsed}>
        <NavItem to="/ugel" label="Panel UGEL" icon={Globe} collapsed={collapsed} />
        <NavItem to="/ugel/mapa" label="Mapa diagnóstico" icon={Map} collapsed={collapsed} />
      </NavSection>
      <NavSection label="Comunidad educativa" collapsed={collapsed}>
        <NavItem to="/ugel/profesores" label="Profesores" icon={GraduationCap} collapsed={collapsed} />
        <NavItem to="/ugel/alumnos" label="Alumnos" icon={UserRound} collapsed={collapsed} />
      </NavSection>
      <NavSection label="Seguimiento" collapsed={collapsed}>
        <NavItem to="/ugel/evidencias" label="Unidades y sesiones" icon={FileText} collapsed={collapsed} />
        <NavItem to="/ugel/alertas" label="Alertas" icon={Bell} collapsed={collapsed} />
      </NavSection>
      <NavSection label="Administración" collapsed={collapsed}>
        <NavItem to="/ugel/usuarios" label="Usuarios" icon={Users} collapsed={collapsed} />
      </NavSection>
    </>
  )
}

export function Sidebar({ role, collapsed }: { role: Role; collapsed?: boolean }) {
  return (
    <nav className={cn('flex-1 overflow-y-auto pb-4', collapsed ? 'px-2' : 'px-2')}>
      {role === 'teacher' && <TeacherNav collapsed={collapsed} />}
      {role === 'director' && <DirectorNav collapsed={collapsed} />}
      {role === 'ugel' && <UgelNav collapsed={collapsed} />}
      {/* El glosario es transversal: los tres roles comparten el mismo diccionario. */}
      <NavSection label="Ayuda" collapsed={collapsed}>
        <NavItem to="/glosario" label="Glosario" icon={BookOpen} collapsed={collapsed} />
      </NavSection>
    </nav>
  )
}
