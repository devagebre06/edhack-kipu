// Controlador de alumnos para el panel UGEL: listado con estadísticas y ficha.
import type express from 'express'
import { buildAlumnos, buildAlumnoDetalle } from '../services/alumnos.service.ts'

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

// GET /api/v1/alumnos?search=&colegio=&aula=&limit=&offset=
export async function getAlumnos(req: express.Request, res: express.Response) {
  try {
    const limit = str(req.query.limit) ? Number(req.query.limit) : undefined
    const offset = str(req.query.offset) ? Number(req.query.offset) : undefined
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 500)) {
      return res.status(400).json({ error: 'limit debe ser un entero entre 1 y 500.' })
    }
    if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) {
      return res.status(400).json({ error: 'offset debe ser un entero >= 0.' })
    }
    res.json(await buildAlumnos({
      search: str(req.query.search), colegio: str(req.query.colegio), aula: str(req.query.aula), limit, offset,
    }))
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo construir el listado de alumnos.', detail: String(e.message || e) })
  }
}

// GET /api/v1/alumnos/:id
export async function getAlumno(req: express.Request, res: express.Response) {
  try {
    const detalle = await buildAlumnoDetalle(req.params.id)
    if (!detalle) return res.status(404).json({ error: 'Alumno no encontrado.' })
    res.json(detalle)
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo construir la ficha del alumno.', detail: String(e.message || e) })
  }
}
