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

/** Unidades de aprendizaje ya subidas (precondición para registrar sesiones). */
export function useTeacherUnits(teacherId: string) {
  return useQuery({
    queryKey: qk.units,
    queryFn: () => api.db.unitsByTeacher(teacherId),
  })
}

/** Dictados del docente (curso + aula + periodo), para elegir al subir una unidad. */
export function useTeacherDictados(teacherId: string) {
  return useQuery({
    queryKey: qk.dictados,
    queryFn: () => api.db.dictadosByTeacher(teacherId),
  })
}

/** URL firmada del PDF de una versión (temporal). `enabled` para no pedirla hasta abrir la card. */
export function useArtifactFile(versionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.artifactFile(versionId ?? 'none'),
    queryFn: () => api.files.artifactVersionUrl(versionId!),
    enabled: !!versionId && enabled,
    staleTime: 4 * 60 * 1000, // la URL firmada vive 5 min; refresca antes de expirar
  })
}

/** Sube una evidencia nueva o una versión corregida y refresca las listas. */
export function useSubmitArtifact() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.artifacts })
    qc.invalidateQueries({ queryKey: qk.artifactTypes })
    qc.invalidateQueries({ queryKey: qk.units })
  }
  return useMutation({
    mutationFn: (vars: { form: FormData; resubmitFor?: string | null }) =>
      vars.resubmitFor
        ? api.llm.reevaluateVersion(vars.resubmitFor, vars.form)
        : api.llm.evaluateArtifact(vars.form),
    onSuccess: invalidate,
  })
}

// ── Registro de notas ────────────────────────────────────────────────────────
/** Nómina + competencias + notas ya registradas de un dictado en un periodo. */
export function useRegistroNotas(dictadoId: string, periodoId?: string) {
  return useQuery({
    queryKey: qk.registroNotas(dictadoId, periodoId ?? ''),
    queryFn: () => api.notas.registro(dictadoId, periodoId),
    enabled: !!dictadoId,
  })
}

/** Guarda el registro completo; invalida lo que dependa de las notas. */
export function useGuardarNotas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { dictado_id: string; periodo_id: string; filas: { alumno_id: string; notas: Record<string, string> }[] }) =>
      api.notas.guardar(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registro-notas'] }),
  })
}

/** Competencias del docente: desempeño del grupo y su seguimiento. */
export function useCompetencias() {
  return useQuery({ queryKey: qk.competencias, queryFn: () => api.docente.competencias() })
}

/** Guarda el estado o el plan de una competencia. */
export function useGuardarCompetencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { dictado_id: string; competencia: string; estado?: string; nota?: string }) =>
      api.docente.guardarCompetencia(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.competencias }),
  })
}
