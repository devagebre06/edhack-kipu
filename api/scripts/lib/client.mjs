// Cliente Supabase compartido por los scripts de poblado.
// Lee credenciales desde el entorno (ejecuta con `node --env-file=.env scripts/<script>.mjs`).
// ws solo porque Node no trae WebSocket nativo estable para realtime (que aquí no se usa).
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const need = (k) => {
  const v = process.env[k]
  if (!v) {
    console.error(`\n✖ Falta la variable de entorno ${k}.\n  Ejecuta el script con: node --env-file=.env scripts/<script>.mjs\n`)
    process.exit(1)
  }
  return v
}

export const db = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), {
  realtime: { transport: ws },
})

// Password única para todas las cuentas demo.
export const DEMO_PASS = process.env.DEMO_PASSWORD || 'KipuDemo2026!'

// Busca (o crea si no existe) un usuario de Auth y devuelve su id.
export async function ensureAuthUser(email, password = DEMO_PASS) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
  const existing = list.users.find((u) => u.email === email)
  if (existing) return existing.id
  const { data: { user } } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  return user.id
}
