// Dados de EXEMPLO para o protótipo. Nada aqui vem do banco real.
import { iso } from './formato.js'

export const perfis = [
  { id: 'j', nome: 'Junior', cor: '#F5B83D' },
  { id: 't', nome: 'Thai', cor: '#8FB5FF' },
]

// cor: tom de filamento de cada categoria
export const categorias = [
  { id: 1, nome: 'Vendas Shopee', tipo: 'entrada', natureza: 'venda', cor: '#FF8A4C' },
  { id: 2, nome: 'Vendas diretas / WhatsApp', tipo: 'entrada', natureza: 'venda', cor: '#4FE0A5' },
  { id: 3, nome: 'Encomendas personalizadas', tipo: 'entrada', natureza: 'venda', cor: '#8FB5FF' },
  { id: 4, nome: 'Aporte de investidor', tipo: 'entrada', natureza: 'aporte', cor: '#C59BFF' },
  { id: 5, nome: 'Saldo inicial / ajuste', tipo: 'entrada', natureza: 'outra', cor: '#9AA1B1' },
  { id: 6, nome: 'Filamento', tipo: 'saida', natureza: 'variavel', cor: '#FF7B8B' },
  { id: 7, nome: 'Embalagens', tipo: 'saida', natureza: 'variavel', cor: '#E8C07A' },
  { id: 8, nome: 'Frete / envio', tipo: 'saida', natureza: 'variavel', cor: '#7FD4E8' },
  { id: 9, nome: 'Taxas Shopee', tipo: 'saida', natureza: 'variavel', cor: '#FF8A4C' },
  { id: 10, nome: 'Energia elétrica', tipo: 'saida', natureza: 'variavel', cor: '#F2E46B' },
  { id: 11, nome: 'Manutenção e peças', tipo: 'saida', natureza: 'fixa', cor: '#B7A6FF' },
  { id: 12, nome: 'Anúncios / marketing', tipo: 'saida', natureza: 'fixa', cor: '#FF9ED2' },
  { id: 13, nome: 'Software e assinaturas', tipo: 'saida', natureza: 'fixa', cor: '#8FB5FF' },
  { id: 14, nome: 'Outras despesas', tipo: 'saida', natureza: 'fixa', cor: '#9AA1B1' },
  { id: 15, nome: 'Impressoras e equipamentos', tipo: 'saida', natureza: 'investimento', cor: '#C59BFF' },
  { id: 16, nome: 'Ferramentas e acessórios', tipo: 'saida', natureza: 'investimento', cor: '#A3E07F' },
]

export const NATUREZAS = {
  entrada: [['venda', 'Venda'], ['aporte', 'Dinheiro colocado'], ['outra', 'Outra entrada']],
  saida: [['variavel', 'Gasto de produção'], ['fixa', 'Conta fixa'], ['investimento', 'Equipamento']],
}
export const nomeNatureza = n => [...NATUREZAS.entrada, ...NATUREZAS.saida].find(x => x[0] === n)?.[1] || n
export const PAGAMENTOS = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Boleto', 'Transferência']

// Gerador previsível, para os números não mudarem a cada recarga
function rng(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
}

const descs = {
  1: ['Pedido Shopee #48213', 'Pedido Shopee #48377', 'Vaso geométrico', 'Suporte de headset', 'Chaveiro personalizado (10 un)', 'Organizador de mesa'],
  2: ['Luminária lua', 'Miniatura D&D', 'Porta-retrato', 'Topo de bolo'],
  3: ['Peça técnica sob medida', 'Maquete de casa', 'Troféu do campeonato', 'Peças de reposição'],
  6: ['3 rolos PLA preto', 'PETG transparente', '2 rolos PLA silk dourado', 'TPU flexível'],
  7: ['Caixas kraft', 'Plástico bolha', 'Etiquetas térmicas'],
  8: ['Correios PAC', 'Envio Shopee', 'Motoboy'],
  9: ['Taxa da semana', 'Comissão Shopee'],
  10: ['Conta de luz'],
}

export function gerarLancamentos() {
  const r = rng(42)
  const lista = []
  let id = 1
  const fim = new Date()
  const ini = new Date(fim.getFullYear(), fim.getMonth() - 6, 1)
  const add = (d, tipo, cat, valor, desc, quem, pag) =>
    lista.push({ id: id++, tipo, categoria_id: cat, valor: Math.round(valor * 100) / 100, descricao: desc, data: iso(d), usuario_id: quem, forma_pagamento: pag })

  add(ini, 'entrada', 5, 2500, 'Saldo inicial', 'j', 'Transferência')
  add(new Date(ini.getFullYear(), ini.getMonth(), 3), 'saida', 15, 4890, 'Bambu Lab A1', 'j', 'Cartão de crédito')

  for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
    const dia = new Date(d)
    const quem = () => (r() < 0.55 ? 'j' : 't')
    const pick = arr => arr[Math.floor(r() * arr.length)]
    // vendas crescem um pouco mês a mês
    const ritmo = 1 + (dia - ini) / (fim - ini) * 0.6
    const nVendas = Math.floor(r() * 3 * ritmo)
    for (let i = 0; i < nVendas; i++) {
      const c = r() < 0.6 ? 1 : r() < 0.7 ? 2 : 3
      const v = c === 3 ? 120 + r() * 380 : 25 + r() * 110
      add(dia, 'entrada', c, v, pick(descs[c]), quem(), c === 1 ? 'Transferência' : 'Pix')
    }
    if (r() < 0.16) add(dia, 'saida', 6, 89 + r() * 260, pick(descs[6]), quem(), 'Cartão de crédito')
    if (r() < 0.12) add(dia, 'saida', 7, 30 + r() * 90, pick(descs[7]), quem(), 'Pix')
    if (r() < 0.25) add(dia, 'saida', 8, 14 + r() * 40, pick(descs[8]), quem(), 'Pix')
    if (dia.getDay() === 1) add(dia, 'saida', 9, 40 + r() * 70, pick(descs[9]), 'j', 'Transferência')
    if (dia.getDate() === 10) add(dia, 'saida', 10, 140 + r() * 60, 'Conta de luz', 't', 'Boleto')
    if (dia.getDate() === 5) add(dia, 'saida', 13, 89.9, 'Assinatura Canva + Printables', 'j', 'Cartão de crédito')
    if (dia.getDate() === 1) add(dia, 'saida', 14, 900, 'Aluguel da sala', 'j', 'Pix')
    if (dia.getDate() === 20) add(dia, 'saida', 14, 76.6, 'DAS do MEI', 't', 'Boleto')
    if (dia.getDate() === 15) add(dia, 'saida', 12, 150, 'Anúncios Shopee', 'j', 'Cartão de crédito')
    if (r() < 0.03) add(dia, 'saida', 11, 60 + r() * 140, 'Bico 0.4 + PTFE', 't', 'Pix')
    if (r() < 0.02) add(dia, 'saida', 16, 40 + r() * 160, 'Espátula e alicate', 't', 'Pix')
  }
  return lista.sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
}

export const recorrentes = [
  { id: 1, descricao: 'Assinatura Canva + Printables', valor: 89.9, dia_mes: 5, categoria_id: 13, ativa: true },
  { id: 2, descricao: 'Anúncios Shopee', valor: 150, dia_mes: 15, categoria_id: 12, ativa: true },
]
