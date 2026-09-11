// Claves de cache de react-query, centralizadas para invalidar sin typos.
export const qk = {
  schedules: ['schedules'] as const,
  dictados: ['dictados'] as const,
  artifacts: ['artifacts'] as const,
  artifactTypes: ['artifacts-types'] as const,
  units: ['artifacts-units'] as const,
  artifactFile: (versionId: string) => ['artifact-file', versionId] as const,
  directorPanel: ['director-panel'] as const,
  directorArtifacts: ['director-artifacts'] as const,
  directorContexts: ['director-contexts'] as const,
  directorAlerts: ['director-alerts'] as const,
  ugel: ['ugel'] as const,
  mapa: (course: string) => ['mapa', course] as const,
  profesores: (course: string, limit: number) => ['profesores', course, limit] as const,
  profesor: (dni: string) => ['profesor', dni] as const,
  alumnos: (search: string, colegio: string, aula: string, limit: number, offset: number) =>
    ['alumnos', search, colegio, aula, limit, offset] as const,
  alumno: (id: string) => ['alumno', id] as const,
  misAlumnos: (search: string, aula: string, limit: number, offset: number) =>
    ['mis-alumnos', search, aula, limit, offset] as const,
  alertas: (estado: string, severidad: string, tipo: string) => ['alertas', estado, severidad, tipo] as const,
  competencias: ['competencias'] as const,
  evaluacion: ['evaluacion-config'] as const,
  registroNotas: (dictado: string, periodo: string) => ['registro-notas', dictado, periodo] as const,
  horarios: ['horarios'] as const,
  usuarios: ['usuarios'] as const,
}
