// Configuración central: lee variables de entorno y expone constantes del dominio.

const env = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`falta env ${k}`)
  return v
}

export const SUPABASE_URL = env('SUPABASE_URL')
export const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

export const GEMINI_KEY = env('GEMINI_API_KEY')
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

// Zona horaria del piloto. Fija el cálculo de día/hora al huso de Perú para que
// no dependa de la hora local del proceso (la API puede correr en UTC).
export const TIMEZONE = process.env.TIMEZONE || 'America/Lima'

export const WINDOW_BEFORE_MIN = Number(process.env.SESSION_UPLOAD_WINDOW_BEFORE_MINUTES || 30)
export const MAX_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 15)
// Puntaje mínimo (0-100) para que una evidencia cuente como válida. Por debajo
// de este umbral el documento igual se sube, pero no se cuenta como sesión/unidad válida.
export const VALID_SCORE_MIN = Number(process.env.VALID_SCORE_MIN || 60)
export const PORT = Number(process.env.PORT || 3001)

export const PROMPT_VERSION = 'v2'
export const RUBRIC_VERSION = 'ficha-monitoreo-ugel06.v1'

// Tipos y extensiones de archivo aceptadas para las evidencias.
export const ALLOWED: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
