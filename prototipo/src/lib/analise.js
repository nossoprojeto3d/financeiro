// Contas da Gestão (mesma lógica do app atual, separada da tela)
import { cent, soma, iso, deISO, hoje, fmt, pct } from './formato.js'

export const PERIODOS = [['mes', 'Este mês'], ['mespassado', 'Mês passado'], ['3m', '3 meses'], ['6m', '6 meses'], ['ano', 'Este ano'], ['tudo', 'Tudo']]

export function intervalo(periodo) {
  const h = new Date(), y = h.getFullYear(), m = h.getMonth()
  switch (periodo) {
    case 'mes': return { de: iso(new Date(y, m, 1)), ate: hoje() }
    case 'mespassado': return { de: iso(new Date(y, m - 1, 1)), ate: iso(new Date(y, m, 0)) }
    case '3m': return { de: iso(new Date(y, m - 2, 1)), ate: hoje() }
    case '6m': return { de: iso(new Date(y, m - 5, 1)), ate: hoje() }
    case 'ano': return { de: `${y}-01-01`, ate: hoje() }
    default: return { de: '0000-01-01', ate: hoje() }
  }
}

export function intervaloAnterior(periodo, { de, ate }) {
  if (de === '0000-01-01') return null
  const h = new Date(), y = h.getFullYear(), m = h.getMonth()
  if (periodo === 'mes') {
    const ultimo = new Date(y, m, 0).getDate()
    return { de: iso(new Date(y, m - 1, 1)), ate: iso(new Date(y, m - 1, Math.min(h.getDate(), ultimo))) }
  }
  if (periodo === 'mespassado') return { de: iso(new Date(y, m - 2, 1)), ate: iso(new Date(y, m - 1, 0)) }
  const d1 = deISO(de), d2 = deISO(ate)
  const dias = Math.round((d2 - d1) / 864e5) + 1
  const fim = new Date(d1); fim.setDate(fim.getDate() - 1)
  const ini = new Date(fim); ini.setDate(ini.getDate() - dias + 1)
  return { de: iso(ini), ate: iso(fim) }
}

const noIv = (l, iv) => l.data >= iv.de && l.data <= iv.ate

export function porNatureza(lista, cat) {
  const r = { venda: 0, aporte: 0, outra: 0, variavel: 0, fixa: 0, investimento: 0 }
  lista.forEach(l => { const n = cat(l.categoria_id)?.natureza; if (n in r) r[n] += cent(l.valor) })
  for (const k in r) r[k] /= 100
  return r
}

const mesesEntre = iv => {
  const a = deISO(iv.de), b = deISO(iv.ate)
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + b.getDate() / 31 - (a.getDate() - 1) / 31)
}

export const saldoCaixa = lancs => lancs.reduce((a, l) => a + (l.tipo === 'entrada' ? 1 : -1) * cent(l.valor), 0) / 100

export function analise(lancs, cat, periodo) {
  let iv = intervalo(periodo)
  const ivAnt = intervaloAnterior(periodo, iv)
  if (iv.de === '0000-01-01') iv = { de: lancs.reduce((m, l) => (l.data < m ? l.data : m), iv.ate), ate: iv.ate }
  const per = lancs.filter(l => noIv(l, iv))
  if (!per.length) return null
  const n = porNatureza(per, cat)
  const vendasL = per.filter(l => cat(l.categoria_id)?.natureza === 'venda')
  const meses = mesesEntre(iv)
  const mc = n.venda - n.variavel
  const lucro = mc - n.fixa
  const r = {
    iv, n, meses, lucro,
    nVendas: vendasL.length,
    ticket: vendasL.length ? n.venda / vendasL.length : null,
    sobraPct: n.venda > 0 ? mc / n.venda : null,
    ent: soma(per.filter(l => l.tipo === 'entrada')),
    sai: soma(per.filter(l => l.tipo === 'saida')),
    vendasMes: n.venda / meses,
    fixaMes: n.fixa / meses,
  }
  r.variacaoCaixa = (cent(r.ent) - cent(r.sai)) / 100
  r.meta = r.sobraPct > 0 ? r.fixaMes / r.sobraPct : null
  if (ivAnt) {
    const a = porNatureza(lancs.filter(l => noIv(l, ivAnt)), cat)
    r.ant = { venda: a.venda, lucro: a.venda - a.variavel - a.fixa }
    r.cresc = a.venda > 0 ? (n.venda - a.venda) / a.venda : null
  }
  r.caixa = saldoCaixa(lancs)

  const all = porNatureza(lancs, cat)
  const lucroTotal = all.venda - all.variavel - all.fixa
  r.investTotal = all.investimento
  r.retornoPct = all.investimento > 0 ? Math.min(1, Math.max(0, lucroTotal) / all.investimento) : null

  const agrupar = lista => {
    const g = {}
    lista.forEach(l => { const k = l.categoria_id; g[k] = g[k] || { id: k, valor: 0, qtd: 0 }; g[k].valor += cent(l.valor); g[k].qtd++ })
    return Object.values(g).map(x => ({ ...x, valor: x.valor / 100, c: cat(x.id) })).sort((a, b) => b.valor - a.valor)
  }
  r.canais = agrupar(vendasL)
  r.destinos = agrupar(per.filter(l => l.tipo === 'saida' && cat(l.categoria_id)?.natureza !== 'investimento'))

  const d = []
  if (r.meta != null && r.vendasMes < r.meta) d.push(['alerta', `Para pagar as contas fixas, vocês precisam vender pelo menos ${fmt(r.meta)} por mês. Hoje a média é ${fmt(r.vendasMes)}.`])
  const shopee = r.destinos.filter(x => /shopee/i.test(x.c?.nome)).reduce((a, x) => a + x.valor, 0)
  if (shopee > 0 && n.venda > 0) d.push(['', `Taxas da Shopee levam ${pct(shopee / n.venda)} das vendas. Venda direta pelo WhatsApp não tem essa taxa.`])
  if (r.cresc != null && r.cresc > 0.1) d.push(['bom', `As vendas cresceram ${pct(r.cresc)} em relação ao período anterior.`])
  if (r.cresc != null && r.cresc < -0.1) d.push(['alerta', `As vendas caíram ${pct(-r.cresc)} em relação ao período anterior.`])
  r.dicas = d
  return r
}

// Entradas e saídas mês a mês (últimos n meses)
export function porMes(lancs, n = 6) {
  const h = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(h.getFullYear(), h.getMonth() - (n - 1 - i), 1)
    const chave = iso(d).slice(0, 7)
    const lm = lancs.filter(l => l.data.startsWith(chave))
    const ent = soma(lm.filter(l => l.tipo === 'entrada')), sai = soma(lm.filter(l => l.tipo === 'saida'))
    return { chave, mes: d.getMonth(), ent, sai, res: (cent(ent) - cent(sai)) / 100 }
  })
}
