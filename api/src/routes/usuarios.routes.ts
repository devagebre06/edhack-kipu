// Rutas de gestión de usuarios de la plataforma (panel de UGEL).
import { Router } from 'express'
import express from 'express'
import {
  getUsuarios, postUsuario, patchUsuario, restoreUsuarioCtrl, deleteUsuario,
} from '../controllers/usuarios.controller.ts'

export const usuariosRouter = Router()

usuariosRouter.use(express.json())

usuariosRouter.get('/', getUsuarios)
usuariosRouter.post('/', postUsuario)
usuariosRouter.patch('/:id', patchUsuario)
usuariosRouter.post('/:id/restore', restoreUsuarioCtrl)
usuariosRouter.delete('/:id', deleteUsuario)
