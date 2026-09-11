// Montaje central de rutas de la API.
import { Router } from 'express'
import { artifactsRouter } from './artifacts.routes.ts'
import { mapaRouter } from './mapa.routes.ts'
import { profesoresRouter } from './profesores.routes.ts'
import { alumnosRouter } from './alumnos.routes.ts'
import { alertasRouter } from './alertas.routes.ts'
import { notasRouter } from './notas.routes.ts'
import { competenciasRouter } from './competencias.routes.ts'
import { evaluacionRouter } from './evaluacion.routes.ts'
import { horariosRouter } from './horarios.routes.ts'
import { usuariosRouter } from './usuarios.routes.ts'

export const apiRouter = Router()

apiRouter.use('/v1/artifacts', artifactsRouter)
apiRouter.use('/v1/mapa', mapaRouter)
apiRouter.use('/v1/profesores', profesoresRouter)
apiRouter.use('/v1/alumnos', alumnosRouter)
apiRouter.use('/v1/alertas', alertasRouter)
apiRouter.use('/v1/notas', notasRouter)
apiRouter.use('/v1/competencias', competenciasRouter)
apiRouter.use('/v1/evaluacion', evaluacionRouter)
apiRouter.use('/v1/horarios', horariosRouter)
apiRouter.use('/v1/usuarios', usuariosRouter)
