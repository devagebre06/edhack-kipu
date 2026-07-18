import { useQuery } from '@tanstack/react-query'
import { api } from '@/services'
import { qk } from './keys'

/** Panel general del directivo (docentes + resumen de entregas). */
export function useDirectorPanel(institutionId: string) {
  return useQuery({
    queryKey: qk.directorPanel,
    queryFn: async () => {
      const [teachers, artifacts] = await Promise.all([
        api.db.teachersByInstitution(institutionId),
        api.db.artifactsSummaryByInstitution(institutionId),
      ])
      return { teachers, artifacts }
    },
  })
}

/** Listado de entregas de la institución (para la tabla del directivo). */
export function useDirectorArtifacts(institutionId: string) {
  return useQuery({
    queryKey: qk.directorArtifacts,
    queryFn: () => api.db.artifactsByInstitution(institutionId),
  })
}

/** Data agregada del panel UGEL (instituciones, entregas, alertas, notas). */
export function useUgelData() {
  return useQuery({
    queryKey: qk.ugel,
    queryFn: async () => {
      const [institutions, artifacts, alerts, grades] = await Promise.all([
        api.db.institutions(),
        api.db.artifactsAll(),
        api.db.alertsAll(),
        api.db.grades(),
      ])
      return { institutions, artifacts, alerts, grades }
    },
  })
}
