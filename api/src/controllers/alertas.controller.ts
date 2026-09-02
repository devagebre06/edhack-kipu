// Controlador del motor de alertas: listado, evaluación de reglas, alta manual
// (para probar el sistema), cambio de estado y limpieza.
import type express from 'express'
import { z } from 'zod'
import {
  buildAlertas, evaluarAlertas, crearAlerta, cambiarEstadoAlerta, limpiarAlertas, REGLAS,
} from '../services/alertas.service.ts'

const SEVERIDADES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
const ESTADOS = ['NEW', 'UNDER_REVIEW', 'DISMISSED', 'ESCALATED', 'RESOLVED'] as const
const CODIGOS = REGLAS.map((r) => r.codigo) as [string, ...string[]]

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

// GET /api/v1/alertas?estado=&severidad=&tipo=&colegio=
export async function getAlertas(req: express.Request, res: express.Response) {
  try {
    res.json(await buildAlertas({
      estado: str(req.query.estado), severidad: str(req.query.severidad),
      tipo: str(req.query.tipo), colegio: str(req.query.colegio),
    }))
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo listar las alertas.', detail: String(e.message || e) })
  }
}

// GET /api/v1/alertas/reglas — catálogo del motor (qué mira cada regla).
export function getReglas(_req: express.Request, res: express.Response) {
  res.json({ reglas: REGLAS })
}

const evaluarSchema = z.object({
  dry_run: z.boolean().optional(),
  reglas: z.array(z.enum(CODIGOS)).optional(),
  // Clave libre (no `z.enum`): en Zod 4 un record indexado por enum exige TODAS
  // las claves, y aquí los umbrales son un subconjunto opcional. Las claves que
  // no sean de una regla conocida simplemente no se usan.
  umbrales: z.record(z.string(), z.number()).optional(),
})

// POST /api/v1/alertas/evaluar — corre el motor. `dry_run` previsualiza sin escribir.
export async function postEvaluar(req: express.Request, res: express.Response) {
  const parsed = evaluarSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'Cuerpo inválido.', detail: parsed.error.issues })
  try {
    res.json(await evaluarAlertas({
      dryRun: parsed.data.dry_run,
      reglas: parsed.data.reglas as never,
      umbrales: parsed.data.umbrales as never,
    }))
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo evaluar las reglas.', detail: String(e.message || e) })
  }
}

const crearSchema = z.object({
  tipo: z.string().min(2).max(64),
  severidad: z.enum(SEVERIDADES),
  colegio_id: z.string().uuid().nullable().optional(),
  titulo: z.string().min(3).max(200),
  resumen: z.string().min(3).max(2000),
  accion_sugerida: z.string().min(3).max(2000),
  evidencia: z.record(z.string(), z.unknown()).optional(),
})

// POST /api/v1/alertas — alta manual, pensada para probar el flujo completo.
export async function postAlerta(req: express.Request, res: express.Response) {
  const parsed = crearSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'Cuerpo inválido.', detail: parsed.error.issues })
  try {
    res.status(201).json(await crearAlerta(parsed.data as never))
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo crear la alerta.', detail: String(e.message || e) })
  }
}

const estadoSchema = z.object({ estado: z.enum(ESTADOS), motivo: z.string().max(500).optional() })

// PATCH /api/v1/alertas/:id — cambia el estado y deja rastro en el historial.
export async function patchAlerta(req: express.Request, res: express.Response) {
  const parsed = estadoSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'Cuerpo inválido.', detail: parsed.error.issues })
  try {
    const out = await cambiarEstadoAlerta(req.params.id, parsed.data.estado, parsed.data.motivo)
    if (!out) return res.status(404).json({ error: 'Alerta no encontrada.' })
    res.json(out)
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo actualizar la alerta.', detail: String(e.message || e) })
  }
}

// DELETE /api/v1/alertas?origen=motor|manual|todas — limpieza tras las pruebas.
export async function deleteAlertas(req: express.Request, res: express.Response) {
  const origen = str(req.query.origen) ?? 'motor'
  if (!['motor', 'manual', 'todas'].includes(origen)) {
    return res.status(400).json({ error: 'origen debe ser motor, manual o todas.' })
  }
  try {
    res.json(await limpiarAlertas(origen as never))
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo limpiar las alertas.', detail: String(e.message || e) })
  }
}
