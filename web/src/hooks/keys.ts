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
  horarios: ['horarios'] as const,
  usuarios: ['usuarios'] as const,
}
