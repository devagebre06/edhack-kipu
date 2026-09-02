import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services'
import { ALERT_NEXT_STATUS } from '@/config/constants'
import type { NuevaAlerta } from '@/types'
import { qk } from './keys'

/** Alertas de la institución del directivo. */
export function useInstitutionAlerts(institutionId: string) {
  return useQuery({
    queryKey: qk.directorAlerts,
    queryFn: () => api.db.alertsByInstitution(institutionId),
  })
}

/** Cambia el estado de una alerta e invalida la lista indicada. */
export function useUpdateAlertStatus(invalidateKey: readonly unknown[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; status: string }) =>
      api.db.updateAlertStatus(vars.id, vars.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: invalidateKey }),
  })
}

/** Estado siguiente en la máquina de estados de alertas. */
export const nextAlertStatus = (current: string) => ALERT_NEXT_STATUS[current]

// ── Motor de alertas (panel UGEL) ────────────────────────────────────────────
/** Listado de alertas con estadísticas y catálogo de reglas. */
export function useAlertas(filtros: { estado?: string; severidad?: string; tipo?: string } = {}) {
  const { estado = '', severidad = '', tipo = '' } = filtros
  return useQuery({
    queryKey: qk.alertas(estado, severidad, tipo),
    queryFn: () => api.alertas.list({ estado: estado || undefined, severidad: severidad || undefined, tipo: tipo || undefined }),
    placeholderData: (prev) => prev,
  })
}

/** Corre el motor de reglas. `dry_run` previsualiza sin escribir. */
export function useEvaluarAlertas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { dry_run?: boolean; reglas?: string[]; umbrales?: Record<string, number> }) =>
      api.alertas.evaluar(payload),
    onSuccess: (_res, vars) => { if (!vars.dry_run) qc.invalidateQueries({ queryKey: ['alertas'] }) },
  })
}

/** Alta manual de una alerta (probar el sistema). */
export function useCrearAlerta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NuevaAlerta) => api.alertas.crear(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas'] }),
  })
}

/** Cambia el estado de una alerta vía API (deja rastro en su historial). */
export function useCambiarEstadoAlerta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; estado: string; motivo?: string }) =>
      api.alertas.cambiarEstado(v.id, v.estado, v.motivo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas'] }),
  })
}

/** Borra las alertas generadas (limpieza tras las pruebas). */
export function useLimpiarAlertas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (origen: 'motor' | 'manual' | 'todas') => api.alertas.limpiar(origen),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas'] }),
  })
}
