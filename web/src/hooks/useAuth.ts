import { useEffect, useState } from 'react'
import { auth } from '@/services'
import type { Profile } from '@/types'

// Arranca la sesión y mantiene el perfil sincronizado con Supabase Auth.
export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async (userId?: string) => {
      if (!userId) { setProfile(null); setLoading(false); return }
      setProfile(await auth.profile(userId))
      setLoading(false)
    }
    auth.currentUserId().then(load)
    return auth.onAuthChange(load)
  }, [])

  return { profile, loading }
}
