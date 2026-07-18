import { useEffect, useState, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase, type Profile } from './lib'
import { Logo } from './ui'
import Login from './pages/Login'
import Teacher from './pages/Teacher'
import Director from './pages/Director'
import Ugel from './pages/Ugel'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })
const ProfileCtx = createContext<Profile | null>(null)
export const useProfile = () => useContext(ProfileCtx)!

const HOME: Record<string, string> = { teacher: '/profesor', director: '/director', ugel: '/ugel' }

function Shell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col bg-nav text-white">
        <div className="px-5 py-5"><Logo light /></div>
        <nav className="flex-1 px-3">
          <NavLink to={HOME[profile.role]} className={({ isActive }) => `block rounded-md px-3 py-2 text-sm ${isActive ? 'bg-nav-soft font-medium' : 'text-white/75 hover:bg-nav-soft/60'}`}>
            {profile.role === 'teacher' ? 'Mis entregas' : profile.role === 'director' ? 'Mi institución' : 'Panel UGEL'}
          </NavLink>
        </nav>
        <div className="border-t border-white/15 px-5 py-4 text-sm">
          <div className="font-medium">{profile.full_name}</div>
          <button onClick={() => supabase.auth.signOut().finally(() => location.assign('/'))} className="mt-1 text-white/70 hover:text-white">Cerrar sesión</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-6">{children}</main>
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
              <Route path="/profesor" element={profile.role === 'teacher' ? <Teacher /> : <Navigate to={HOME[profile.role]} />} />
              <Route path="/director" element={profile.role === 'director' ? <Director /> : <Navigate to={HOME[profile.role]} />} />
              <Route path="/ugel" element={profile.role === 'ugel' ? <Ugel /> : <Navigate to={HOME[profile.role]} />} />
              <Route path="*" element={<Navigate to={HOME[profile.role]} />} />
            </Routes>
          </Shell>
        </BrowserRouter>
      </ProfileCtx.Provider>
    </QueryClientProvider>
  )
}
