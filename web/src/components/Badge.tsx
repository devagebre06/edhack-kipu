import { Badge as UIBadge } from './ui/badge'

// Mapea cada valor de estado/severidad del dominio a una variante visual.
const VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info'> = {
  // Estados de entrega
  APPROVED: 'success', NEEDS_REVISION: 'warning', PROCESSING: 'secondary',
  MANUAL_REVIEW: 'info', PROCESSING_ERROR: 'destructive',
  // Estados de alerta
  NEW: 'destructive', UNDER_REVIEW: 'warning', DISMISSED: 'secondary',
  ESCALATED: 'info', RESOLVED: 'success',
  // Severidad
  LOW: 'secondary', MEDIUM: 'warning', HIGH: 'destructive', CRITICAL: 'destructive',
  // Roles de usuario
  ugel: 'info', director: 'default', teacher: 'secondary',
}

export function Badge({ value, label }: { value: string; label: string }) {
  return <UIBadge variant={VARIANT[value] ?? 'secondary'}>{label}</UIBadge>
}
