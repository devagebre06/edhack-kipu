import { useEffect, useState } from 'react'
import { auth } from '@/services'
import type { Profile } from '@/types'

type AuthState = {
  profile: Profile | null
  loading: boolean
  /** Hay sesión de Supabase pero no se pudo cargar un perfil (sin fila o token inválido). */
  sessionWithoutProfile: boolean
}

// Arranca la sesión y mantiene el perfil sincronizado con Supabase Auth.
export function useAuth(): AuthState {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionWithoutProfile, setSessionWithoutProfile] = useState(false)

  useEffect(() => {
    const load = async (userId?: string) => {
      if (!userId) {
        setProfile(null); setSessionWithoutProfile(false); setLoading(false)
        return
      }
      const { data } = await auth.profile(userId)
      setProfile(data)
      // Autenticado pero sin perfil accesible: cuenta sin fila en `profiles`
      // o sesión/token inválido que RLS rechaza. Se muestra pantalla de recuperación.
      setSessionWithoutProfile(!data)
      setLoading(false)
    }
    auth.currentUserId().then(load)
    return auth.onAuthChange(load)
  }, [])

  return { profile, loading, sessionWithoutProfile }
}
