// Rutas de alumnos (lectura agregada para el panel UGEL).
import { Router } from 'express'
import { getAlumnos, getAlumno, getMisAlumnos } from '../controllers/alumnos.controller.ts'

export const alumnosRouter = Router()

alumnosRouter.get('/', getAlumnos)
// `mis` va antes que `:id` para que no lo capture como identificador.
alumnosRouter.get('/mis', getMisAlumnos)
alumnosRouter.get('/:id', getAlumno)
