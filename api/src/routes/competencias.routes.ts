// Rutas de competencias del docente.
import { Router } from 'express'
import { getCompetencias, putCompetencia } from '../controllers/competencias.controller.ts'

export const competenciasRouter = Router()

competenciasRouter.get('/', getCompetencias)
competenciasRouter.put('/', putCompetencia)
