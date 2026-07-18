// Rutas de evidencias (artifacts) con carga de archivos en memoria vía multer.
import { Router } from 'express'
import multer from 'multer'
import { MAX_MB } from '../config/env.ts'
import { createArtifact, createArtifactVersion } from '../controllers/artifacts.controller.ts'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_MB * 1024 * 1024 } })

export const artifactsRouter = Router()

artifactsRouter.post('/', upload.single('file'), createArtifact)
artifactsRouter.post('/:id/versions', upload.single('file'), createArtifactVersion)
