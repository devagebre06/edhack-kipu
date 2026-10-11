// ─────────────────────────────────────────────────────────────
// Etiquetas y estilos legibles (es-PE) para los enums de dominio.
// Centralizado: cambia un texto aquí y se refleja en toda la app.
// ─────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<string, string> = {
  PROCESSING: 'En procesamiento', APPROVED: 'Aprobada', NEEDS_REVISION: 'Necesita corrección',
  MANUAL_REVIEW: 'Revisión manual', PROCESSING_ERROR: 'Error de procesamiento',
}

export const TYPE_LABEL: Record<string, string> = {
  DAILY_SESSION: 'Sesión de clase', MONTHLY_UNIT: 'Unidad de aprendizaje',
  BIMONTHLY_GRADES: 'Registro de notas', ANNUAL_GRADE_SUMMARY: 'Balance anual',
}

export const ALERT_STATUS_LABEL: Record<string, string> = {
  NEW: 'Nueva', UNDER_REVIEW: 'En revisión', DISMISSED: 'Descartada', ESCALATED: 'Escalada', RESOLVED: 'Resuelta',
}

export const SEVERITY_LABEL: Record<string, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica',
}

// ── Ficha de monitoreo (evaluación IA) ──
export const DIMENSION_LABEL: Record<string, string> = {
  A: 'A · Insumos para la planificación curricular', B: 'B · Planificación anual',
  C: 'C · Unidad didáctica', D: 'D · Sesión de aprendizaje',
}
export const VAL_LABEL: Record<string, string> = {
  LOGRADO: 'Logrado', PROCESO: 'En proceso', INICIO: 'Inicio', NO_APLICA: 'No aplica', NO_EVIDENCIADO: 'No evidenciado',
  'Sin evidencia': 'Sin evidencia', 'En proceso': 'En proceso', Logrado: 'Logrado', Inicio: 'Inicio',
}
export const VAL_BADGE: Record<string, string> = {
  LOGRADO: 'APPROVED', PROCESO: 'PROCESSING', INICIO: 'NEEDS_REVISION', NO_APLICA: 'MANUAL_REVIEW', NO_EVIDENCIADO: 'NEEDS_REVISION',
  'Sin evidencia': 'NEEDS_REVISION', 'En proceso': 'PROCESSING', Logrado: 'APPROVED', Inicio: 'NEEDS_REVISION',
}
export const ID_LABEL: Record<string, string> = {
  ie: 'IE', docente: 'Docente', nivel: 'Nivel', area: 'Área', grado_seccion: 'Grado/Sección',
  competencia: 'Competencia', unidad: 'Unidad', sesion: 'Sesión',
}
export const DOC_LABEL: Record<string, string> = {
  insumos: 'Insumos de planificación', planificacion_anual: 'Planificación anual', unidad_didactica: 'Unidad didáctica',
  sesion_aprendizaje: 'Sesión de aprendizaje', instrumentos_evaluacion: 'Instrumentos de evaluación',
}

// ── Estilos de badge por valor de estado/severidad ──
export const BADGE_STYLE: Record<string, string> = {
  APPROVED: 'bg-ok-bg text-ok', NEEDS_REVISION: 'bg-warn-bg text-warn', PROCESSING: 'bg-line/50 text-ink-soft',
  MANUAL_REVIEW: 'bg-nav/10 text-nav', PROCESSING_ERROR: 'bg-bad-bg text-bad',
  NEW: 'bg-bad-bg text-bad', UNDER_REVIEW: 'bg-warn-bg text-warn', DISMISSED: 'bg-line/50 text-ink-soft',
  ESCALATED: 'bg-nav/10 text-nav', RESOLVED: 'bg-ok-bg text-ok',
  LOW: 'bg-line/50 text-ink-soft', MEDIUM: 'bg-warn-bg text-warn', HIGH: 'bg-bad-bg text-bad', CRITICAL: 'bg-bad text-white',
}

/** Nombre corto de un periodo, para ejes y cabeceras estrechas.
 *  "Evaluación Diagnóstica 2026" → "Diagnóstico" · "2026 · Bimestre 1" → "Bim. 1" */
export const periodoCorto = (nombre: string) =>
  /diagn/i.test(nombre)
    ? 'Diagnóstico'
    : nombre.replace(/^\d{4}\s*·\s*/, '').replace(/^Bimestre\s*/i, 'Bim. ')
