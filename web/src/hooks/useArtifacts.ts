import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services'
import { qk } from './keys'

/** Entregas del docente (con versiones y evaluaciones completas). */
export function useTeacherArtifacts(teacherId: string) {
  return useQuery({
    queryKey: qk.artifacts,
    queryFn: () => api.db.artifactsByTeacher(teacherId),
  })
}

/** Entregas ligeras para el calendario. */
export function useArtifactTypes(teacherId: string) {
  return useQuery({
    queryKey: qk.artifactTypes,
    queryFn: () => api.db.artifactTypesByTeacher(teacherId),
  })
}

/** Sube una evidencia nueva o una versión corregida y refresca las listas. */
export function useSubmitArtifact() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.artifacts })
    qc.invalidateQueries({ queryKey: qk.artifactTypes })
  }
  return useMutation({
    mutationFn: (vars: { form: FormData; resubmitFor?: string | null }) =>
      vars.resubmitFor
        ? api.llm.reevaluateVersion(vars.resubmitFor, vars.form)
        : api.llm.evaluateArtifact(vars.form),
    onSuccess: invalidate,
  })
}
