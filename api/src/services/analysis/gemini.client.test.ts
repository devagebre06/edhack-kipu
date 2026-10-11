import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'
process.env.GEMINI_API_KEY = 'test-gemini-key'
delete process.env.GEMINI_MODEL

const { gemini } = await import('./gemini.client.ts')

test('usa Gemini 3.7 Flash e ignora las partes de razonamiento', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = (async (url: string | URL | Request) => {
    assert.match(String(url), /models\/gemini-3\.7-flash:generateContent/)
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
