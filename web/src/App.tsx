import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HOME } from '@/config/constants'
import { useAuth, ProfileProvider, ThemeProvider, useTheme } from '@/hooks'
import { Shell } from '@/components'
import { Toaster } from '@/components/ui'
import type { Role } from '@/types'

import Login from '@/pages/Login'
import SessionError from '@/pages/SessionError'
import TeacherCalendar from '@/pages/teacher/TeacherCalendar'
import TeacherUpload from '@/pages/teacher/TeacherUpload'
import TeacherArtifacts from '@/pages/teacher/TeacherArtifacts'
import TeacherUnits from '@/pages/teacher/TeacherUnits'
import DirectorPanel from '@/pages/director/DirectorPanel'
import DirectorArtifacts from '@/pages/director/DirectorArtifacts'
import DirectorAlerts from '@/pages/director/DirectorAlerts'
import DirectorHorarios from '@/pages/director/DirectorHorarios'
import DirectorContexts from '@/pages/director/DirectorContexts'
import Ugel from '@/pages/ugel/Ugel'
import MapaDiagnostico from '@/pages/ugel/MapaDiagnostico'
import UgelUsuarios from '@/pages/ugel/UgelUsuarios'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

/** Renderiza `element` solo si el rol coincide; si no, redirige al home del rol. */
function guard(role: Role, allowed: Role, element: React.ReactNode) {
  return role === allowed ? element : <Navigate to={HOME[role]} />
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}

function AppInner() {
  const { profile, loading, sessionWithoutProfile } = useAuth()
  const { theme } = useTheme()

  if (loading) return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Cargando…</div>
  if (sessionWithoutProfile) return <SessionError />
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
              <Route path="/profesor/unidades" element={guard(role, 'teacher', <TeacherUnits />)} />
              {/* Director */}
              <Route path="/director" element={guard(role, 'director', <DirectorPanel />)} />
              <Route path="/director/entregas" element={guard(role, 'director', <DirectorArtifacts />)} />
              <Route path="/director/alertas" element={guard(role, 'director', <DirectorAlerts />)} />
              <Route path="/director/horarios" element={guard(role, 'director', <DirectorHorarios />)} />
              <Route path="/director/contextos" element={guard(role, 'director', <DirectorContexts />)} />
              {/* UGEL */}
              <Route path="/ugel" element={guard(role, 'ugel', <Ugel />)} />
              <Route path="/ugel/mapa" element={guard(role, 'ugel', <MapaDiagnostico />)} />
              <Route path="/ugel/usuarios" element={guard(role, 'ugel', <UgelUsuarios />)} />
              <Route path="*" element={<Navigate to={HOME[role]} />} />
            </Routes>
          </Shell>
        </BrowserRouter>
        <Toaster theme={theme} />
      </ProfileProvider>
    </QueryClientProvider>
  )
}
