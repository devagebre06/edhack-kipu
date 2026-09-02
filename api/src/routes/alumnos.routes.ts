// Rutas de alumnos (lectura agregada para el panel UGEL).
import { Router } from 'express'
import { getAlumnos, getAlumno } from '../controllers/alumnos.controller.ts'

export const alumnosRouter = Router()

alumnosRouter.get('/', getAlumnos)
alumnosRouter.get('/:id', getAlumno)
