// Modo demonstração (npm run demo): o app roda com dados de exemplo, sem tocar no Supabase.
// Só entra no `vite --mode demo`; o build publicado não carrega este arquivo.
// Os dados ficam no navegador (demo_banco). Para recomeçar do zero, abra com ?zerar no endereço.
import { CONFIG } from '../lib/config.js'

const CHAVE = 'demo_banco'
const EU = '00000000-0000-0000-0000-00000000000a'
const THAI = '00000000-0000-0000-0000-00000000000b'

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const diasAtras = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }

function bancoInicial() {
  const nomes = [
    ['Vendas Shopee', 'entrada', 'venda'], ['Vendas diretas / WhatsApp', 'entrada', 'venda'],
    ['Encomendas personalizadas', 'entrada', 'venda'], ['Aporte de investidor', 'entrada', 'aporte'],
    ['Saldo inicial / ajuste', 'entrada', 'outra'], ['Filamento', 'saida', 'variavel'],
    ['Embalagens', 'saida', 'variavel'], ['Frete / envio', 'saida', 'variavel'],
    ['Taxas Shopee', 'saida', 'variavel'], ['Software e assinaturas', 'saida', 'fixa'],
    ['Impressoras e equipamentos', 'saida', 'investimento'],
  ]
  const categorias = nomes.map(([nome, tipo, natureza], i) => ({ id: i + 1, nome, tipo, natureza, ativa: true }))
  const lancamentos = []
  let id = 0
  const lanc = (dias, tipo, valor, categoria_id, descricao, forma, quem = EU) =>
    lancamentos.push({ id: ++id, tipo, valor, categoria_id, descricao, forma_pagamento: forma, data: diasAtras(dias),
      usuario_id: quem, recorrente_id: null, atualizado_em: 't' + id })
  lanc(150, 'entrada', 1500, 5, 'Saldo inicial', null)
  // quatro meses de movimento para o gráfico e a meta mínima
  for (let m = 4; m >= 0; m--) {
    const b = m * 30
    lanc(b + 26, 'entrada', 420 + m * 35, 1, `Pedidos Shopee semana 1`, 'Pix', THAI)
    lanc(b + 19, 'entrada', 380 + m * 20, 1, `Pedidos Shopee semana 2`, 'Pix', THAI)
    lanc(b + 12, 'entrada', 260, 2, 'Vasos geométricos (WhatsApp)', 'Pix')
    lanc(b + 8, 'entrada', 190, 3, 'Chaveiros personalizados', 'Dinheiro')
    lanc(b + 22, 'saida', 240, 6, '3 rolos PLA preto', 'Cartão de crédito')
    lanc(b + 15, 'saida', 85, 7, 'Caixinhas e plástico bolha', 'Pix', THAI)
    lanc(b + 10, 'saida', 120, 9, 'Taxas Shopee do mês', 'Transferência')
    lanc(b + 5, 'saida', 49.9, 10, 'Assinatura de modelos 3D', 'Cartão de crédito')
  }
  const fiados = [
    { id: 1, nome: 'Ana da padaria', valor: 80, categoria_id: 2, descricao: '2 vasos geométricos', data: diasAtras(12), usuario_id: THAI },
    { id: 2, nome: 'João', valor: 150, categoria_id: 3, descricao: 'Luminária lua', data: diasAtras(3), usuario_id: EU },
    { id: 3, nome: 'Tia Marta', valor: 35.5, categoria_id: 2, descricao: 'Chaveiro com nome', data: diasAtras(0), usuario_id: EU },
    { id: 4, nome: 'Carlos (vizinho)', valor: 60, categoria_id: 3, descricao: 'Suporte de headset', data: diasAtras(1), usuario_id: THAI },
    { id: 5, nome: 'Bia', valor: 25, categoria_id: 2, descricao: 'Brincos geométricos', data: diasAtras(0), usuario_id: THAI },
    { id: 6, nome: 'Seu Zé (oficina)', valor: 600, categoria_id: 3, descricao: 'Suportes de ferramentas', data: diasAtras(20), usuario_id: EU },
    { id: 7, nome: 'Dona Lúcia', valor: 200, pago: 120, categoria_id: 3, descricao: 'Topo de bolo', data: diasAtras(8), usuario_id: THAI },
  ].map(f => ({ pago: 0, ...f, atualizado_em: 't0' }))
  return {
    seq: 1000,
    perfis: [{ id: EU, nome: 'Junior', cor: '#4FE0A5' }, { id: THAI, nome: 'Thai', cor: '#FF7B8B' }],
    categorias, lancamentos, recorrentes: [], fiados,
  }
}

