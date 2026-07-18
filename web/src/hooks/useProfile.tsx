import { createContext, useContext } from 'react'
import type { Profile } from '@/types'

// Perfil del usuario en sesión, disponible en todo el árbol autenticado.
const ProfileCtx = createContext<Profile | null>(null)

export function ProfileProvider({ value, children }: { value: Profile; children: React.ReactNode }) {
  return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>
}

export const useProfile = () => useContext(ProfileCtx)!
