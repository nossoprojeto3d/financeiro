import { describe, it, expect } from 'vitest'
import { novoPendente, juntarComFila, novaEtiqueta } from './fila.js'

describe('novoPendente', () => {
  it('ganha etiqueta única, número negativo (não confunde com os do banco) e marca de pendente', () => {
    const a = novoPendente({ tipo: 'entrada', valor: 10, data: '2026-10-14' })
    const b = novoPendente({ tipo: 'entrada', valor: 10, data: '2026-10-14' })
    expect(a.pendente).toBe(true)
    expect(a.id).toBeLessThan(0)
    expect(a.id).not.toBe(b.id)
    expect(a.id_cliente).toMatch(/^[0-9a-f-]{36}$/)
    expect(a.id_cliente).not.toBe(b.id_cliente)
    expect(a.valor).toBe(10)
  })
})

describe('novaEtiqueta', () => {
  it('formato de uuid v4, sempre diferente', () => {
    const v = new Set(Array.from({ length: 200 }, novaEtiqueta))
    expect(v.size).toBe(200)
    for (const e of v) expect(e).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('juntarComFila', () => {
  const servidor = [{ id: 1, id_cliente: 'a' }, { id: 2, id_cliente: null }]
  it('os do banco mais os que ainda esperam internet', () => {
    const fila = [{ id: -5, id_cliente: 'x', pendente: true }]
    expect(juntarComFila(servidor, fila).map(l => l.id)).toEqual([1, 2, -5])
  })
  it('se o pendente já chegou ao banco (resposta perdida), não aparece duas vezes', () => {
    const fila = [{ id: -5, id_cliente: 'a', pendente: true }, { id: -6, id_cliente: 'y', pendente: true }]
    expect(juntarComFila(servidor, fila).map(l => l.id)).toEqual([1, 2, -6])
  })
  it('fila vazia não muda nada', () => {
    expect(juntarComFila(servidor, [])).toEqual(servidor)
  })
})
