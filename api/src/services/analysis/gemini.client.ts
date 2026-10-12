// Cliente de bajo nivel para la API de Gemini: envía el payload y devuelve el JSON parseado.
import { GEMINI_FALLBACK_MODEL, GEMINI_KEY, GEMINI_MODEL } from '../../config/env.ts'

// Un 429 señala límite/cuota del modelo: probar el respaldo de inmediato evita
// repetir una solicitud que no se recuperará durante esta misma entrega.
const RETRYABLE_STATUS = new Set([408, 500, 502, 503, 504])
const RETRY_DELAYS_MS = [1000, 2000, 4000]

async function requestModel(payload: object, model: string) {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    )
    const body = await res.json()
    if (res.ok) return body
    if (!RETRYABLE_STATUS.has(res.status) || attempt === RETRY_DELAYS_MS.length) {
      throw new GeminiHttpError(res.status, model, body)
    }
    const delay = RETRY_DELAYS_MS[attempt] + Math.floor(Math.random() * 250)
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  throw new Error('Gemini: se agotaron los intentos')
}

class GeminiHttpError extends Error {
  constructor(public readonly status: number, model: string, body: unknown) {
    super(`gemini ${status} (${model}): ${JSON.stringify(body).slice(0, 300)}`)
  }
}

export async function geminiWithModel(payload: object) {
  let model = GEMINI_MODEL
  let body: any
  try {
    body = await requestModel(payload, model)
  } catch (error) {
    // Saturación (503) o cuota del modelo principal (429): probar el alterno.
    // Una clave inválida o un formato incorrecto deben quedar visibles.
    if (!(error instanceof GeminiHttpError && [429, 503].includes(error.status))
      || !GEMINI_FALLBACK_MODEL || GEMINI_FALLBACK_MODEL === GEMINI_MODEL) throw error
    model = GEMINI_FALLBACK_MODEL
    console.warn(`Gemini ${GEMINI_MODEL} no disponible (${(error as GeminiHttpError).status}); probando ${model}`)
    body = await requestModel(payload, model)
  }
  // Gemini 3 puede incluir partes de razonamiento antes de la respuesta final.
  // Solo la salida visible del modelo contiene el JSON solicitado.
  const parts = body.candidates?.[0]?.content?.parts as
    | { text?: string; thought?: boolean }[]
    | undefined
  const answer = parts
    ?.filter(part => !part.thought && typeof part.text === 'string')
    .map(part => part.text)
    .join('')
  if (!answer) {
    throw new Error(`gemini: respuesta sin JSON (finishReason: ${body.candidates?.[0]?.finishReason ?? 'desconocido'})`)
  }
  return { data: JSON.parse(answer), model }
}

export async function gemini(payload: object) {
  return (await geminiWithModel(payload)).data
}
