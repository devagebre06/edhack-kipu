// Rutas del motor de alertas (panel UGEL).
import { Router } from 'express'
import {
  getAlertas, getReglas, postEvaluar, postAlerta, patchAlerta, deleteAlertas,
} from '../controllers/alertas.controller.ts'

export const alertasRouter = Router()

alertasRouter.get('/', getAlertas)
alertasRouter.get('/reglas', getReglas)
alertasRouter.post('/evaluar', postEvaluar)
alertasRouter.post('/', postAlerta)
alertasRouter.patch('/:id', patchAlerta)
alertasRouter.delete('/', deleteAlertas)
