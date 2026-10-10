// Estado do app, dados do banco, sincronização e trava.
// As chaves guardadas no celular (caixa_*) são as mesmas da versão 3: quem já
// estava logado continua logado, com o mesmo Face ID e os mesmos dados guardados.
import { Api } from './api.js'
import { Lock } from './lock.js'
import { cent, hoje, deISO, fmt } from './formato.js'
import { corDaPosicao } from './dados.js'

export const VERSAO = '4.0.0'

export const S = $state({
  fase: 'carregando', // 'carregando' | 'login' | 'trava' | 'app'
  erroLogin: '',
  tela: 'inicio',
  perfil: null,
  perfis: [],
  categorias: [],
  lancs: [],
  recorrentes: [],
  lancar: null, // formulário de lançamento aberto (null = fechado)
  periodo: 'mes',
  aviso: null,
  confirmar: null,
  folhas: 0, // painéis abertos por cima (a sincronização espera fecharem)
  arrastando: false,
  offline: false,
  carregadoEm: 0,
  ofertaFaceId: false,
})

// Tela larga (mesmo ponto do Tailwind lg)
export const tela = $state({ largo: false })
if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(min-width: 1024px)')
  tela.largo = mq.matches
  mq.addEventListener('change', e => { tela.largo = e.matches })
}

/* ---------- Busca rápida de categoria e pessoa ---------- */
const memo = new Map()
function indice(nome, lista) {
  const m = memo.get(nome)
  if (m && m.lista === lista && m.tam === lista.length) return m.mapa
  const mapa = new Map(lista.map(x => [x.id, x]))
  memo.set(nome, { lista, tam: lista.length, mapa })
  return mapa
}
export const cat = id => indice('cat', S.categorias).get(id)
export const perfil = id => indice('perfil', S.perfis).get(id)

// Cada categoria ganha uma cor de filamento pela posição (ordem de criação)
const comCores = lista => [...lista].sort((a, b) => a.id - b.id).map((c, i) => ({ ...c, cor: corDaPosicao(i) }))
const semCor = lista => lista.map(({ cor, ...c }) => c)
const numerico = l => ({ ...l, valor: Number(l.valor) })
const ordenar = lista => lista.sort((a, b) => (b.data > a.data ? 1 : b.data < a.data ? -1 : b.id - a.id))

// Ordem manual (coluna "ordem", do v2-ordem.sql). Sem ela no banco, as mais usadas primeiro.
export const temOrdem = () => S.categorias.some(c => 'ordem' in c)
export const porOrdem = (a, b) => (a.ordem ?? 1e9) - (b.ordem ?? 1e9) || a.nome.localeCompare(b.nome)
const proximaOrdem = tipo => (temOrdem()
  ? { ordem: Math.max(0, ...S.categorias.filter(c => c.tipo === tipo).map(c => c.ordem || 0)) + 1 } : {})

export function categoriasDoTipo(tipo) {
  const lista = S.categorias.filter(c => c.tipo === tipo)
  if (temOrdem()) return lista.sort(porOrdem)
  const uso = {}
  S.lancs.forEach(l => { uso[l.categoria_id] = (uso[l.categoria_id] || 0) + 1 })
  return lista.sort((a, b) => (uso[b.id] || 0) - (uso[a.id] || 0) || a.nome.localeCompare(b.nome))
}

export const saldoCaixa = () => S.lancs.reduce((a, l) => a + (l.tipo === 'entrada' ? 1 : -1) * cent(l.valor), 0) / 100

/* ---------- Avisos e confirmação ---------- */
let avisoT
export function avisar(texto, tipo = 'ok') {
  clearTimeout(avisoT)
  S.aviso = { texto, tipo, id: Date.now() }
  avisoT = setTimeout(() => { S.aviso = null }, tipo === 'erro' ? 4200 : 2600)
}

// Janelinha própria no lugar do confirm(): no iPhone com o app instalado, a chamada
// ao banco logo depois de um confirm() falha como "Load failed".
export function confirmar(texto, { ok = 'Excluir', perigo = true } = {}) {
  return new Promise(resolve => { S.confirmar = { texto, ok, perigo, resolve } })
}
export function responderConfirmacao(sim) {
  const c = S.confirmar
  S.confirmar = null
  c?.resolve(sim)
}

export async function tratarErro(e) {
  if (e?.auth) {
    await Api.sair()
    S.lancar = null
    S.erroLogin = e.message
    S.fase = 'login'
  } else avisar(e?.message || 'Algo deu errado.', 'erro')
}

