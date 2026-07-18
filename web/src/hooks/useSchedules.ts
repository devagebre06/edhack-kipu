import { useQuery } from '@tanstack/react-query'
import { api } from '@/services'
import { SUBJECTS_ALLOWED, GRADE_ALLOWED } from '@/config/constants'
import { qk } from './keys'

/** Horarios del docente. */
export function useSchedules(teacherId: string) {
  return useQuery({
    queryKey: qk.schedules,
    queryFn: () => api.db.schedulesByTeacher(teacherId),
  })
}

/** Horarios filtrados al alcance del piloto (Mat/Com · 4to). */
export function useAllowedSchedules(teacherId: string) {
  const query = useSchedules(teacherId)
  const allowed = (query.data ?? []).filter(s =>
    SUBJECTS_ALLOWED.includes(s.subjects?.name ?? '') &&
    (s.student_groups?.grade ?? '').includes(GRADE_ALLOWED))
  return { ...query, allowed }
}
