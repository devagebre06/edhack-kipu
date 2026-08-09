// Rutas de gestión de horarios de clase (panel del directivo).
import { Router } from 'express'
import express from 'express'
import { getHorarios, postHorario, removeHorario } from '../controllers/horarios.controller.ts'

export const horariosRouter = Router()

horariosRouter.use(express.json())

horariosRouter.get('/', getHorarios)
horariosRouter.post('/', postHorario)
horariosRouter.delete('/:id', removeHorario)
