// Contas a pagar: contas puras (sem banco nem tela).
import { deISO, cent } from './formato.js'

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
