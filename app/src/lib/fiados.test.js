import { describe, it, expect } from 'vitest'
import { pessoas, nomesUsados, haQuanto, categoriaPadraoFiado, ordenarFiados, falta, totalFalta, pagamentosDoFiado } from './fiados.js'

describe('pessoas', () => {
  it('conta nomes diferentes ignorando maiúsculas, acentos e espaços', () => {
    expect(pessoas([{ nome: 'Ana' }, { nome: ' ana ' }, { nome: 'Ána' }, { nome: 'João' }])).toBe(2)
  })
  it('lista vazia dá zero', () => {
    expect(pessoas([])).toBe(0)
  })
})

describe('nomesUsados', () => {
  it('um de cada, com a primeira grafia, em ordem alfabética', () => {
    expect(nomesUsados([{ nome: 'joão' }, { nome: 'Ana' }, { nome: 'João' }, { nome: ' Ana ' }])).toEqual(['Ana', 'joão'])
  })
})

describe('haQuanto', () => {
  it('mesmo dia', () => expect(haQuanto('2026-10-14', '2026-10-14')).toBe('hoje'))
  it('ontem virando o mês', () => expect(haQuanto('2026-09-30', '2026-10-01')).toBe('ontem'))
  it('dias virando o ano', () => expect(haQuanto('2025-12-25', '2026-01-04')).toBe('há 10 dias'))
  it('data no futuro (fuso) conta como hoje', () => expect(haQuanto('2026-10-15', '2026-10-14')).toBe('hoje'))
})

describe('categoriaPadraoFiado', () => {
  it('primeira de venda na ordem da lista', () => {
    expect(categoriaPadraoFiado([{ id: 1, natureza: 'outra' }, { id: 2, natureza: 'venda' }, { id: 3, natureza: 'venda' }]).id).toBe(2)
  })
  it('sem venda, a primeira', () => {
    expect(categoriaPadraoFiado([{ id: 7, natureza: 'aporte' }]).id).toBe(7)
  })
  it('sem categorias, null', () => {
    expect(categoriaPadraoFiado([])).toBe(null)
  })
})

describe('ordenarFiados', () => {
  it('entrega mais antiga primeiro e empate pelo id', () => {
    const lista = [{ id: 3, data: '2026-10-10' }, { id: 1, data: '2026-10-12' }, { id: 2, data: '2026-10-10' }]
    expect(ordenarFiados(lista).map(f => f.id)).toEqual([2, 3, 1])
  })
})

describe('falta e totalFalta (pagamento parcial)', () => {
  it('falta = valor menos o que já foi pago, em centavos', () => {
    expect(falta({ valor: 600, pago: 300 })).toBe(300)
    expect(falta({ valor: 0.3, pago: 0.1 })).toBe(0.2)
  })
  it('sem a coluna pago (banco antigo), falta o valor todo', () => {
    expect(falta({ valor: 80 })).toBe(80)
  })
  it('total a receber soma só o que falta', () => {
    expect(totalFalta([{ valor: 600, pago: 300 }, { valor: 80 }, { valor: 0.1, pago: 0 }])).toBe(380.1)
  })
})

describe('pagamentosDoFiado (histórico)', () => {
  it('vendas desse fiado, da mais antiga para a mais nova', () => {
    const lancs = [
      { id: 9, fiado_id: 7, data: '2026-10-10', valor: 50 },
      { id: 3, fiado_id: 7, data: '2026-10-02', valor: 70 },
      { id: 4, fiado_id: 8, data: '2026-10-01', valor: 10 },
      { id: 5, data: '2026-10-01', valor: 99 },
    ]
    expect(pagamentosDoFiado(lancs, 7).map(l => l.id)).toEqual([3, 9])
  })
  it('sem a coluna fiado_id (banco antigo), lista vazia', () => {
    expect(pagamentosDoFiado([{ id: 1, data: '2026-10-01', valor: 5 }], 7)).toEqual([])
  })
})
