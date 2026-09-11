// Rutas del registro de notas del docente.
import { Router } from 'express'
import { getRegistroNotas, postRegistroNotas } from '../controllers/notas.controller.ts'

export const notasRouter = Router()

notasRouter.get('/registro', getRegistroNotas)
notasRouter.post('/registro', postRegistroNotas)
