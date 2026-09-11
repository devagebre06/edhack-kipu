import { useParams } from 'react-router-dom'
import { AlumnoFicha } from '@/components'

export default function TeacherAlumnoDetalle() {
  const { id = '' } = useParams()
  return <AlumnoFicha id={id} volverA="/profesor/alumnos" volverLabel="Mis estudiantes" />
}
