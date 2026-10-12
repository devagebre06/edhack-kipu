import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'
process.env.GEMINI_API_KEY = 'test-gemini-key'
delete process.env.GEMINI_MODEL
delete process.env.GEMINI_FALLBACK_MODEL

const { gemini, geminiWithModel } = await import('./gemini.client.ts')

test('usa Gemini 3.8 Flash e ignora las partes de razonamiento', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = (async (url: string | URL | Request) => {
    assert.match(String(url), /models\/gemini-3\.8-flash:generateContent/)
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [
        { thought: true, text: 'Análisis interno' },
        { text: '{"resultado":' },
        { text: '"correcto"}' },
      ] } }],
    }), { status: 200 })
  }) as typeof fetch

  assert.deepEqual(await gemini({ contents: [] }), { resultado: 'correcto' })
})

test('avisa cuando Gemini no devuelve una respuesta JSON', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = (async () => new Response(JSON.stringify({
    candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ thought: true, text: 'Análisis interno' }] } }],
  }), { status: 200 })) as typeof fetch

  await assert.rejects(gemini({ contents: [] }), /respuesta sin JSON \(finishReason: MAX_TOKENS\)/)
})

test('reintenta cuando Gemini responde 503 y conserva la respuesta final', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })

  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    if (calls === 1) return new Response(JSON.stringify({ error: { status: 'UNAVAILABLE' } }), { status: 503 })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"resultado":"correcto"}' }] } }] }), { status: 200 })
  }) as typeof fetch

  assert.deepEqual(await gemini({ contents: [] }), { resultado: 'correcto' })
  assert.equal(calls, 2)
})

test('usa el modelo de respaldo tras agotar los 503 y registra el modelo real', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })

  const models: string[] = []
  globalThis.fetch = (async (url: string | URL | Request) => {
    const model = String(url).match(/models\/([^:]+):generateContent/)?.[1] ?? ''
    models.push(model)
    if (model === 'gemini-3.8-flash') {
      return new Response(JSON.stringify({ error: { status: 'UNAVAILABLE' } }), { status: 503 })
    }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"resultado":"respaldo"}' }] } }] }), { status: 200 })
  }) as typeof fetch

  assert.deepEqual(await geminiWithModel({ contents: [] }), {
    data: { resultado: 'respaldo' }, model: 'gemini-3.6-flash',
  })
  assert.deepEqual(models, [
    'gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash',
    'gemini-3.6-flash',
  ])
})

test('no usa el respaldo si la clave es rechazada', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })

  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    return new Response(JSON.stringify({ error: { status: 'PERMISSION_DENIED' } }), { status: 403 })
  }) as typeof fetch

  await assert.rejects(geminiWithModel({ contents: [] }), /gemini 403 \(gemini-3\.8-flash\)/)
  assert.equal(calls, 1)
})

test('usa el respaldo si el modelo principal agota su cuota', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })

  const models: string[] = []
  globalThis.fetch = (async (url: string | URL | Request) => {
    const model = String(url).match(/models\/([^:]+):generateContent/)?.[1] ?? ''
    models.push(model)
    if (model === 'gemini-3.8-flash') return new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } }), { status: 429 })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"resultado":"respaldo"}' }] } }] }), { status: 200 })
  }) as typeof fetch

  assert.deepEqual(await geminiWithModel({ contents: [] }), {
    data: { resultado: 'respaldo' }, model: 'gemini-3.6-flash',
  })
  assert.deepEqual(models, ['gemini-3.8-flash', 'gemini-3.6-flash'])
})
