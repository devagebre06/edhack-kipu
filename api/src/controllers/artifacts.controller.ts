// Controladores HTTP de evidencias: flujo dictado → unidad → sesión.
// El profesor sube una UNIDAD (cuelga de un dictado suyo) o una SESIÓN (cuelga de
// una unidad suya). En ambos casos se crea una evidencia polimórfica + versión 1.
import type express from 'express'
import { db, audit } from '../infra/supabase.ts'
import { getUser } from '../middleware/auth.ts'
import { processUpload, validateFile } from '../services/artifact.service.ts'

const TIPOS = ['UNIDAD', 'SESION']

function respondProcessingError(res: express.Response, error: any) {
  const detail = String(error?.message || error)
  const overloaded = /^gemini 503(?:\s|:)/.test(detail)
  const quotaExceeded = /^gemini 429(?:\s|:)/.test(detail)
  res.status(overloaded ? 503 : quotaExceeded ? 429 : 500).json({
    error: overloaded
      ? 'Gemini está temporalmente ocupado. Reintenta esta entrega en unos minutos.'
      : quotaExceeded
        ? 'Los modelos de Gemini alcanzaron su cuota disponible. Reintenta más tarde.'
        : 'No se pudo procesar el documento. Intenta nuevamente.',
    detail,
  })
}

// Deriva curso/grado (para el análisis) de un dictado con sus joins.
function subjectGrade(dictado: any) {
  return { subject: dictado?.cursos?.nombre ?? '', grade: dictado?.aulas?.grado ?? dictado?.aulas?.seccion ?? '' }
}

// POST /api/v1/artifacts — crea una evidencia nueva (unidad o sesión) y la evalúa.
export async function createArtifact(req: express.Request, res: express.Response) {
  try {
    const profile = await getUser(req)
    if (!profile || profile.role !== 'profesor') return res.status(403).json({ error: 'Solo profesores pueden subir evidencias' })
    const fileErr = validateFile(req.file)
    if (fileErr) return res.status(400).json({ error: fileErr })
    const { tipo, dictado_id, unidad_id, nombre } = req.body
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo de evidencia inválido (UNIDAD | SESION)' })
    if (!String(nombre || '').trim()) return res.status(400).json({ error: 'La evidencia necesita un nombre' })

    if (tipo === 'UNIDAD') {
      if (!dictado_id) return res.status(400).json({ error: 'Selecciona el dictado (curso/aula) de la unidad' })
      const { data: dictado } = await db.from('dictados')
        .select('id, profesor_id, cursos(nombre), aulas(grado, seccion)').eq('id', dictado_id).single() as any
      if (!dictado || dictado.profesor_id !== profile.id) return res.status(400).json({ error: 'El dictado seleccionado no es válido' })

      const { data: [unidad], error: uErr } = await db.from('unidades').insert({ dictado_id, nombre: String(nombre).trim() }).select() as any
      if (uErr) throw uErr
      const { data: [evidencia] } = await db.from('evidencias').insert({ unidad_id: unidad.id, profesor_id: profile.id }).select() as any
      await audit(profile.id, 'EVIDENCIA_SUBIDA', 'unidad', unidad.id, { filename: req.file!.originalname })
      return res.json(await processUpload(profile, req.file!, evidencia, { kind: 'UNIDAD', ...subjectGrade(dictado) }, 1))
    }

    // SESION: cuelga de una unidad del propio docente.
    if (!unidad_id) return res.status(400).json({ error: 'Selecciona la unidad de aprendizaje de la sesión' })
    const { data: unidad } = await db.from('unidades')
      .select('id, dictado_id, dictados(id, profesor_id, cursos(nombre), aulas(grado, seccion))').eq('id', unidad_id).single() as any
    if (!unidad || unidad.dictados?.profesor_id !== profile.id) return res.status(400).json({ error: 'La unidad seleccionada no es válida' })

    const { data: [sesion], error: sErr } = await db.from('sesiones').insert({ unidad_id, nombre: String(nombre).trim() }).select() as any
    if (sErr) throw sErr
    const { data: [evidencia] } = await db.from('evidencias').insert({ sesion_id: sesion.id, profesor_id: profile.id }).select() as any
    await audit(profile.id, 'EVIDENCIA_SUBIDA', 'sesion', sesion.id, { filename: req.file!.originalname })
    return res.json(await processUpload(profile, req.file!, evidencia, { kind: 'SESION', parentUnitId: unidad_id, ...subjectGrade(unidad.dictados) }, 1))
  } catch (e: any) {
    console.error(e)
    respondProcessingError(res, e)
  }
}

