// Controlador del mapa diagnóstico UGEL 06.
import type express from 'express'
import { buildMapa } from '../services/mapa.service.ts'

const COURSES = ['matematica', 'comunicacion']

// GET /api/v1/mapa?course=matematica|comunicacion
// Devuelve el agregado por colegio y por distrito, listo para pintar el mapa.
export async function getMapa(req: express.Request, res: express.Response) {
  try {
    const course = typeof req.query.course === 'string' ? req.query.course : undefined
    if (course && !COURSES.includes(course)) {
      return res.status(400).json({ error: `course inválido. Use uno de: ${COURSES.join(', ')}` })
    }
    res.json(await buildMapa(course))
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo construir el mapa diagnóstico.', detail: String(e.message || e) })
  }
}
