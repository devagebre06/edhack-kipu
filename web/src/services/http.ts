import { supabase } from './supabase'

// Base del backend propio (motor de evaluación / IA).
export const API_BASE = import.meta.env.VITE_API_BASE_URL

/** Error de transporte que conserva el código HTTP, para poder reaccionar a él. */
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

// Cliente HTTP mínimo hacia el backend, con el token de Supabase adjunto.
// Toda llamada al backend pasa por aquí — un solo lugar para auth y errores.
//
// Si el backend responde 401 el token caducó (o la sesión fue revocada, p. ej.
// al reejecutar los scripts de usuarios demo). En ese caso se refresca la sesión
// UNA vez y se reintenta: es el caso normal tras dejar la pestaña abierta un
// rato, y no debe obligar al docente a volver a entrar. Si el refresco tampoco
// vale, se cierra la sesión para que aparezca el login en vez de una pantalla
// cargando para siempre.
async function request<T>(path: string, init: RequestInit, reintento = false): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${session?.access_token}`, ...init.headers },
  })

  if (res.status === 401 && !reintento) {
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session) return request<T>(path, init, true)
    await supabase.auth.signOut()
    location.assign(import.meta.env.BASE_URL)
    throw new HttpError(401, 'Tu sesión expiró. Vuelve a iniciar sesión.')
  }

  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new HttpError(res.status, body.error || 'Error inesperado')
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
export function putJson<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}
export function patchJson<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}
export function getJson<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}
export function delJson<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}
