import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
export const API = import.meta.env.VITE_API_BASE_URL

export type Role = 'teacher' | 'director' | 'ugel'
export type Profile = { id: string; full_name: string; role: Role; institution_id: string | null }

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
export const SEVERITY_LABEL: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' }

export async function apiUpload(path: string, form: FormData) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` }, body: form })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || 'Error inesperado')
  return body
}
