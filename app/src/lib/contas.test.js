import { describe, it, expect } from 'vitest'
import { situacao, ordenarContas, resumoContas } from './contas.js'

describe('situacao (o que aparece em cada conta)', () => {
  const h = '2026-10-23'
  it('atrasada', () => {
    expect(situacao('2026-10-22', h)).toEqual({ texto: 'atrasada desde ontem', atrasada: true, urgente: true })
    expect(situacao('2026-10-20', h)).toEqual({ texto: 'atrasada há 3 dias', atrasada: true, urgente: true })
  })
  it('hoje, amanhã e nos próximos dias', () => {
    expect(situacao('2026-10-23', h)).toEqual({ texto: 'vence hoje', atrasada: false, urgente: true })
    expect(situacao('2026-10-24', h)).toEqual({ texto: 'vence amanhã', atrasada: false, urgente: true })
    expect(situacao('2026-10-26', h)).toEqual({ texto: 'vence em 3 dias', atrasada: false, urgente: true })
    expect(situacao('2026-10-27', h)).toEqual({ texto: 'vence em 4 dias', atrasada: false, urgente: false })
    expect(situacao('2026-10-30', h)).toEqual({ texto: 'vence em 7 dias', atrasada: false, urgente: false })
  })
  it('mais longe: mostra o dia', () => {
    expect(situacao('2026-11-10', h)).toEqual({ texto: 'vence 10/11', atrasada: false, urgente: false })
  })
  it('virando o mês e o ano', () => {
    expect(situacao('2026-12-31', '2027-01-02').texto).toBe('atrasada há 2 dias')
    expect(situacao('2027-01-01', '2026-12-31').texto).toBe('vence amanhã')
  })
})

describe('ordenarContas', () => {
  it('vence antes primeiro, empate pelo id', () => {
    const l = [{ id: 3, vencimento: '2026-10-25' }, { id: 1, vencimento: '2026-10-30' }, { id: 2, vencimento: '2026-10-25' }]
    expect(ordenarContas(l).map(c => c.id)).toEqual([2, 3, 1])
  })
})

describe('resumoContas', () => {
  it('total em centavos, atrasadas e as que vencem nos próximos 7 dias', () => {
    const l = [
      { valor: 0.1, vencimento: '2026-10-20' }, { valor: 0.2, vencimento: '2026-10-23' },
      { valor: 100, vencimento: '2026-10-30' }, { valor: 50, vencimento: '2026-11-15' },
    ]
    expect(resumoContas(l, '2026-10-23')).toEqual({ total: 150.3, atrasadas: 1, semana: 2, urgentes: 1 }) // urgente = vence em até 3 dias (sem contar as atrasadas)
  })
  it('lista vazia', () => {
    expect(resumoContas([], '2026-10-23')).toEqual({ total: 0, atrasadas: 0, semana: 0, urgentes: 0 })
  })
})
