import { supabase } from './supabase'

// Base del backend propio (motor de evaluación / IA).
export const API_BASE = import.meta.env.VITE_API_BASE_URL

// Cliente HTTP mínimo hacia el backend, con el token de Supabase adjunto.
// Toda llamada al backend pasa por aquí — un solo lugar para auth y errores.
async function request<T>(path: string, init: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${session?.access_token}`, ...init.headers },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Error inesperado')
  return body as T
}

/** POST multipart (subida de archivos). */
export function postForm<T>(path: string, form: FormData): Promise<T> {
  return request<T>(path, { method: 'POST', body: form })
}

/** POST / GET JSON genéricos, por si se necesitan más adelante. */
export function postJson<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}
export function getJson<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}
