// Cliente de bajo nivel para la API de Gemini: envía el payload y devuelve el JSON parseado.
import { GEMINI_KEY, GEMINI_MODEL } from '../../config/env.ts'

export async function gemini(payload: object) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
  )
  const body = await res.json() as any
  if (!res.ok) throw new Error(`gemini ${res.status}: ${JSON.stringify(body).slice(0, 300)}`)
  return JSON.parse(body.candidates[0].content.parts[0].text)
}
