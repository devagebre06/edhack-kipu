// Infraestructura: conexión a Supabase (Postgres + Storage + Auth) y auditoría.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../config/env.ts'

export const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: ws },
})

// Registra una acción en la bitácora de auditoría (no bloquea el flujo principal).
export const audit = (
  actor_id: string | null,
  action: string,
  entity_type?: string,
  entity_id?: string,
  metadata: object = {},
) => db.from('audit_logs').insert({ actor_id, action, entity_type, entity_id, metadata }).then(() => {})