/* ---------- Dados ---------- */
let geradoEm = 0
async function gerarRecorrentes(forcar = false) {
  if (!forcar && Date.now() - geradoEm < 3600e3) return 0
  try { const n = await Api.gerarRecorrentes(); geradoEm = Date.now(); return n || 0 }
  catch (e) { if (e.auth) throw e; return 0 } // sem a V2 no banco, segue sem recorrentes
}
async function buscarRecorrentes() {
  try { return (await Api.recorrentes()).map(numerico) }
  catch (e) { if (e.auth) throw e; return [] }
}

function guardarCache() {
  try {
    localStorage.setItem('caixa_cache', JSON.stringify({
      p: $state.snapshot(S.perfis), c: semCor($state.snapshot(S.categorias)),
      l: $state.snapshot(S.lancs), rc: $state.snapshot(S.recorrentes),
    }))
  } catch (_) {}
}

export async function carregarTudo() {
  try {
    await gerarRecorrentes(true)
    const [p, c, l, rc] = await Promise.all([Api.perfis(), Api.categorias(), Api.lancamentos(), buscarRecorrentes()])
    S.perfis = p
    S.categorias = comCores(c)
    S.recorrentes = rc
    S.lancs = ordenar(l.map(numerico))
    S.offline = false
    S.carregadoEm = Date.now()
    guardarCache()
  } catch (e) {
    if (e.auth) throw e
    const cache = JSON.parse(localStorage.getItem('caixa_cache') || 'null')
    if (!cache) throw e
    S.perfis = cache.p; S.categorias = comCores(cache.c); S.lancs = ordenar(cache.l); S.recorrentes = cache.rc || []
    S.offline = true
    avisar('Sem conexão. Mostrando os últimos dados salvos.', 'erro')
  }
  S.perfil = perfil(Api.sessao().user.id) || null
  if (!S.perfil) {
    const e = new Error('Seu usuário ainda não tem perfil no banco. Rode o passo 2 do setup.sql.')
    e.auth = true
    throw e
  }
}

/* ---------- Sincronização (a cada 30 s e ao voltar para o app) ---------- */
let syncT = null, sincronizando = false

function assinatura(lancs, cats) {
  const ult = lancs.reduce((m, l) => (String(l.atualizado_em || '') > m ? String(l.atualizado_em || '') : m), '')
  const maxId = lancs.reduce((m, l) => Math.max(m, l.id), 0)
  return `${lancs.length}|${maxId}|${ult}|${cats.map(c => `${c.id}:${c.nome}:${c.natureza}:${c.ordem}`).join(',')}`
}
export const assinaturaAtual = () => assinatura(S.lancs, S.categorias)

const digitando = () => !!document.activeElement?.matches?.('input, textarea')
// Não atualiza no meio de um lançamento sendo preenchido, de um painel aberto ou de um arraste
const ocupado = () => {
  const f = S.lancar
  return digitando() || S.folhas > 0 || S.arrastando || !!S.confirmar ||
    !!(f && (f.id || f.centavos || f.descricao.trim()))
}

function iniciarSync() {
  clearInterval(syncT)
  syncT = setInterval(sincronizar, 30000)
}

export async function sincronizar() {
  if (sincronizando || document.hidden || S.fase !== 'app' || ocupado()) return
  sincronizando = true
  try {
    await gerarRecorrentes()
    const [c, l, rc] = await Promise.all([Api.categorias(), Api.lancamentos(), buscarRecorrentes()])
    const novos = ordenar(l.map(numerico))
    S.recorrentes = rc
    S.offline = false
    S.carregadoEm = Date.now()
    if (assinatura(novos, c) === assinatura(S.lancs, S.categorias)) return
    if (ocupado()) return

    const antes = new Set(S.lancs.map(x => x.id))
    const deOutros = novos.filter(x => !antes.has(x.id) && x.usuario_id !== S.perfil.id)
    S.lancs = novos
    S.categorias = comCores(c)
    guardarCache()
    if (deOutros.length === 1) {
      const n = deOutros[0]
      avisar(`${perfil(n.usuario_id)?.nome || 'Alguém'} lançou ${n.tipo === 'entrada' ? 'uma entrada' : 'uma saída'} de ${fmt(n.valor)}`)
    } else if (deOutros.length > 1) avisar(`${deOutros.length} lançamentos novos`)
  } catch (e) {
    if (e.auth) tratarErro(e) // sem internet: tenta de novo no próximo ciclo, sem avisar
  } finally {
    sincronizando = false
  }
}

