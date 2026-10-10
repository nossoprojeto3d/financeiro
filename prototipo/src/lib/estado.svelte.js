// Estado do protótipo (em memória; recarregar volta aos dados de exemplo)
import { perfis, categorias, gerarLancamentos, recorrentes } from './dados.js'
import { hoje } from './formato.js'

export const S = $state({
  tela: 'inicio',
  perfil: perfis[0],
  perfis,
  categorias,
  recorrentes,
  lancs: gerarLancamentos(),
  lancar: null, // formulário aberto (null = fechado)
  periodo: 'mes',
  aviso: null,
})

const idx = new Map(categorias.map(c => [c.id, c]))
export const cat = id => idx.get(id)
export const perfil = id => perfis.find(p => p.id === id)

export function categoriasDoTipo(tipo) {
  const uso = {}
  S.lancs.forEach(l => { uso[l.categoria_id] = (uso[l.categoria_id] || 0) + 1 })
  return S.categorias.filter(c => c.tipo === tipo).sort((a, b) => (uso[b.id] || 0) - (uso[a.id] || 0))
}

export function abrirLancar(tipo = 'entrada', lanc = null) {
  S.lancar = lanc
    ? { id: lanc.id, tipo: lanc.tipo, centavos: Math.round(lanc.valor * 100), categoria_id: lanc.categoria_id,
        data: lanc.data, descricao: lanc.descricao || '', forma_pagamento: lanc.forma_pagamento || '',
        usuario_id: lanc.usuario_id, repetir: false }
    : { id: null, tipo, centavos: 0, categoria_id: null, data: hoje(), descricao: '',
        forma_pagamento: '', usuario_id: S.perfil.id, repetir: false }
}
// Trocar de tela descarta um lançamento em branco (o painel do Início abre outro)
export function irPara(t) {
  if (S.lancar && !S.lancar.id && !S.lancar.centavos) S.lancar = null
  S.tela = t
  if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
}
export const fecharLancar = () => { S.lancar = null }

let avisoT
export function avisar(texto, tipo = 'ok') {
  clearTimeout(avisoT)
  S.aviso = { texto, tipo, id: Date.now() }
  avisoT = setTimeout(() => { S.aviso = null }, 2600)
}

export function salvarLanc(f) {
  const l = { id: f.id ?? Date.now(), tipo: f.tipo, valor: f.centavos / 100, categoria_id: f.categoria_id,
    descricao: f.descricao, data: f.data, usuario_id: f.usuario_id, forma_pagamento: f.forma_pagamento }
  const i = S.lancs.findIndex(x => x.id === l.id)
  if (i >= 0) S.lancs[i] = l
  else S.lancs.unshift(l)
  S.lancs.sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
}
export function excluirLanc(id) { S.lancs = S.lancs.filter(l => l.id !== id) }

// Largura de desktop (mesmo ponto do Tailwind lg)
export const tela = $state({ largo: false })
if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(min-width: 1024px)')
  tela.largo = mq.matches
  mq.addEventListener('change', e => { tela.largo = e.matches })
}
