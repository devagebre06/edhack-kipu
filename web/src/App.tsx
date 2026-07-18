import { useEffect, useState, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase, type Profile } from './lib'
import { Logo } from './ui'
import Login from './pages/Login'
import TeacherCalendar from './pages/TeacherCalendar'
import TeacherUpload from './pages/TeacherUpload'
import TeacherArtifacts from './pages/TeacherArtifacts'
import DirectorPanel from './pages/DirectorPanel'
import DirectorArtifacts from './pages/DirectorArtifacts'
import DirectorAlerts from './pages/DirectorAlerts'
import Ugel from './pages/Ugel'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })
const ProfileCtx = createContext<Profile | null>(null)
export const useProfile = () => useContext(ProfileCtx)!

const HOME: Record<string, string> = { teacher: '/profesor/calendario', director: '/director', ugel: '/ugel' }

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

const ICONS = {
  calendar: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="2.5" width="13" height="12" rx="1.5"/><path d="M5 1v3M11 1v3M1.5 6.5h13"/></svg>,
  upload: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 10V3m-3 3 3-3 3 3"/><path d="M3 13h10"/></svg>,
  list: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h8M4 8h8M4 12h5"/></svg>,
  chart: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="9" width="3" height="5"/><rect x="6.5" y="5" width="3" height="9"/><rect x="11" y="2" width="3" height="12"/></svg>,
  bell: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1.5A4.5 4.5 0 0 0 3.5 6v3L2 11h12l-1.5-2V6A4.5 4.5 0 0 0 8 1.5Z"/><path d="M6.5 11v.5a1.5 1.5 0 0 0 3 0V11"/></svg>,
  globe: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 1.5c-2 2-3 4-3 6.5s1 4.5 3 6.5m0-13c2 2 3 4 3 6.5s-1 4.5-3 6.5M1.5 8h13"/></svg>,
  doc: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 1.5H4A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h8A1.5 1.5 0 0 0 13.5 13V5.5l-4-4Z"/><path d="M9.5 1.5V5.5h4M5.5 9h5M5.5 11.5h3"/></svg>,
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
    <>
      <NavSection label="Institución">
        <NavItem to="/director" label="Panel general" icon={ICONS.chart} />
        <NavItem to="/director/entregas" label="Entregas" icon={ICONS.doc} />
        <NavItem to="/director/alertas" label="Alertas" icon={ICONS.bell} />
      </NavSection>
    </>
  )
}

function UgelNav() {
  return (
    <>
      <NavSection label="UGEL 06">
        <NavItem to="/ugel" label="Panel UGEL" icon={ICONS.globe} />
      </NavSection>
    </>
  )
}

function Shell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col bg-nav text-white">
        <div className="px-5 py-5">
          <Logo light />
          <p className="mt-1 text-[10px] text-white/40 uppercase tracking-wider">
            {profile.role === 'teacher' ? 'Docente' : profile.role === 'director' ? 'Directivo' : 'UGEL 06'}
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {profile.role === 'teacher' && <TeacherNav />}
          {profile.role === 'director' && <DirectorNav />}
          {profile.role === 'ugel' && <UgelNav />}
        </nav>
        <div className="shrink-0 border-t border-white/10 px-4 py-4 text-sm">
          <div className="font-medium leading-tight">{profile.full_name}</div>
          <button onClick={() => supabase.auth.signOut().finally(() => location.assign('/'))}
            className="mt-1 text-xs text-white/50 hover:text-white/90 transition-colors">Cerrar sesión</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto bg-bg px-8 py-6">{children}</main>
    </div>
  )
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async (userId?: string) => {
      if (!userId) { setProfile(null); setLoading(false); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(data); setLoading(false)
    }
    supabase.auth.getSession().then(({ data }) => load(data.session?.user.id))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => load(s?.user.id))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="grid min-h-screen place-items-center text-ink-soft">Cargando…</div>
  if (!profile) return <Login />

  return (
    <QueryClientProvider client={qc}>
      <ProfileCtx.Provider value={profile}>
        <BrowserRouter>
          <Shell profile={profile}>
            <Routes>
              {/* Profesor */}
              <Route path="/profesor/calendario" element={profile.role === 'teacher' ? <TeacherCalendar /> : <Navigate to={HOME[profile.role]} />} />
              <Route path="/profesor/subir" element={profile.role === 'teacher' ? <TeacherUpload /> : <Navigate to={HOME[profile.role]} />} />
              <Route path="/profesor/entregas" element={profile.role === 'teacher' ? <TeacherArtifacts /> : <Navigate to={HOME[profile.role]} />} />
              {/* Director */}
              <Route path="/director" element={profile.role === 'director' ? <DirectorPanel /> : <Navigate to={HOME[profile.role]} />} />
              <Route path="/director/entregas" element={profile.role === 'director' ? <DirectorArtifacts /> : <Navigate to={HOME[profile.role]} />} />
              <Route path="/director/alertas" element={profile.role === 'director' ? <DirectorAlerts /> : <Navigate to={HOME[profile.role]} />} />
              {/* UGEL */}
              <Route path="/ugel" element={profile.role === 'ugel' ? <Ugel /> : <Navigate to={HOME[profile.role]} />} />
              <Route path="*" element={<Navigate to={HOME[profile.role]} />} />
            </Routes>
          </Shell>
        </BrowserRouter>
      </ProfileCtx.Provider>
    </QueryClientProvider>
  )
}
