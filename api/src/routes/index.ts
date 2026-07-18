// Montaje central de rutas de la API.
import { Router } from 'express'
import { artifactsRouter } from './artifacts.routes.ts'

export const apiRouter = Router()

apiRouter.use('/v1/artifacts', artifactsRouter)