/* ---------- Entrar, travar e sair ---------- */
// Abre na hora com os últimos dados guardados e atualiza por trás
function abrirComGuardados() {
  let cache = null
  try { cache = JSON.parse(localStorage.getItem('caixa_cache') || 'null') } catch (_) {}
  if (!cache?.p || !cache.c || !cache.l) return false
  const eu = cache.p.find(p => p.id === Api.sessao().user.id)
  if (!eu) return false
  S.perfis = cache.p; S.categorias = comCores(cache.c); S.lancs = ordenar(cache.l); S.recorrentes = cache.rc || []
  S.perfil = eu
  S.fase = 'app'
  marcarUso()
  iniciarSync()
  sincronizar()
  return true
}

export async function entrar(acabouDeLogar = false) {
  if (!acabouDeLogar && abrirComGuardados()) return
  S.fase = 'carregando'
  try { await carregarTudo() } catch (e) { return tratarErro(e) }
  S.fase = 'app'
  marcarUso()
  iniciarSync()
  if (acabouDeLogar && !Lock.ativo() && await Lock.disponivel()) S.ofertaFaceId = true
}

export async function login(email, senha, nome) {
  await Api.login(email, senha)
  localStorage.setItem('caixa_email', email)
  if (nome) localStorage.setItem('caixa_nome', nome)
  S.erroLogin = ''
  await entrar(true)
}

export async function sair() {
  Lock.desativar()
  await Api.sair()
  clearInterval(syncT)
  S.lancar = null
  S.tela = 'inicio'
  S.erroLogin = ''
  S.fase = 'login'
}

// Na trava: "Entrar com senha" esquece a sessão e o Face ID deste aparelho
export async function trocarParaSenha() {
  await Api.sair()
  Lock.desativar()
  S.fase = 'login'
}

// Face ID depois de 5 min sem usar o app (vale também se o iPhone fechou o app)
const TEMPO_TRAVA = 5 * 60e3
function marcarUso() {
  if (S.fase === 'app') try { localStorage.setItem('caixa_ultimo_uso', String(Date.now())) } catch (_) {}
}
function precisaTravar() {
  if (!Lock.ativo()) return false
  return Date.now() - Number(localStorage.getItem('caixa_ultimo_uso') || 0) > TEMPO_TRAVA
}

export async function desbloquear() {
  await Lock.verificar()
  await entrar()
}

export async function ativarFaceId() {
  if (!await Lock.disponivel()) return avisar('Face ID disponível só no app instalado pelo Safari, no endereço https.', 'erro')
  try {
    await Lock.ativar(S.perfil.nome, Api.sessao().user.email)
    S.ofertaFaceId = false
    avisar('Face ID ativado')
  } catch (_) {
    Lock.desativar()
    avisar('Face ID não foi ativado. Tente de novo.', 'erro')
  }
}

/* ---------- Lançamentos ---------- */
export function abrirLancar(tipo = 'entrada', lanc = null, { repetir = false } = {}) {
  S.lancar = lanc
    ? { id: lanc.id, tipo: lanc.tipo, centavos: Math.round(lanc.valor * 100), categoria_id: lanc.categoria_id,
        data: lanc.data, descricao: lanc.descricao || '', forma_pagamento: lanc.forma_pagamento || '',
        usuario_id: lanc.usuario_id, repetir: false, recorrente_id: lanc.recorrente_id || null }
    : { id: null, tipo, centavos: 0, categoria_id: null, data: hoje(), descricao: '',
        forma_pagamento: '', usuario_id: S.perfil.id, repetir }
}
export const fecharLancar = () => { S.lancar = null }

// Trocar de tela descarta um lançamento em branco (o painel do Início abre outro)
export function irPara(t) {
  const f = S.lancar
  if (f && !f.id && !f.centavos && !f.descricao.trim()) S.lancar = null
  S.tela = t
  window.scrollTo({ top: 0 })
}

