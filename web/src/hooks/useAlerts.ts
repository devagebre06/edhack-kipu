import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services'
import { ALERT_NEXT_STATUS } from '@/config/constants'
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
