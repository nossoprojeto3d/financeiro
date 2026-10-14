import { describe, it, expect } from 'vitest'
import { pessoas, nomesUsados, haQuanto, categoriaPadraoFiado, ordenarFiados } from './fiados.js'

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
