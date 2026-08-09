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
  accion: string,
  entidad_tipo?: string,
  entidad_id?: string,
  metadata: object = {},
) => db.from('logs_auditoria').insert({ actor_id, accion, entidad_tipo, entidad_id, metadata }).then(() => {})
