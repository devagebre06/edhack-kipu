// Bootstrap de la API kipu: configura Express y monta las rutas.
import express from 'express'
import cors from 'cors'
import { PORT } from './config/env.ts'
import { apiRouter } from './routes/index.ts'

const app = express()
app.use(cors())
// Cuerpos JSON (el motor de alertas y el alta manual los usan). Las subidas de
// evidencias son multipart y las sigue manejando multer, sin interferencia.
app.use(express.json({ limit: '1mb' }))

app.use('/api', apiRouter)
app.get('/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => console.log('kipu api on', PORT))
