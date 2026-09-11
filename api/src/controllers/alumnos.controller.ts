// Controlador de alumnos para el panel UGEL: listado con estadísticas y ficha.
import type express from 'express'
import { buildAlumnos, buildAlumnoDetalle, aulasDelDocente, puedeVerAlumno } from '../services/alumnos.service.ts'
import { getUser } from '../middleware/auth.ts'

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

// GET /api/v1/alumnos?search=&colegio=&aula=&limit=&offset=
// Listado agregado: UGEL ve todo; el director, su colegio; el docente, sus aulas.
export async function getAlumnos(req: express.Request, res: express.Response) {
  try {
    const profile = await getUser(req)
    if (!profile) return res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' })
    const limit = str(req.query.limit) ? Number(req.query.limit) : undefined
    const offset = str(req.query.offset) ? Number(req.query.offset) : undefined
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 500)) {
      return res.status(400).json({ error: 'limit debe ser un entero entre 1 y 500.' })
    }
    if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) {
      return res.status(400).json({ error: 'offset debe ser un entero >= 0.' })
    }
    // El alcance lo impone el rol, no el cliente.
    const alcance = profile.role === 'ugel'
      ? { colegio: str(req.query.colegio) }
      : profile.role === 'director'
        ? { colegio: profile.colegio_id ?? '—' }
        : { aulasPermitidas: await aulasDelDocente(profile.id) }
    res.json(await buildAlumnos({
      search: str(req.query.search), aula: str(req.query.aula), limit, offset, ...alcance,
    }))
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo construir el listado de alumnos.', detail: String(e.message || e) })
  }
}

// GET /api/v1/alumnos/mis — alumnos de las aulas donde el docente dicta.
export async function getMisAlumnos(req: express.Request, res: express.Response) {
  try {
    const profile = await getUser(req)
    if (!profile) return res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' })
    if (profile.role !== 'profesor') {
      return res.status(403).json({ error: 'Solo los docentes pueden ver a sus alumnos aquí.' })
    }
    const limit = str(req.query.limit) ? Number(req.query.limit) : undefined
    const offset = str(req.query.offset) ? Number(req.query.offset) : undefined
    const aulas = await aulasDelDocente(profile.id)
    res.json(await buildAlumnos({
      search: str(req.query.search), aula: str(req.query.aula), limit, offset, aulasPermitidas: aulas,
    }))
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo construir el listado de tus alumnos.', detail: String(e.message || e) })
  }
}

// GET /api/v1/alumnos/:id — la ficha exige sesión y respeta el alcance del rol.
export async function getAlumno(req: express.Request, res: express.Response) {
  try {
    const profile = await getUser(req)
    if (!profile) return res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' })
    if (!(await puedeVerAlumno(profile, req.params.id))) {
      return res.status(403).json({ error: 'No tienes acceso a la ficha de este estudiante.' })
    }
    const detalle = await buildAlumnoDetalle(req.params.id)
    if (!detalle) return res.status(404).json({ error: 'Alumno no encontrado.' })
    res.json(detalle)
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo construir la ficha del alumno.', detail: String(e.message || e) })
  }
}
