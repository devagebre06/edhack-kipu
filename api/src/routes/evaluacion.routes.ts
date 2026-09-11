// Ruta de «Cómo se evalúa».
import { Router } from 'express'
import { getEvaluacion } from '../controllers/evaluacion.controller.ts'

export const evaluacionRouter = Router()

evaluacionRouter.get('/', getEvaluacion)
