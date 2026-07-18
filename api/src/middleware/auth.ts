// Autenticación: resuelve el perfil del usuario a partir del Bearer token de Supabase.
import type express from 'express'
import { db } from '../infra/supabase.ts'

export async function getUser(req: express.Request) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return null
  const { data } = await db.auth.getUser(token)
  if (!data.user) return null
  const { data: profile } = await db.from('profiles').select('*').eq('id', data.user.id).single()
  return profile
}
