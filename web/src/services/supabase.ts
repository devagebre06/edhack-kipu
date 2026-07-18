import { createClient } from '@supabase/supabase-js'

// Cliente Supabase compartido (auth + acceso a tablas).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
