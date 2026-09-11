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

/** Unidades y sesiones de la institución con su contexto de contenido (para el director). */
export function useDirectorContexts(institutionId: string) {
  return useQuery({
    queryKey: qk.directorContexts,
    queryFn: () => api.db.artifactsWithContextByInstitution(institutionId),
  })
}

/** Mapa diagnóstico UGEL 06 agregado por colegio/distrito. `course` = 'all' | 'matematica' | 'comunicacion'. */
export function useMapa(course: string) {
  return useQuery({
    queryKey: qk.mapa(course),
    queryFn: () => api.map.mapa(course === 'all' ? undefined : course),
  })
}

/** Profesores UGEL 06 con score/%, distribución de logro y contexto sociodemográfico. */
export function useProfesores(course: string, limit?: number) {
  return useQuery({
    queryKey: qk.profesores(course, limit ?? 0),
    queryFn: () => api.map.profesores(course === 'all' ? undefined : course, limit),
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

/** Ficha de un docente: aulas, evolución de notas, competencias, unidades y scoring. */
export function useProfesor(dni: string) {
  return useQuery({
    queryKey: qk.profesor(dni),
    queryFn: () => api.map.profesor(dni),
    enabled: !!dni,
  })
}

/** Listado de alumnos con estadísticas agregadas (búsqueda y paginación en el backend). */
export function useAlumnos(opts: { search?: string; colegio?: string; aula?: string; limit?: number; offset?: number } = {}) {
  const { search = '', colegio = '', aula = '', limit = 50, offset = 0 } = opts
  return useQuery({
    queryKey: qk.alumnos(search, colegio, aula, limit, offset),
    queryFn: () => api.map.alumnos({ search: search || undefined, colegio: colegio || undefined, aula: aula || undefined, limit, offset }),
    placeholderData: (prev) => prev,   // evita el parpadeo al teclear en el buscador
  })
}

/** Ficha de un alumno: serie de notas en el tiempo y desglose por competencia. */
export function useAlumno(id: string) {
  return useQuery({
    queryKey: qk.alumno(id),
    queryFn: () => api.map.alumno(id),
    enabled: !!id,
  })
}

/** Alumnos del docente (solo los de las aulas donde dicta). */
export function useMisAlumnos(opts: { search?: string; aula?: string; limit?: number; offset?: number } = {}) {
  const { search = '', aula = '', limit = 25, offset = 0 } = opts
  return useQuery({
    queryKey: qk.misAlumnos(search, aula, limit, offset),
    queryFn: () => api.docente.misAlumnos({ search: search || undefined, aula: aula || undefined, limit, offset }),
    placeholderData: (prev) => prev,
  })
}

/** Configuración del motor de evaluación (rúbrica, prompts y flujo). */
export function useConfigEvaluacion() {
  return useQuery({ queryKey: qk.evaluacion, queryFn: () => api.evaluacion.config(), staleTime: 5 * 60_000 })
}
