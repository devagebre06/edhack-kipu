// Controlador del resumen de profesores UGEL 06 (logro + contexto sociodemográfico).
import type express from 'express'
import { buildProfesores } from '../services/profesores.service.ts'

const COURSES = ['matematica', 'comunicacion']

// GET /api/v1/profesores?course=matematica|comunicacion&limit=4
// Devuelve profesores con su score/%, distribución de logro y card de contexto.
export async function getProfesores(req: express.Request, res: express.Response) {
  try {
    const course = typeof req.query.course === 'string' ? req.query.course : undefined
    if (course && !COURSES.includes(course)) {
      return res.status(400).json({ error: `course inválido. Use uno de: ${COURSES.join(', ')}` })
    }
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      return res.status(400).json({ error: 'limit debe ser un entero positivo.' })
    }
    res.json(await buildProfesores(course, limit))
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo construir el resumen de profesores.', detail: String(e.message || e) })
  }
}
