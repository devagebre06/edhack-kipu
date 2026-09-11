import { useParams } from 'react-router-dom'
import { AlumnoFicha } from '@/components'

export default function UgelAlumnoDetalle() {
  const { id = '' } = useParams()
  return <AlumnoFicha id={id} volverA="/ugel/alumnos" />
}
