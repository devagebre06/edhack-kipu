import { supabase } from './supabase'
import type { Profile, Role } from '@/types'

// Adapta la key de rol de la DB (profesor) al token de dominio del front (teacher).
function toRole(key: string | undefined): Role {
  return key === 'profesor' ? 'teacher' : (key as Role)
}

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
  // Lee el usuario (identidad + rol + colegio) del modelo unificado y lo adapta
  // a la forma Profile del front (role='teacher', institution_id=colegio_id).
  async profile(userId: string): Promise<{ data: Profile | null; error: unknown }> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, colegio_id, roles(key)')
      .eq('id', userId)
      .maybeSingle()
    const profile: Profile | null = data
      ? { id: (data as any).id, full_name: (data as any).nombre_completo, role: toRole((data as any).roles?.key), institution_id: (data as any).colegio_id }
      : null
    return { data: profile, error }
  },
  onAuthChange(cb: (userId?: string) => void) {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session?.user.id))
    return () => data.subscription.unsubscribe()
  },
}
