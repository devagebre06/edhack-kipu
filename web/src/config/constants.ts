// Reglas de negocio del piloto (4.to primaria · UGEL 06).
export const SUBJECTS_ALLOWED = ['Matemática', 'Comunicación']
export const GRADE_ALLOWED = '4to'

// Rutas de inicio por rol.
export const HOME: Record<string, string> = {
  teacher: '/profesor/calendario', director: '/director', ugel: '/ugel',
}

// Estados de artifact usados como filtros en las listas.
export const ARTIFACT_STATUS_FILTERS = [
  'APPROVED', 'NEEDS_REVISION', 'MANUAL_REVIEW', 'PROCESSING', 'PROCESSING_ERROR',
]

// Máquina de estados de alertas: siguiente estado al avanzar.
export const ALERT_NEXT_STATUS: Record<string, string> = {
  NEW: 'UNDER_REVIEW', UNDER_REVIEW: 'RESOLVED', ESCALATED: 'RESOLVED',
}
