// Rutas del mapa diagnóstico UGEL 06 (lectura agregada).
import { Router } from 'express'
import { getMapa } from '../controllers/mapa.controller.ts'

export const mapaRouter = Router()

mapaRouter.get('/', getMapa)
