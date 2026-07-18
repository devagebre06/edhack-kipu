import { supabase } from './supabase'
import type { Profile } from '@/types'

// Autenticación y perfil del usuario en sesión.
export const auth = {
  signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password })
  },
  signOut() {
    return supabase.auth.signOut()
  },
  async currentUserId() {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id
  },
  async profile(userId: string): Promise<Profile | null> {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    return data
  },
  onAuthChange(cb: (userId?: string) => void) {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session?.user.id))
    return () => data.subscription.unsubscribe()
  },
}
