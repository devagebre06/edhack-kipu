import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services'
import type { NewUsuario } from '@/types'
import { qk } from './keys'

/** Panel de gestión de usuarios de UGEL (instituciones + usuarios registrados). */
export function useUsuarios() {
  return useQuery({ queryKey: qk.usuarios, queryFn: () => api.usuarios.panel() })
}

/** Crea un usuario (UGEL, director o profesor) y refresca el panel. */
export function useCreateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NewUsuario) => api.usuarios.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.usuarios }),
  })
}

/** Actualiza contraseña y/o correo de un usuario y refresca el panel. */
export function useUpdateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; password?: string; email?: string }) => api.usuarios.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.usuarios }),
  })
}

/** Da de baja (lógica o definitiva) o reactiva un usuario, y refresca el panel. */
export function useUsuarioLifecycle() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.usuarios })
  return {
    softDelete: useMutation({ mutationFn: (id: string) => api.usuarios.softDelete(id), onSuccess: invalidate }),
    hardDelete: useMutation({ mutationFn: (id: string) => api.usuarios.hardDelete(id), onSuccess: invalidate }),
    restore: useMutation({ mutationFn: (id: string) => api.usuarios.restore(id), onSuccess: invalidate }),
  }
}
