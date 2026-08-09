// Rutas del resumen de profesores UGEL 06 (lectura agregada).
import { Router } from 'express'
import { getProfesores } from '../controllers/profesores.controller.ts'

export const profesoresRouter = Router()

profesoresRouter.get('/', getProfesores)
