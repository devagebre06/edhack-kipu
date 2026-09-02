import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

/**
 * Suscribe la vista a los cambios en vivo de una tabla (Supabase Realtime,
 * Postgres Changes) e invalida las claves de react-query indicadas, de modo que
 * la lista se refresca sola cuando alguien crea o mueve un registro.
 *
 * La RLS se sigue aplicando: cada usuario recibe solo los cambios de las filas
 * que podría leer con un select. La tabla debe estar en la publicación
 * `supabase_realtime` (ver migración 014 para `alertas`).
 */
export function useRealtimeInvalidate(tabla: string, claves: readonly (readonly unknown[])[], activo = true) {
  const qc = useQueryClient()
  // Se serializa para que el efecto no se re-suscriba en cada render por una
  // referencia de array nueva.
  const firma = JSON.stringify(claves)

  useEffect(() => {
    if (!activo) return
    const canal = supabase
      .channel(`realtime:${tabla}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tabla }, () => {
        for (const clave of JSON.parse(firma) as unknown[][]) {
          qc.invalidateQueries({ queryKey: clave })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [tabla, firma, activo, qc])
}