// GET /api/v1/artifacts/versions/:versionId/file — URL firmada del PDF de una versión.
export async function getArtifactFile(req: express.Request, res: express.Response) {
  try {
    const profile = await getUser(req)
    if (!profile) return res.status(401).json({ error: 'No autenticado' })
    const { data: ver } = await db.from('evidencia_versiones')
      .select('id, storage_path, nombre_archivo, evidencias(profesor_id)')
      .eq('id', req.params.versionId).single() as any
    if (!ver) return res.status(404).json({ error: 'Versión no encontrada' })
    const profesorId = ver.evidencias?.profesor_id
    const { data: prof } = await db.from('usuarios').select('colegio_id').eq('id', profesorId).single()
    const allowed = profile.role === 'ugel'
      || (profile.role === 'director' && prof?.colegio_id === profile.colegio_id)
      || (profile.role === 'profesor' && profesorId === profile.id)
    if (!allowed) return res.status(403).json({ error: 'No tienes acceso a esta evidencia' })

    if (!ver.storage_path || ver.storage_path.startsWith('seed/')) {
      return res.json({ url: null, filename: ver.nombre_archivo, note: 'Evidencia de demostración sin archivo adjunto.' })
    }
    const { data, error } = await db.storage.from('evidence').createSignedUrl(ver.storage_path, 300)
    if (error) throw error
    res.json({ url: data.signedUrl, filename: ver.nombre_archivo })
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo obtener el archivo.', detail: String(e.message || e) })
  }
}

// POST /api/v1/artifacts/:id/versions — nueva versión (corrección) de una evidencia existente.
export async function createArtifactVersion(req: express.Request, res: express.Response) {
  try {
    const profile = await getUser(req)
    if (!profile || profile.role !== 'profesor') return res.status(403).json({ error: 'Solo profesores' })
    const fileErr = validateFile(req.file)
    if (fileErr) return res.status(400).json({ error: fileErr })
    const { data: evidencia } = await db.from('evidencias').select('*').eq('id', req.params.id).eq('profesor_id', profile.id).single() as any
    if (!evidencia) return res.status(404).json({ error: 'Evidencia no encontrada' })
    if (evidencia.estado === 'APPROVED') return res.status(403).json({ error: 'Una evidencia aprobada no admite nuevas versiones' })

    // Deriva kind + curso/grado + unidad padre desde la unidad o sesión de la evidencia.
    let kind: 'UNIDAD' | 'SESION'; let dictado: any; let parentUnitId: string | null = null
    if (evidencia.unidad_id) {
      kind = 'UNIDAD'
      const { data: u } = await db.from('unidades').select('dictados(cursos(nombre), aulas(grado, seccion))').eq('id', evidencia.unidad_id).single() as any
      dictado = u?.dictados
    } else {
      kind = 'SESION'
      const { data: s } = await db.from('sesiones').select('unidad_id, unidades(dictados(cursos(nombre), aulas(grado, seccion)))').eq('id', evidencia.sesion_id).single() as any
      dictado = s?.unidades?.dictados
      parentUnitId = s?.unidad_id ?? null
    }

    const { data: curVer } = await db.from('evidencia_versiones').select('id').eq('evidencia_id', evidencia.id).eq('version', evidencia.version_actual).single()
    const { data: prevEval } = await db.from('evaluaciones').select('resumen, mejoras, puntaje_total').eq('version_id', curVer?.id).single()
    await audit(profile.id, 'EVIDENCIA_RESUBIDA', 'evidencia', evidencia.id, { new_version: evidencia.version_actual + 1 })
    res.json(await processUpload(profile, req.file!, evidencia, { kind, parentUnitId, ...subjectGrade(dictado) }, evidencia.version_actual + 1, prevEval ? JSON.stringify(prevEval) : undefined))
  } catch (e: any) {
    console.error(e)
    respondProcessingError(res, e)
  }
}
