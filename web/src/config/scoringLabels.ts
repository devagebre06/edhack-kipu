// Nombres visibles del puntaje diagnóstico del profesor. Las claves de la API
// siguen siendo logro/equidad/cobertura para mantener el contrato existente.
export const PROFESOR_SCORE_LABELS = {
  logro: 'Promedio diagnóstico del grupo',
  equidad: 'Estudiantes por encima de C',
  cobertura: 'Tamaño relativo del grupo evaluado',
} as const
