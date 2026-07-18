// Bootstrap de la API kipu: configura Express y monta las rutas.
import express from 'express'
import cors from 'cors'
import { PORT } from './config/env.ts'
import { apiRouter } from './routes/index.ts'

const app = express()
app.use(cors())

app.use('/api', apiRouter)
app.get('/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => console.log('kipu api on', PORT))
