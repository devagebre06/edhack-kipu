// Cliente de bajo nivel para la API de Gemini: envía el payload y devuelve el JSON parseado.
import { GEMINI_KEY, GEMINI_MODEL } from '../../config/env.ts'

export async function gemini(payload: object) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
  )
  const body = await res.json() as any
  if (!res.ok) throw new Error(`gemini ${res.status}: ${JSON.stringify(body).slice(0, 300)}`)
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
  return JSON.parse(answer)
}
