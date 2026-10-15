// Contas da Gestão: lucro, meta mínima, comparação com o período anterior, caixa e dicas.
// A data de "hoje" é fixa (14/10/2026) para os períodos não mudarem com o calendário.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { intervalo, intervaloAnterior, porNatureza, saldoCaixa, metaMinima, analise, porMes } from './analise.js'

const CATS = {
  1: { id: 1, nome: 'Vendas Shopee', natureza: 'venda' },
  2: { id: 2, nome: 'Vendas diretas / WhatsApp', natureza: 'venda' },
  3: { id: 3, nome: 'Filamento', natureza: 'variavel' },
  4: { id: 4, nome: 'Software', natureza: 'fixa' },
  5: { id: 5, nome: 'Impressora', natureza: 'investimento' },
  6: { id: 6, nome: 'Taxas Shopee', natureza: 'variavel' },
  7: { id: 7, nome: 'Aporte', natureza: 'aporte' },
}
const cat = id => CATS[id]
let seq = 0
const L = (data, categoria_id, valor) => ({
  id: ++seq, data, categoria_id, valor,
  tipo: ['venda', 'aporte', 'outra'].includes(CATS[categoria_id].natureza) ? 'entrada' : 'saida',
})

// outubro (mês atual até dia 14), setembro (até dia 14, para comparar), agosto e julho
const LANCS = [
  L('2026-10-05', 1, 300), L('2026-10-10', 2, 200),
  L('2026-10-03', 3, 100), L('2026-10-02', 4, 50), L('2026-10-06', 6, 30),
  L('2026-09-10', 1, 400), L('2026-09-12', 3, 80), L('2026-09-02', 4, 50),
  L('2026-08-20', 2, 100), L('2026-08-02', 4, 50),
  L('2026-07-01', 5, 1000), L('2026-07-01', 7, 2000),
]

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 14, 12)) })
afterEach(() => vi.useRealTimers())

describe('períodos', () => {
  it('cada período começa e termina no dia certo', () => {
    expect(intervalo('mes')).toEqual({ de: '2026-10-01', ate: '2026-10-14' })
    expect(intervalo('mespassado')).toEqual({ de: '2026-09-01', ate: '2026-09-30' })
    expect(intervalo('3m')).toEqual({ de: '2026-08-01', ate: '2026-10-14' })
    expect(intervalo('6m')).toEqual({ de: '2026-05-01', ate: '2026-10-14' })
    expect(intervalo('ano')).toEqual({ de: '2026-01-01', ate: '2026-10-14' })
    expect(intervalo('tudo')).toEqual({ de: '0000-01-01', ate: '2026-10-14' })
  })
  it('"este mês" compara com o mês passado até o mesmo dia', () => {
    expect(intervaloAnterior('mes', intervalo('mes'))).toEqual({ de: '2026-09-01', ate: '2026-09-14' })
  })
  it('no dia 31, o mês anterior mais curto para no último dia dele', () => {
    vi.setSystemTime(new Date(2026, 2, 31, 12))
    expect(intervaloAnterior('mes', intervalo('mes'))).toEqual({ de: '2026-02-01', ate: '2026-02-28' })
  })
  it('"mês passado" compara com o mês antes dele, inteiro', () => {
    expect(intervaloAnterior('mespassado', intervalo('mespassado'))).toEqual({ de: '2026-08-01', ate: '2026-08-31' })
  })
  it('períodos longos comparam com o mesmo número de dias logo antes', () => {
    // 3 meses = 01/08 a 14/10 (75 dias) → 75 dias antes de 01/08
    expect(intervaloAnterior('3m', intervalo('3m'))).toEqual({ de: '2026-05-18', ate: '2026-07-31' })
  })
  it('"tudo" não tem período anterior', () => {
    expect(intervaloAnterior('tudo', intervalo('tudo'))).toBe(null)
  })
})

describe('somas em centavos', () => {
  it('soma por natureza sem erro de casas decimais', () => {
    const n = porNatureza([L('2026-10-01', 1, 0.1), L('2026-10-01', 2, 0.2), L('2026-10-01', 3, 19.99), L('2026-10-01', 3, 0.01)], cat)
    expect(n.venda).toBe(0.3)
    expect(n.variavel).toBe(20)
  })
  it('categoria desconhecida não entra em nenhuma natureza', () => {
    expect(porNatureza([{ data: '2026-10-01', categoria_id: 99, valor: 10, tipo: 'entrada' }], cat).venda).toBe(0)
  })
  it('caixa = entradas - saídas de todos os tempos', () => {
    expect(saldoCaixa(LANCS)).toBe(1640)
    expect(saldoCaixa([L('2026-10-01', 1, 0.1), L('2026-10-01', 2, 0.2), L('2026-10-01', 3, 0.3)])).toBe(0)
  })
})

