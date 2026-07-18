// Fixtures de evidencias para desarrollo/offline. NO usar en producción.
// Tipados contra el dominio: si cambia `Artifact`, TypeScript avisa aquí.
import type { Artifact } from '@/types'

export const DUMMY_ARTIFACTS: Artifact[] = [
  {
    id: 'art-1',
    type: 'DAILY_SESSION',
    status: 'APPROVED',
    current_version: 1,
    created_at: '2026-07-10T14:00:00Z',
    teacher_id: 'teacher-1',
    institution_id: 'inst-1',
    profiles: { full_name: 'Ana Torres' },
    subjects: { name: 'Matemática' },
    artifact_versions: [{
      id: 'v-1', version: 1, status: 'APPROVED',
      created_at: '2026-07-10T14:00:00Z', original_filename: 'sesion-fracciones.pdf',
      evaluations: [{
        overall_score: 88, decision: 'APPROVED',
        summary: 'Sesión bien estructurada con propósito claro y evaluación coherente.',
        strengths: ['Propósito de aprendizaje explícito', 'Actividades graduadas'],
        improvements: ['Incluir instrumento de evaluación formativa'],
        criteria: [],
      }],
    }],
  },
  {
    id: 'art-2',
    type: 'MONTHLY_UNIT',
    status: 'NEEDS_REVISION',
    current_version: 2,
    created_at: '2026-07-05T09:30:00Z',
    teacher_id: 'teacher-1',
    institution_id: 'inst-1',
    profiles: { full_name: 'Ana Torres' },
    subjects: { name: 'Comunicación' },
    artifact_versions: [{
      id: 'v-2', version: 1, status: 'NEEDS_REVISION',
      created_at: '2026-07-05T09:30:00Z', original_filename: 'unidad-julio.pdf',
      evaluations: [{
        overall_score: 62, decision: 'NEEDS_REVISION',
        summary: 'La unidad carece de conexión entre competencias y actividades.',
        strengths: ['Situación significativa pertinente'],
        improvements: ['Alinear desempeños con criterios de evaluación', 'Definir producto final'],
        criteria: [],
      }],
    }],
  },
]
