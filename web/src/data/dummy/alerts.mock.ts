// Fixtures de alertas para desarrollo/offline. NO usar en producción.
import type { Alert } from '@/types'

export const DUMMY_ALERTS: Alert[] = [
  {
    id: 'alert-1',
    institution_id: 'inst-1',
    type: 'LOW_COMPLIANCE',
    severity: 'HIGH',
    status: 'NEW',
    title: 'Baja tasa de entregas en 4.º B',
    summary: 'El grupo 4.º B tiene 40% de evidencias pendientes en el bimestre.',
    suggested_action: 'Coordinar con el docente responsable un plan de recuperación.',
    created_at: '2026-07-12T08:00:00Z',
    institutions: { name: 'I.E. José María Arguedas' },
  },
  {
    id: 'alert-2',
    institution_id: 'inst-1',
    type: 'GRADE_DROP',
    severity: 'MEDIUM',
    status: 'UNDER_REVIEW',
    title: 'Caída de promedio en Matemática',
    summary: 'El promedio bajó de 14.2 a 11.8 respecto al bimestre anterior.',
    suggested_action: 'Revisar estrategias de reforzamiento con el equipo docente.',
    created_at: '2026-07-08T11:00:00Z',
    institutions: { name: 'I.E. José María Arguedas' },
  },
]