describe('meta mínima de vendas', () => {
  it('contas fixas por mês ÷ quanto sobra de cada venda, nos últimos 3 meses', () => {
    // 3 meses: vendas 1000, gastos de produção 210, contas fixas 150, em 2 meses + 14/31
    const esperado = 150 / (2 + 14 / 31) / (790 / 1000)
    expect(metaMinima(LANCS, cat)).toBeCloseTo(esperado, 6)
  })
  it('sem vendas nos 3 meses, não tem meta', () => {
    expect(metaMinima([L('2026-10-02', 4, 50)], cat)).toBe(null)
  })
  it('se os gastos de produção comem toda a venda, não tem meta', () => {
    expect(metaMinima([L('2026-10-05', 1, 100), L('2026-10-06', 3, 100), L('2026-10-02', 4, 50)], cat)).toBe(null)
  })
  it('é a mesma em qualquer período da Gestão', () => {
    expect(analise(LANCS, cat, 'mes').meta).toBe(analise(LANCS, cat, 'ano').meta)
  })
})

describe('análise do mês', () => {
  const a = () => analise(LANCS, cat, 'mes')

  it('lucro = vendas - gastos de produção - contas fixas', () => {
    const r = a()
    expect(r.n.venda).toBe(500)
    expect(r.n.variavel).toBe(130)
    expect(r.n.fixa).toBe(50)
    expect(r.lucro).toBe(320)
    expect(r.sobraPct).toBeCloseTo(0.74, 10)
  })
  it('quantidade de vendas, ticket médio, entradas e saídas', () => {
    const r = a()
    expect(r.nVendas).toBe(2)
    expect(r.ticket).toBe(250)
    expect(r.ent).toBe(500)
    expect(r.sai).toBe(180)
    expect(r.variacaoCaixa).toBe(320)
    expect(r.meses).toBe(1)
    expect(r.vendasMes).toBe(500)
  })
  it('compara com o mês passado até o mesmo dia', () => {
    const r = a()
    expect(r.ant).toEqual({ venda: 400, lucro: 270 })
    expect(r.cresc).toBeCloseTo(0.25, 10)
  })
  it('caixa e retorno do que foi investido em equipamento', () => {
    const r = a()
    expect(r.caixa).toBe(1640)
    expect(r.investTotal).toBe(1000)
    // lucro de todos os tempos: 1000 - 210 - 150 = 640, sobre 1000 investidos
    expect(r.retornoPct).toBeCloseTo(0.64, 10)
  })
  it('canais de venda e para onde foi o dinheiro, do maior para o menor', () => {
    const r = a()
    expect(r.canais.map(x => [x.id, x.valor, x.qtd])).toEqual([[1, 300, 1], [2, 200, 1]])
    // equipamento não entra em "para onde foi"
    expect(r.destinos.map(x => [x.id, x.valor])).toEqual([[3, 100], [4, 50], [6, 30]])
  })
  it('dicas: taxa da Shopee e vendas crescendo', () => {
    expect(a().dicas).toEqual([
      ['', 'Taxas da Shopee levam 6% das vendas. Venda direta pelo WhatsApp não tem essa taxa.'],
      ['bom', 'As vendas cresceram 25% em relação ao período anterior.'],
    ])
  })
  it('dica de alerta quando a média de vendas fica abaixo da meta', () => {
    const fraco = [L('2026-10-05', 1, 100), L('2026-10-06', 3, 20), L('2026-10-02', 4, 300), L('2026-09-10', 1, 100)]
    const r = analise(fraco, cat, 'mes')
    expect(r.meta).toBeGreaterThan(r.vendasMes)
    expect(r.dicas[0][0]).toBe('alerta')
    expect(r.dicas[0][1]).toMatch(/^Para pagar as contas fixas, vocês precisam vender pelo menos R\$/)
  })
  it('dica de queda quando as vendas caem mais de 10%', () => {
    const r = analise([L('2026-10-05', 1, 80), L('2026-09-05', 1, 100)], cat, 'mes')
    expect(r.cresc).toBeCloseTo(-0.2, 10)
    expect(r.dicas.at(-1)).toEqual(['alerta', 'As vendas caíram 20% em relação ao período anterior.'])
  })
})

describe('outros períodos', () => {
  it('período sem lançamentos não tem análise', () => {
    expect(analise([L('2026-08-20', 2, 100)], cat, 'mes')).toBe(null)
  })
  it('"tudo" começa no primeiro lançamento e não compara', () => {
    const r = analise(LANCS, cat, 'tudo')
    expect(r.iv).toEqual({ de: '2026-07-01', ate: '2026-10-14' })
    expect(r.ant).toBeUndefined()
    expect(r.cresc).toBeUndefined()
    expect(r.n.venda).toBe(1000)
    expect(r.lucro).toBe(640)
  })
  it('"3 meses" divide as médias pelo número de meses', () => {
    const r = analise(LANCS, cat, '3m')
    expect(r.meses).toBeCloseTo(2 + 14 / 31, 10)
    expect(r.vendasMes).toBeCloseTo(1000 / (2 + 14 / 31), 10)
  })
})

describe('mês a mês (gráfico)', () => {
  it('entradas, saídas e resultado dos últimos meses, do mais antigo ao atual', () => {
    expect(porMes(LANCS, 3)).toEqual([
      { chave: '2026-08', mes: 7, ent: 100, sai: 50, res: 50 },
      { chave: '2026-09', mes: 8, ent: 400, sai: 130, res: 270 },
      { chave: '2026-10', mes: 9, ent: 500, sai: 180, res: 320 },
    ])
  })
})
