// Estado do app, dados do banco, sincronização e trava.
// As chaves guardadas no celular (caixa_*) são as mesmas da versão 3: quem já
// estava logado continua logado, com o mesmo Face ID e os mesmos dados guardados.
import { Api } from './api.js'
import { Lock } from './lock.js'
import { cent, hoje, deISO, fmt } from './formato.js'
import { corDaPosicao } from './dados.js'
import { ordenarFiados, categoriaPadraoFiado, falta } from './fiados.js'
import { novoPendente, juntarComFila, lerFila, gravarFila } from './fila.js'

export const VERSAO = '4.4.1'

export const S = $state({
  fase: 'carregando', // 'carregando' | 'login' | 'trava' | 'app' | 'semrede'
  erroLogin: '',
  tela: 'inicio',
  perfil: null,
  perfis: [],
  categorias: [],
  lancs: [],
  recorrentes: [],
  fiados: [],
  temFiados: false, // a tabela de fiados existe no banco (v4-fiados.sql)
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
const numerico = l => ({ ...l, valor: Number(l.valor), ...('pago' in l ? { pago: Number(l.pago) } : {}) })
// no mesmo dia, o mais novo primeiro; os que esperam internet (id negativo) são os mais novos
const ordemId = l => (l.id < 0 ? -l.id : l.id)
const ordenar = lista => lista.sort((a, b) => (b.data > a.data ? 1 : b.data < a.data ? -1 : ordemId(b) - ordemId(a)))

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
// Sem a tabela no banco, o Supabase responde que não achou "fiados": aí o app segue sem fiados.
// Sem internet é outro erro e sobe (a lista não some por uma falha de rede).
async function buscarFiados() {
  try { return ordenarFiados((await Api.fiados()).map(numerico)) }
  catch (e) { if (!e.auth && Api.semTabelaFiados(e)) return null; throw e }
}
function usarFiados(lista) {
  S.temFiados = !!lista
  S.fiados = lista || []
}
const assinaturaFiados = lista => lista.map(f => `${f.id}:${f.atualizado_em}`).join(',')

function guardarCache() {
  try {
    localStorage.setItem('caixa_cache', JSON.stringify({
      p: $state.snapshot(S.perfis), c: semCor($state.snapshot(S.categorias)),
      l: $state.snapshot(S.lancs).filter(l => !l.pendente), rc: $state.snapshot(S.recorrentes),
      f: $state.snapshot(S.fiados), tf: S.temFiados,
    }))
  } catch (_) {}
}

export async function carregarTudo() {
  try {
    await gerarRecorrentes(true)
    const [p, c, l, rc, fz] = await Promise.all([Api.perfis(), Api.categorias(), Api.lancamentos(), buscarRecorrentes(), buscarFiados()])
    S.perfis = p
    S.categorias = comCores(c)
    S.recorrentes = rc
    usarFiados(fz)
    S.lancs = ordenar(juntarComFila(l.map(numerico), lerFila()))
    S.offline = false
    S.carregadoEm = Date.now()
    guardarCache()
  } catch (e) {
    if (e.auth) throw e
    const cache = JSON.parse(localStorage.getItem('caixa_cache') || 'null')
    if (!cache) throw e
    S.perfis = cache.p; S.categorias = comCores(cache.c); S.lancs = ordenar(juntarComFila(cache.l, lerFila())); S.recorrentes = cache.rc || []
    S.fiados = cache.f || []; S.temFiados = !!cache.tf
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
    !!(f && (f.id || f.centavos || f.descricao.trim() || f.nome?.trim()))
}

function iniciarSync() {
  clearInterval(syncT)
  syncT = setInterval(sincronizar, 30000)
}

export async function sincronizar() {
  if (sincronizando || document.hidden || S.fase !== 'app' || ocupado()) return
  sincronizando = true
  try {
    await enviarFila()
    await gerarRecorrentes()
    const [c, l, rc, fz] = await Promise.all([Api.categorias(), Api.lancamentos(), buscarRecorrentes(), buscarFiados()])
    const novos = ordenar(l.map(numerico))
    S.recorrentes = rc
    S.offline = false
    S.carregadoEm = Date.now()
    const mudouLancs = assinatura(novos, c) !== assinatura(S.lancs.filter(l => !l.pendente), S.categorias)
    const mudouFiados = !!fz !== S.temFiados || assinaturaFiados(fz || []) !== assinaturaFiados(S.fiados)
    if (!mudouLancs && !mudouFiados) return
    if (ocupado()) return

    const antes = new Set(S.lancs.map(x => x.id))
    const deOutros = novos.filter(x => !antes.has(x.id) && x.usuario_id !== S.perfil.id)
    const fiadosAntes = new Set(S.fiados.map(x => x.id))
    const fiadosDeOutros = (fz || []).filter(x => !fiadosAntes.has(x.id) && x.usuario_id !== S.perfil.id)
    S.lancs = ordenar(juntarComFila(novos, lerFila()))
    S.categorias = comCores(c)
    usarFiados(fz)
    guardarCache()
    if (deOutros.length === 1) {
      const n = deOutros[0]
      avisar(`${perfil(n.usuario_id)?.nome || 'Alguém'} lançou ${n.tipo === 'entrada' ? 'uma entrada' : 'uma saída'} de ${fmt(n.valor)}`)
    } else if (deOutros.length > 1) avisar(`${deOutros.length} lançamentos novos`)
    else if (fiadosDeOutros.length === 1) {
      const n = fiadosDeOutros[0]
      avisar(`${perfil(n.usuario_id)?.nome || 'Alguém'} anotou um fiado de ${fmt(n.valor)}`)
    } else if (fiadosDeOutros.length > 1) avisar(`${fiadosDeOutros.length} fiados novos`)
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
  S.perfis = cache.p; S.categorias = comCores(cache.c); S.lancs = ordenar(juntarComFila(cache.l, lerFila())); S.recorrentes = cache.rc || []
  S.fiados = cache.f || []; S.temFiados = !!cache.tf
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
  try { await carregarTudo() } catch (e) {
    // sem internet e nada guardado no celular para mostrar: tela "Sem internet" (tenta de novo sozinha)
    if (e.rede) { S.fase = 'semrede'; return }
    return tratarErro(e)
  }
  S.fase = 'app'
  marcarUso()
  iniciarSync()
  enviarFila().catch(tratarErro)
  if (acabouDeLogar && !Lock.ativo() && await Lock.disponivel()) S.ofertaFaceId = true
}

// botão "Tentar de novo" da tela Sem internet
export const tentarEntrarDeNovo = () => entrar(true)

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
        usuario_id: lanc.usuario_id, repetir: false, recorrente_id: lanc.recorrente_id || null, fiado: false, nome: '' }
    : { id: null, tipo, centavos: 0, categoria_id: null, data: hoje(), descricao: '',
        forma_pagamento: '', usuario_id: S.perfil.id, repetir, fiado: false, nome: '' }
}
export const fecharLancar = () => { S.lancar = null }

// Formulário no modo fiado: sem argumento anota um novo; com um fiado, edita
export function abrirFiado(fz = null) {
  S.lancar = fz
    ? { id: fz.id, tipo: 'entrada', centavos: Math.round(fz.valor * 100), categoria_id: fz.categoria_id,
        data: fz.data, descricao: fz.descricao, forma_pagamento: '', usuario_id: fz.usuario_id,
        repetir: false, recorrente_id: null, fiado: true, nome: fz.nome, pago: fz.pago || 0 }
    : { id: null, tipo: 'entrada', centavos: 0, categoria_id: categoriaPadraoFiado(categoriasDoTipo('entrada'))?.id ?? null,
        data: hoje(), descricao: '', forma_pagamento: '', usuario_id: S.perfil.id, repetir: false, fiado: true, nome: '' }
}

// Trocar de tela descarta um lançamento em branco (o painel do Início abre outro)
export function irPara(t) {
  const f = S.lancar
  if (f && !f.id && !f.centavos && !f.descricao.trim() && !f.nome?.trim()) S.lancar = null
  S.tela = t
  window.scrollTo({ top: 0 })
}

export async function salvarLanc(f) {
  if (f.fiado) return salvarFiado(f)
  const dados = {
    tipo: f.tipo, valor: f.centavos / 100, categoria_id: f.categoria_id, data: f.data,
    descricao: f.descricao.trim() || null, forma_pagamento: f.forma_pagamento || null, usuario_id: f.usuario_id,
  }
  if (f.id < 0) {
    // ainda esperando internet: corrige só aqui no celular
    gravarFila(lerFila().map(p => (p.id === f.id ? { ...p, ...dados, erro: null } : p)))
    const i = S.lancs.findIndex(l => l.id === f.id)
    if (i >= 0) S.lancs[i] = { ...S.lancs[i], ...dados, erro: null }
    ordenar(S.lancs)
    return { pendente: true }
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
    S.lancs = juntarComFila((await Api.lancamentos()).map(numerico), lerFila())
  } else {
    // lançamento novo: vai com etiqueta; sem internet, fica na fila e vai sozinho depois
    const pend = novoPendente(dados)
    try {
      S.lancs.push(numerico(await Api.criarLancamento({ ...dados, id_cliente: pend.id_cliente })))
    } catch (e) {
      if (!e.rede) throw e
      gravarFila([...lerFila(), pend])
      S.lancs.push(pend)
      ordenar(S.lancs)
      return { pendente: true }
    }
  }
  ordenar(S.lancs)
  guardarCache()
}

export async function excluirLanc(id) {
  if (id < 0) {
    gravarFila(lerFila().filter(p => p.id !== id))
    S.lancs = S.lancs.filter(l => l.id !== id)
    return
  }
  await Api.excluirLancamento(id)
  S.lancs = S.lancs.filter(l => l.id !== id)
  guardarCache()
}

/* ---------- Fila: lançamentos feitos sem internet ---------- */
let enviandoFila = false
// Manda os que esperam, na ordem. Sem internet, para e tenta de novo depois (ao voltar a conexão,
// ao voltar para o app e a cada 30 s). Recusado pelo banco: fica marcado com o erro, para corrigir.
export async function enviarFila() {
  if (enviandoFila || !lerFila().length || S.fase !== 'app') return
  enviandoFila = true
  let enviados = 0, recusados = 0
  try {
    for (const p of lerFila()) {
      if (S.lancar?.id === p.id) continue // sendo corrigido agora
      const { id, pendente, erro, ...dados } = p
      try {
        const real = numerico(await Api.criarLancamento(dados))
        gravarFila(lerFila().filter(x => x.id !== id))
        const i = S.lancs.findIndex(l => l.id === id)
        if (i >= 0) S.lancs[i] = real; else S.lancs.push(real)
        enviados++
      } catch (e) {
        if (e.rede) break
        if (e.auth) throw e
        gravarFila(lerFila().map(x => (x.id === id ? { ...x, erro: e.message } : x)))
        const l = S.lancs.find(l => l.id === id)
        if (l) l.erro = e.message
        recusados++
      }
    }
  } finally {
    enviandoFila = false
    ordenar(S.lancs)
    guardarCache()
  }
  if (enviados) avisar(enviados === 1 ? 'O lançamento feito sem internet foi enviado' : `${enviados} lançamentos feitos sem internet foram enviados`)
  else if (recusados) avisar('Um lançamento feito sem internet não foi aceito. Toque nele para corrigir.', 'erro')
}

/* ---------- Fiados ---------- */
export const SUMIU = 'Esse fiado já foi recebido ou excluído.'
export const MUDOU = 'Esse fiado mudou agora há pouco (outro pagamento ou edição). Confira a lista e tente de novo.'
// Recebido ou excluído em outro celular: tira da lista e traz o que está no banco (a venda, se virou venda)
function fiadoSumiu(id) {
  S.fiados = S.fiados.filter(x => x.id !== id)
  guardarCache()
  carregarTudo().catch(() => {})
  return new Error(SUMIU)
}

async function salvarFiado(f) {
  const dados = { nome: f.nome.trim(), valor: f.centavos / 100, categoria_id: f.categoria_id,
    descricao: f.descricao.trim(), data: f.data, usuario_id: f.usuario_id }
  if (f.id) {
    const r = await Api.editarFiado(f.id, dados)
    if (!r) throw fiadoSumiu(f.id)
    const i = S.fiados.findIndex(x => x.id === f.id)
    if (i >= 0) S.fiados[i] = numerico(r); else S.fiados.push(numerico(r))
  } else {
    S.fiados.push(numerico(await Api.criarFiado(dados)))
  }
  ordenarFiados(S.fiados)
  guardarCache()
}

export async function excluirFiado(id) {
  const r = await Api.excluirFiado(id)
  if (!r?.length) throw fiadoSumiu(id)
  S.fiados = S.fiados.filter(x => x.id !== id)
  guardarCache()
}

// valor = só uma parte (null = tudo o que falta). Devolve a venda criada.
export async function receberFiado(fz, forma, data, valor = null) {
  try {
    const esperado = 'pago' in fz ? { pago: fz.pago, valor: fz.valor } : null
    const lanc = numerico(await Api.receberFiado(fz.id, forma, data, valor, esperado))
    S.lancs.push(lanc)
    ordenar(S.lancs)
    const resto = cent(falta(fz)) - cent(lanc.valor)
    if (resto > 0) {
      // pagou uma parte: o fiado fica, com o que falta
      const x = S.fiados.find(x => x.id === fz.id)
      if (x) x.pago = (cent(x.pago || 0) + cent(lanc.valor)) / 100
    } else S.fiados = S.fiados.filter(x => x.id !== fz.id)
    guardarCache()
    return lanc
  } catch (e) {
    // recebido ou mudado em outro celular (ou a resposta se perdeu e o 2º toque chegou): traz o que está no banco
    if (e.message === SUMIU || e.message === MUDOU) carregarTudo().catch(() => {})
    throw e
  }
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
      S.fiados.forEach(x => { if (x.categoria_id === c.id) x.categoria_id = destino })
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
  // a internet voltou: manda na hora os lançamentos feitos sem ela
  addEventListener('online', () => {
    if (S.fase === 'app') enviarFila().catch(tratarErro)
    else if (S.fase === 'semrede') entrar(true)
  })

  if (!Api.configurado()) { S.erroLogin = 'Falta configurar o banco em src/lib/config.js.'; S.fase = 'login'; return }
  if (!Api.sessao()) { S.fase = 'login'; return }
  if (precisaTravar()) { S.fase = 'trava'; return }
  entrar()
}
