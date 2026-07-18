import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HOME } from '@/config/constants'
import { useAuth, ProfileProvider } from '@/hooks'
import { Shell } from '@/components'
import type { Role } from '@/types'

import Login from '@/pages/Login'
import TeacherCalendar from '@/pages/teacher/TeacherCalendar'
import TeacherUpload from '@/pages/teacher/TeacherUpload'
import TeacherArtifacts from '@/pages/teacher/TeacherArtifacts'
import DirectorPanel from '@/pages/director/DirectorPanel'
import DirectorArtifacts from '@/pages/director/DirectorArtifacts'
import DirectorAlerts from '@/pages/director/DirectorAlerts'
import Ugel from '@/pages/ugel/Ugel'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

/** Renderiza `element` solo si el rol coincide; si no, redirige al home del rol. */
function guard(role: Role, allowed: Role, element: React.ReactNode) {
  return role === allowed ? element : <Navigate to={HOME[role]} />
}

export default function App() {
  const { profile, loading } = useAuth()

  if (loading) return <div className="grid min-h-screen place-items-center text-ink-soft">Cargando…</div>
  if (!profile) return <Login />

  const { role } = profile
  return (
    <QueryClientProvider client={qc}>
      <ProfileProvider value={profile}>
        <BrowserRouter>
          <Shell profile={profile}>
            <Routes>
              {/* Profesor */}
              <Route path="/profesor/calendario" element={guard(role, 'teacher', <TeacherCalendar />)} />
              <Route path="/profesor/subir" element={guard(role, 'teacher', <TeacherUpload />)} />
              <Route path="/profesor/entregas" element={guard(role, 'teacher', <TeacherArtifacts />)} />
              {/* Director */}
              <Route path="/director" element={guard(role, 'director', <DirectorPanel />)} />
              <Route path="/director/entregas" element={guard(role, 'director', <DirectorArtifacts />)} />
              <Route path="/director/alertas" element={guard(role, 'director', <DirectorAlerts />)} />
              {/* UGEL */}
              <Route path="/ugel" element={guard(role, 'ugel', <Ugel />)} />
              <Route path="*" element={<Navigate to={HOME[role]} />} />
            </Routes>
          </Shell>
        </BrowserRouter>
      </ProfileProvider>
    </QueryClientProvider>
  )
}
