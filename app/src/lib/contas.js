// Contas a pagar: contas puras (sem banco nem tela).
import { deISO, cent, fmt } from './formato.js'

const diasAte = (vencimento, hojeISO) => Math.round((deISO(vencimento) - deISO(hojeISO)) / 864e5)

// "atrasada há 3 dias", "vence hoje", "vence em 5 dias", "vence 10/11"
// urgente = atrasada ou vencendo em até 3 dias (fica em coral)
export function situacao(vencimento, hojeISO) {
  const d = diasAte(vencimento, hojeISO)
  const r = (texto, atrasada, urgente) => ({ texto, atrasada, urgente })
  if (d < -1) return r(`atrasada há ${-d} dias`, true, true)
  if (d === -1) return r('atrasada desde ontem', true, true)
  if (d === 0) return r('vence hoje', false, true)
  if (d === 1) return r('vence amanhã', false, true)
  if (d <= 7) return r(`vence em ${d} dias`, false, d <= 3)
  const [, m, dia] = vencimento.split('-')
  return r(`vence ${dia}/${m}`, false, false)
}

// a que vence antes aparece primeiro (atrasadas no topo)
export const ordenarContas = lista =>
  lista.sort((a, b) => (a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : a.id - b.id))

// total a pagar e quantas pedem atenção: atrasadas, vencendo nos próximos 7 dias, urgentes (até 3 dias)
export function resumoContas(lista, hojeISO) {
  let total = 0, atrasadas = 0, semana = 0, urgentes = 0
  for (const c of lista) {
    total += cent(c.valor)
    const d = diasAte(c.vencimento, hojeISO)
    if (d < 0) atrasadas++
    else if (d <= 7) { semana++; if (d <= 3) urgentes++ }
  }
  return { total: total / 100, atrasadas, semana, urgentes }
}

// Texto da notificação das 8h: contas que vencem hoje e as atrasadas. null = não manda nada.
// (a função "avisos" do Supabase usa a mesma regra: supabase/functions/avisos/index.ts)
export function mensagemAviso(lista, hojeISO) {
  const reais = v => fmt(v).replace(/\s/g, ' ')
  const hoje = lista.filter(c => c.vencimento === hojeISO)
  const atrasadas = lista.filter(c => c.vencimento < hojeISO)
  const todas = [...atrasadas, ...hoje]
  if (!todas.length) return null
  if (todas.length === 1) {
    const c = todas[0]
    if (hoje.length) return { titulo: `${c.descricao} vence hoje`, corpo: `${reais(c.valor)} · toque para ver` }
    return { titulo: `${c.descricao} está atrasada`, corpo: `${reais(c.valor)} · venceu dia ${c.vencimento.slice(8)}/${c.vencimento.slice(5, 7)}` }
  }
  const total = todas.reduce((a, c) => a + cent(c.valor), 0) / 100
  const partes = [
    hoje.length && `${hoje.length} ${hoje.length === 1 ? 'vence' : 'vencem'} hoje`,
    atrasadas.length && `${atrasadas.length} ${atrasadas.length === 1 ? 'está atrasada' : 'estão atrasadas'}`,
  ].filter(Boolean)
  return { titulo: `${todas.length} contas para pagar`, corpo: `${partes.join(' e ')} · ${reais(total)}` }
}
