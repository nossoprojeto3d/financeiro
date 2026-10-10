// Formatação e contas em centavos (nunca somar decimais direto)
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const fmt = v => BRL.format(v || 0)
export const fmtCurto = v => {
  const a = Math.abs(v)
  if (a >= 1000) return (v < 0 ? '−' : '') + 'R$ ' + (a / 1000).toFixed(a >= 10000 ? 0 : 1).replace('.', ',') + ' mil'
  return fmt(v)
}
export const cent = v => Math.round((v || 0) * 100)
export const soma = lista => lista.reduce((a, l) => a + cent(l.valor), 0) / 100
export const pct = v => (v == null || !isFinite(v) ? '—' : Math.round(v * 100) + '%')

// Separa reais e centavos para mostrar os centavos menores
export function partes(v) {
  const t = fmt(Math.abs(v)).replace('R$', '').trim()
  const [reais, cents] = t.split(',')
  return { sinal: v < 0 ? '−' : '', reais, cents }
}

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const MESES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const deISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const hoje = () => iso(new Date())
export const ontem = () => { const d = new Date(); d.setDate(d.getDate() - 1); return iso(d) }

export function dataBonita(s) {
  if (s === hoje()) return 'Hoje'
  if (s === ontem()) return 'Ontem'
  const d = deISO(s)
  const dia = `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`
  return d.getFullYear() === new Date().getFullYear() ? dia : `${dia} de ${d.getFullYear()}`
}
export const dataCurta = s => { const d = deISO(s); return `${d.getDate()} ${MESES[d.getMonth()]}` }
