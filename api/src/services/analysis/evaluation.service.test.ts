import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'
process.env.GEMINI_API_KEY = 'test-gemini-key'

const { evaluate } = await import('./evaluation.service.ts')

test('una entrega legible se extrae, califica y resume con una sola consulta', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })

  let calls = 0
  globalThis.fetch = (async (_url: string | URL | Request, options?: RequestInit) => {
    calls++
    const request = JSON.parse(String(options?.body))
    assert.match(request.contents[0].parts[0].text, /extraccion\.documentos_presentes/)
    assert.match(request.contents[0].parts[0].text, /contexto:/)
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      extraccion: { documentos_presentes: { insumos: false, planificacion_anual: false, unidad_didactica: true, sesion_aprendizaje: false, instrumentos_evaluacion: true }, identificacion: { ie: 'IE 1', docente: 'Docente', nivel: 'Primaria', area: 'Matemática', grado_seccion: '4.º A', competencia: 'Cantidad', unidad: 'Unidad 1', sesion: 'No consignado' }, observaciones: 'Texto claro.', legible: true },
      contexto: { area: 'Matemática', titulo: 'Unidad 1', resumen: 'Aprendizaje de números.', temas: ['Números'], grado: '4.º', periodo: 'Octubre' },
      confidence: 0.8, resumen: 'Planificación clara.', fortalezas: ['Propósito claro'], oportunidades: ['Mejorar criterios'],
      items: [3, 3, 3, 3, 2, 2, 1, 1].map((puntaje, index) => ({ numero: index + 1, puntaje, evidencia: 'Sección del documento', recomendacion: 'Precisar.' })),
      recomendaciones_priorizadas: ['Precisar criterios'],
    }) }] } }] }), { status: 200 })
  }) as typeof fetch

  const result = await evaluate('Documento de planificación legible.', { type: 'unidad de aprendizaje', subject: 'Matemática', grade: '4.º A' })
  assert.equal(calls, 1)
  assert.equal(result.overall_score, 75)
  assert.equal(result.decision, 'APPROVED')
  assert.equal(result.context?.area, 'Matemática')
  assert.equal(result.model, 'gemini-3.8-flash')
})

test('un documento ilegible no recibe nota y tampoco genera otra consulta', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })

  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      extraccion: { documentos_presentes: {}, identificacion: {}, observaciones: 'Texto ilegible.', legible: false },
      contexto: { area: 'No consignado', titulo: 'No consignado', resumen: '', temas: [], grado: 'No consignado', periodo: 'No consignado' },
      confidence: 0, resumen: '', fortalezas: [], oportunidades: [], items: [], recomendaciones_priorizadas: [],
    }) }] } }] }), { status: 200 })
  }) as typeof fetch

  const result = await evaluate('Texto con errores de extracción.', { type: 'sesión de aprendizaje', subject: 'Comunicación', grade: '4.º A' })
  assert.equal(calls, 1)
  assert.equal(result.decision, 'MANUAL_REVIEW')
  assert.equal(result.overall_score, 0)
})
