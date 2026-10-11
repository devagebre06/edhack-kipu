import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularNota, EvaluacionSchema } from './rubric.ts'

test('18 de 24 puntos alcanza exactamente el resultado satisfactorio', () => {
  assert.deepEqual(calcularNota([3, 3, 3, 3, 2, 2, 1, 1].map(puntaje => ({ puntaje }))), {
    puntos: 18, nota: 75, satisfactoria: true,
  })
  assert.deepEqual(calcularNota([3, 3, 3, 2, 2, 2, 1, 1].map(puntaje => ({ puntaje }))), {
    puntos: 17, nota: 71, satisfactoria: false,
  })
})

test('un criterio sin evidencia cuenta como cero y no sale del denominador', () => {
  assert.deepEqual(calcularNota([0, 3, 3, 3, 3, 3, 3, 3].map(puntaje => ({ puntaje }))), {
    puntos: 21, nota: 88, satisfactoria: true,
  })
})

test('la respuesta del modelo debe incluir cada uno de los ocho criterios una vez', () => {
  const base = {
    confidence: 0.5, resumen: 'Resumen', fortalezas: [], oportunidades: [], recomendaciones_priorizadas: [],
    items: Array.from({ length: 8 }, (_, i) => ({ numero: i + 1, puntaje: 2, evidencia: 'Sección', recomendacion: '' })),
  }
  assert.equal(EvaluacionSchema.safeParse(base).success, true)
  assert.equal(EvaluacionSchema.safeParse({ ...base, items: base.items.map(item => ({ ...item, numero: 1 })) }).success, false)
  assert.equal(EvaluacionSchema.safeParse({ ...base, items: base.items.map(item => ({ ...item, puntaje: 4 })) }).success, false)
})
