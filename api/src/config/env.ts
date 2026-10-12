// Configuración central: lee variables de entorno y expone constantes del dominio.

const env = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`falta env ${k}`)
  return v
}

export const SUPABASE_URL = env('SUPABASE_URL')
export const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

export const GEMINI_KEY = env('GEMINI_API_KEY')
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.6-flash'

export const MAX_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 15)
// 18 de 24 puntos = 75/100. Es la misma regla para nota, estado y validez.
export const VALID_SCORE_MIN = 75
export const PORT = Number(process.env.PORT || 3001)

export const PROMPT_VERSION = 'v4'
export const RUBRIC_VERSION = 'planificacion-4primaria.v1'

// Tipos y extensiones de archivo aceptadas para las evidencias.
export const ALLOWED: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
