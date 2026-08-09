import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services'
import type { NewHorario } from '@/types'
import { qk } from './keys'
// Nota: en el modelo unificado los profesores ya están ligados a su colegio; se
// eliminó el enlace docente↔profesor UGEL (useLinkProfesor).

/** Panel de gestión de horarios del directivo (docentes + horarios + catálogos). */
export function useHorarios() {
  return useQuery({ queryKey: qk.horarios, queryFn: () => api.horarios.panel() })
}

/** Crea un horario y refresca el panel. */
export function useCreateHorario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NewHorario) => api.horarios.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.horarios }),
  })
}

/** Elimina un horario y refresca el panel. */
export function useDeleteHorario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.horarios.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.horarios }),
  })
}