if (new URLSearchParams(location.search).has('zerar')) {
  localStorage.removeItem(CHAVE)
  localStorage.removeItem('caixa_cache')
  history.replaceState(null, '', location.pathname)
}
let db
try { db = JSON.parse(localStorage.getItem(CHAVE)) } catch (_) { db = null }
if (!db) db = bancoInicial()
const salvar = () => localStorage.setItem(CHAVE, JSON.stringify(db))
salvar()

// sessão de mentira: entra direto como Junior
localStorage.setItem('caixa_sessao', JSON.stringify({ access_token: 'demo', refresh_token: 'demo', expires_at: 4102444800, user: { id: EU, email: 'demo@exemplo.com' } }))

const resp = (corpo, status = 200) => new Response(corpo == null ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
const erro = (message, status = 400) => resp({ message }, status)
const espera = () => new Promise(ok => setTimeout(ok, 250)) // parece rede de verdade

window.__bancoFalso = true
const real = window.fetch.bind(window)
window.fetch = async (url, op = {}) => {
  url = String(url)
  if (!url.startsWith(CONFIG.SUPABASE_URL)) return real(url, op)
  await espera()
  const u = new URL(url), m = (op.method || 'GET').toUpperCase()
  const corpo = op.body ? JSON.parse(op.body) : null
  const prefer = op.headers?.Prefer || ''

  if (u.pathname.startsWith('/auth/')) return resp({})
  if (u.pathname.startsWith('/functions/')) return resp({ erro: 'A análise com IA não funciona no modo demonstração.' }, 400)

  const caminho = u.pathname.replace('/rest/v1/', '')
  if (caminho === 'rpc/gerar_recorrentes') return resp(0)
  if (caminho === 'rpc/receber_fiado') {
    // mesma regra do v4-fiados-parcial.sql: sem p_valor recebe tudo o que falta
    const i = db.fiados.findIndex(f => f.id === corpo.p_id)
    if (i < 0) return erro('Esse fiado já foi recebido ou excluído.')
    const f = db.fiados[i]
    if (!corpo.p_data || corpo.p_data < f.data || corpo.p_data > iso(new Date()))
      return erro('A data do pagamento não pode ser antes da entrega nem no futuro.')
    const falta = Math.round(f.valor * 100) - Math.round((f.pago || 0) * 100)
    const v = corpo.p_valor == null ? falta : Math.round(corpo.p_valor * 100)
    if (v <= 0 || v > falta) return erro('O valor pago tem que ser maior que zero e no máximo o que falta.')
    const l = { id: ++db.seq, tipo: 'entrada', valor: v / 100, categoria_id: f.categoria_id,
      descricao: `${f.nome.trim()} · ${f.descricao.trim()}`.slice(0, 192) + (v < falta ? ' (parte)' : ''), forma_pagamento: corpo.p_forma.trim(),
      data: corpo.p_data, usuario_id: EU, recorrente_id: null, atualizado_em: 't' + db.seq }
    db.lancamentos.push(l)
    if (v === falta) db.fiados.splice(i, 1)
    else Object.assign(f, { pago: (Math.round((f.pago || 0) * 100) + v) / 100, atualizado_em: 't' + ++db.seq })
    salvar()
    return resp(l)
  }

  const lista = db[caminho]
  if (!lista) return erro(`Could not find the table 'public.${caminho}' in the schema cache`, 404)
  const filtros = [...u.searchParams].filter(([, v]) => v.startsWith('eq.'))
  const bate = x => filtros.every(([k, v]) => String(x[k]) === v.slice(3))
  if (m === 'GET') return resp(lista.filter(bate))
  if (m === 'POST') {
    const novo = { usuario_id: EU, ...(caminho === 'fiados' ? { pago: 0 } : {}), ...corpo, id: ++db.seq, atualizado_em: 't' + db.seq }
    lista.push(novo); salvar()
    return resp([novo], 201)
  }
  if (m === 'PATCH') {
    const alvo = lista.filter(bate)
    alvo.forEach(x => Object.assign(x, corpo, { atualizado_em: 't' + ++db.seq }))
    salvar()
    return resp(alvo)
  }
  if (m === 'DELETE') {
    const fora = []
    for (let i = lista.length - 1; i >= 0; i--) if (bate(lista[i])) fora.push(...lista.splice(i, 1))
    salvar()
    return /representation/.test(prefer) ? resp(fora) : resp(null, 204)
  }
  return erro('Método não suportado', 405)
}

// selo para ninguém confundir com o app de verdade
addEventListener('DOMContentLoaded', () => {
  const selo = document.createElement('div')
  selo.textContent = 'DEMONSTRAÇÃO · dados de exemplo'
  selo.style.cssText = 'position:fixed;top:max(6px,env(safe-area-inset-top));right:8px;z-index:9999;padding:3px 10px;border-radius:999px;background:#F5B83D;color:#101218;font:600 11px system-ui;pointer-events:none;opacity:.9'
  document.body.appendChild(selo)
})
