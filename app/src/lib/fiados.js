// Fiados: quem levou e ainda não pagou. Contas puras (sem banco nem tela).
import { deISO } from './formato.js'

// O mesmo nome escrito de jeitos diferentes ("Ana", " ana ", "Ána") é uma pessoa só
const chave = nome => String(nome || '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '')

export const pessoas = lista => new Set(lista.map(f => chave(f.nome))).size

// Sugestões do campo "Quem deve": um de cada, com a primeira grafia usada
export function nomesUsados(lista) {
  const vistos = new Map()
  for (const f of lista) {
    const k = chave(f.nome)
    if (k && !vistos.has(k)) vistos.set(k, f.nome.trim())
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function haQuanto(dataISO, hojeISO) {
  const dias = Math.round((deISO(hojeISO) - deISO(dataISO)) / 864e5)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  return `há ${dias} dias`
}

// Atalho "Anotar fiado": já vem marcada a primeira categoria de venda
export const categoriaPadraoFiado = cats => cats.find(c => c.natureza === 'venda') ?? cats[0] ?? null

// Quem deve há mais tempo aparece primeiro
export const ordenarFiados = lista => lista.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.id - b.id))
