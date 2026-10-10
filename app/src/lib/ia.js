// Análise com IA: monta só os totais (nunca as descrições) e guarda a resposta
// no celular até o fim do dia, igual à versão 3 (mesma chave caixa_ia).
import { iso, hoje, MESES, soma } from './formato.js'
import { nomeNatureza } from './dados.js'

const r2 = v => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100)

export function dadosParaIA(a, meses, lancs, cat, recorrentes) {
  const n = a.n
  const saidas = {}
  lancs.filter(l => l.tipo === 'saida' && l.data >= a.iv.de && l.data <= a.iv.ate).forEach(l => {
    const s = (saidas[l.categoria_id] ||= { lista: [] })
    s.lista.push(l)
  })
  return {
    periodo: { de: a.iv.de, ate: a.iv.ate, meses: r2(a.meses) },
    vendas: r2(n.venda), numero_de_vendas: a.nVendas, valor_medio_por_venda: r2(a.ticket),
    vendas_por_mes: r2(a.vendasMes), vendas_no_periodo_anterior: r2(a.ant?.venda),
    gastos_para_produzir_e_entregar: r2(n.variavel), contas_fixas: r2(n.fixa),
    lucro: r2(a.lucro), compra_de_equipamentos: r2(n.investimento),
    dinheiro_colocado_por_socios_ou_investidores: r2(n.aporte), outras_entradas: r2(n.outra),
    dinheiro_em_caixa_hoje: r2(a.caixa), venda_minima_mensal_para_pagar_contas_fixas: r2(a.meta),
    percentual_dos_equipamentos_ja_pago_pelo_lucro: a.retornoPct == null ? null : Math.round(a.retornoPct * 100),
    canais_de_venda: a.canais.map(c => ({ canal: c.c?.nome, valor: r2(c.valor), vendas: c.qtd })),
    saidas_por_categoria: Object.entries(saidas)
      .map(([id, s]) => ({ c: cat(Number(id)), valor: soma(s.lista), qtd: s.lista.length }))
      .sort((x, y) => y.valor - x.valor)
      .map(s => ({ categoria: s.c?.nome, tipo: nomeNatureza(s.c?.natureza), valor: r2(s.valor), lancamentos: s.qtd })),
    ultimos_6_meses: meses.map(m => ({ mes: MESES[m.mes], entradas: r2(m.ent), saidas: r2(m.sai) })),
    lancamentos_mensais_automaticos: recorrentes.filter(r => r.ativa)
      .map(r => ({ categoria: cat(r.categoria_id)?.nome, valor: r2(r.valor), tipo: r.tipo })),
  }
}

export const chaveIA = (periodo, iv) => `${periodo}|${iv.de}|${iv.ate}`

export function iaSalva(chave) {
  try {
    const m = JSON.parse(localStorage.getItem('caixa_ia') || '{}')
    const x = m[chave]
    // vale só até as 23:59 do dia em que foi pedida
    return x && iso(new Date(x.em)) === hoje() ? x : null
  } catch (_) { return null }
}

export function guardarIA(chave, valor) {
  try {
    const m = JSON.parse(localStorage.getItem('caixa_ia') || '{}')
    for (const k in m) if (iso(new Date(m[k].em)) !== hoje()) delete m[k]
    m[chave] = valor
    const chaves = Object.keys(m)
    if (chaves.length > 8) chaves.slice(0, chaves.length - 8).forEach(k => delete m[k])
    localStorage.setItem('caixa_ia', JSON.stringify(m))
  } catch (_) {}
}
