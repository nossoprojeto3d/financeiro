// Lançar sem internet: lançamentos novos que não conseguiram ir para o banco ficam numa fila
// guardada no celular (chave caixa_fila) e são enviados sozinhos quando a internet volta.
// Cada um leva uma etiqueta (id_cliente): se chegar duas vezes, o banco não cria outro.

const CHAVE = 'caixa_fila'

// uuid v4 (crypto.randomUUID só existe em https/localhost; o resto é reserva)
export function novaEtiqueta() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// número negativo: nunca bate com os do banco (que são positivos)
let ultimo = 0
const idTemporario = () => { ultimo = Math.min(ultimo - 1, -Date.now()); return ultimo }

export const novoPendente = dados => ({ ...dados, id: idTemporario(), id_cliente: dados.id_cliente || novaEtiqueta(), pendente: true })

// os do banco + os que ainda esperam (sem repetir os que já chegaram e a resposta se perdeu)
export function juntarComFila(servidor, fila) {
  if (!fila.length) return servidor
  const chegaram = new Set(servidor.map(l => l.id_cliente).filter(Boolean))
  return [...servidor, ...fila.filter(p => !chegaram.has(p.id_cliente))]
}

export function lerFila() {
  try { return JSON.parse(localStorage.getItem(CHAVE) || '[]') } catch (_) { return [] }
}
export function gravarFila(fila) {
  try {
    if (fila.length) localStorage.setItem(CHAVE, JSON.stringify(fila))
    else localStorage.removeItem(CHAVE)
  } catch (_) {}
}