export async function salvarLanc(f) {
  const dados = {
    tipo: f.tipo, valor: f.centavos / 100, categoria_id: f.categoria_id, data: f.data,
    descricao: f.descricao.trim() || null, forma_pagamento: f.forma_pagamento || null, usuario_id: f.usuario_id,
  }
  if (f.id) {
    const r = await Api.editarLancamento(f.id, dados)
    if (!r) throw new Error('Esse lançamento foi excluído em outro aparelho.')
    const i = S.lancs.findIndex(l => l.id === f.id)
    if (i >= 0) S.lancs[i] = numerico(r); else S.lancs.push(numerico(r))
  } else if (f.repetir) {
    // Cria a regra e deixa o banco lançar este mês (e os anteriores, se a data for antiga)
    const { data, ...resto } = dados
    const rec = await Api.criarRecorrente({ ...resto, dia_mes: deISO(data).getDate(), inicio: data })
    S.recorrentes.push(numerico(rec))
    await gerarRecorrentes(true)
    S.lancs = (await Api.lancamentos()).map(numerico)
  } else {
    S.lancs.push(numerico(await Api.criarLancamento(dados)))
  }
  ordenar(S.lancs)
  guardarCache()
}

export async function excluirLanc(id) {
  await Api.excluirLancamento(id)
  S.lancs = S.lancs.filter(l => l.id !== id)
  guardarCache()
}

/* ---------- Categorias ---------- */
export async function criarCategoria({ nome, tipo, natureza }) {
  const existe = S.categorias.find(c => c.tipo === tipo && c.nome.toLowerCase() === nome.toLowerCase())
  if (existe) {
    if (!existe.ativa) Object.assign(existe, await Api.editarCategoria(existe.id, { ativa: true }))
    return existe
  }
  const nova = await Api.criarCategoria({ nome, tipo, natureza, ...proximaOrdem(tipo) })
  S.categorias = comCores([...semCor(S.categorias), nova])
  return cat(nova.id)
}

export async function salvarCategoria(c, { nome, natureza }) {
  // ativa: true traz de volta categorias arquivadas na versão antiga
  const r = await Api.editarCategoria(c.id, { nome, natureza, ativa: true })
  Object.assign(c, r)
}

export async function excluirCategoria(c, destino = null) {
  try {
    if (destino) {
      await Api.moverCategoria(c.id, destino)
      S.lancs.forEach(l => { if (l.categoria_id === c.id) l.categoria_id = destino })
      S.recorrentes.forEach(r => { if (r.categoria_id === c.id) r.categoria_id = destino })
    }
    await Api.excluirCategoria(c.id)
    S.categorias = S.categorias.filter(x => x.id !== c.id)
  } catch (e) {
    if (e.auth) throw e
    // A resposta pode ter se perdido: confere no banco antes de mostrar erro
    try {
      const lista = await Api.categorias()
      if (!lista.some(x => x.id === c.id)) { S.categorias = comCores(lista); return }
    } catch (_) {}
    throw e
  }
}

export async function salvarOrdem(ids) {
  const mudou = ids.map((id, i) => ({ c: cat(id), ordem: i + 1 })).filter(x => x.c && x.c.ordem !== x.ordem)
  mudou.forEach(x => { x.c.ordem = x.ordem })
  try {
    await Promise.all(mudou.map(x => Api.editarCategoria(x.c.id, { ordem: x.ordem })))
    avisar('Ordem salva')
  } catch (e) {
    tratarErro(e)
    carregarTudo().catch(() => {})
  }
}

/* ---------- Lançamentos que se repetem ---------- */
export async function editarRecorrente(r, dados) {
  Object.assign(r, numerico(await Api.editarRecorrente(r.id, dados)))
  await gerarRecorrentes(true)
  await carregarTudo()
}
export async function excluirRecorrente(r) {
  await Api.excluirRecorrente(r.id)
  S.recorrentes = S.recorrentes.filter(x => x.id !== r.id)
}

/* ---------- Início ---------- */
export function iniciar() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {})
    // Versão nova assumiu: recarrega uma vez para já abrir nela (se não estiver no meio de algo)
    const tinhaControle = !!navigator.serviceWorker.controller
    let recarregou = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!tinhaControle || recarregou || ocupado()) return
      recarregou = true
      location.reload()
    })
  }

  // O iPhone ignora parte do bloqueio de zoom da página: barra a pinça aqui
  ;['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }))
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault() }, { passive: false })

  setInterval(() => { if (!document.hidden) marcarUso() }, 30e3)
  addEventListener('pagehide', marcarUso)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return marcarUso()
    if (S.fase !== 'app') return
    if (precisaTravar()) { S.confirmar = null; S.fase = 'trava'; return }
    sincronizar() // voltou para o app: confere na hora se tem novidade
  })

  if (!Api.configurado()) { S.erroLogin = 'Falta configurar o banco em src/lib/config.js.'; S.fase = 'login'; return }
  if (!Api.sessao()) { S.fase = 'login'; return }
  if (precisaTravar()) { S.fase = 'trava'; return }
  entrar()
}
