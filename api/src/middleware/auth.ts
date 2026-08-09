// Autenticación: resuelve el usuario (identidad + rol + colegio) desde el Bearer token de Supabase.
import type express from 'express'
import { db } from '../infra/supabase.ts'

// Perfil normalizado que consumen controllers/services.
// `role` es la key del rol (ugel | director | profesor); `colegio_id` acota el alcance.
export interface AuthProfile {
  id: string
  role: string
  colegio_id: string | null
  nombre_completo: string
  deleted_at: string | null
}

export async function getUser(req: express.Request): Promise<AuthProfile | null> {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return null
  const { data } = await db.auth.getUser(token)
  if (!data.user) return null
  const { data: u } = await db.from('usuarios')
    .select('id, colegio_id, nombre_completo, deleted_at, roles(key)')
    .eq('id', data.user.id).single() as any
  if (!u) return null
  return {
    id: u.id,
    role: u.roles?.key ?? null,
    colegio_id: u.colegio_id,
    nombre_completo: u.nombre_completo,
    deleted_at: u.deleted_at,
  }
}
