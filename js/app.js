// Caixa · Nosso Projeto 3D — V1
const VERSAO = '2.11.1';

/* ===================== Utilidades ===================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function fmt(v) { return BRL.format(v || 0); }
function fmtCurto(v) {
  const a = Math.abs(v || 0);
  if (a >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'mi';
  if (a >= 1e4) return 'R$ ' + (v / 1e3).toFixed(1).replace('.', ',') + 'k';
  return BRL.format(v || 0).replace(/,00$/, '');
}
function pct(v) { return v == null || !isFinite(v) ? '—' : Math.round(v * 100) + '%'; }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function deISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function hoje() { return iso(new Date()); }
function ontem() { const d = new Date(); d.setDate(d.getDate() - 1); return iso(d); }
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function dataBonita(s) {
  if (s === hoje()) return 'Hoje';
  if (s === ontem()) return 'Ontem';
  const d = deISO(s);
  const ano = d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : '';
  return `${d.getDate()} de ${MESES_LONGO[d.getMonth()]}${ano}`;
}
function soma(lista) { return lista.reduce((a, l) => a + l.valor, 0); }

const PAGAMENTOS = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Boleto', 'Transferência'];
const NATUREZAS = {
  entrada: [
    ['venda', 'Venda', 'Dinheiro que entrou vendendo peças ou serviços.'],
    ['aporte', 'Dinheiro colocado', 'Dinheiro que vocês ou um investidor colocaram na empresa.'],
    ['outra', 'Outra entrada', 'Reembolsos, ajustes, saldo inicial.']
  ],
  saida: [
    ['variavel', 'Gasto de produção', 'Aumenta quanto mais vocês vendem: filamento, embalagem, frete, taxas.'],
    ['fixa', 'Conta fixa', 'Existe mesmo se não venderem nada: assinaturas, anúncios, manutenção.'],
    ['investimento', 'Equipamento', 'Compra que dura anos: impressoras, ferramentas.']
  ]
};
const nomeNatureza = n => [...NATUREZAS.entrada, ...NATUREZAS.saida].find(x => x[0] === n)?.[1] || n;

/* ===================== Estado ===================== */
const S = {
  perfis: [], categorias: [], lancs: [], perfil: null,
  tela: 'inicio', carregadoEm: 0, offline: false,
  hist: { busca: '', tipo: 'todos', limite: 60 },
  filtros: { periodo: 'mes', usuario: 'todos', tipo: 'todos', categoria: 'todas', de: '', ate: '' },
  form: null,
  recorrentes: [], geradoEm: 0,
  ia: null // { chave, estado: 'carregando' | 'ok' | 'erro', analise, erro, em }
};
const cat = id => S.categorias.find(c => c.id === id);
const perfil = id => S.perfis.find(p => p.id === id);
function corCategoria(id) {
  const i = S.categorias.findIndex(c => c.id === id);
  return Charts.cor(i < 0 ? 0 : i);
}

/* ===================== Toast ===================== */
let toastT;
function toast(msg, erro = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('erro', erro);
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), erro ? 4200 : 2600);
}

/* ===================== Área visível da tela ===================== */
// O popup fica no centro do que dá para ver: quando o teclado sobe, ele sobe junto e encolhe.
function ajustarAreaVisivel() {
  const v = window.visualViewport; if (!v) return;
  const r = document.documentElement.style;
  r.setProperty('--vv-h', v.height + 'px');
  r.setProperty('--vv-top', v.offsetTop + 'px');
}
window.visualViewport?.addEventListener('resize', ajustarAreaVisivel);
window.visualViewport?.addEventListener('scroll', ajustarAreaVisivel);
ajustarAreaVisivel();

/* ===================== Confirmação ===================== */
// Diálogo próprio no lugar do confirm() do navegador: no app instalado no
// iPhone, o confirm() nativo pode derrubar a requisição que vem logo depois.
function confirmar(texto, { ok = 'Excluir', perigo = true } = {}) {
  return new Promise(resolve => {
    const d = document.createElement('div');
    d.className = 'dialogo';
    d.innerHTML = `<div class="dialogo-caixa" role="alertdialog" aria-modal="true">
      <p>${esc(texto)}</p>
      <div class="dialogo-acoes">
        <button class="btn link" data-r="0">Cancelar</button>
        <button class="btn ${perigo ? 'perigo' : ''}" data-r="1">${esc(ok)}</button>
      </div></div>`;
    const fim = r => { d.classList.remove('on'); setTimeout(() => d.remove(), 180); resolve(r); };
    d.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if (b) fim(b.dataset.r === '1'); else if (e.target === d) fim(false);
    });
    document.body.appendChild(d);
    requestAnimationFrame(() => d.classList.add('on'));
  });
}

/* ===================== Porta (login, trava) ===================== */
// Logo NP desenhada em SVG, com barras subindo no canto (tema financeiro).
function logoMarca() {
  const tracos = 'M24.5 119.2H11.8V5.2H106.2V31M68.6 121.2H32.5V29L68.6 71.2M68.6 29V124M53 29H84.5A21.1 21.1 0 0 1 84.5 71.2H68.6';
  return `
    <svg class="logo" viewBox="0 0 118 128" aria-label="Nosso Projeto 3D">
      <defs>
        <linearGradient id="ouro-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#E7C873"/><stop offset=".5" stop-color="#C9A227"/><stop offset="1" stop-color="#8A6F1F"/>
        </linearGradient>
      </defs>
      <path class="logo-traco" d="${tracos}" pathLength="1"/>
      <path class="logo-friso" d="${tracos}"/>
      <g class="logo-barras">
        <rect x="78" y="106" width="6" height="15.2"/>
        <rect x="89" y="95" width="6" height="26.2"/>
        <rect x="100" y="82" width="6" height="39.2"/>
      </g>
    </svg>`;
}

function mostrarPorta(html) {
  $('#shell').hidden = true;
  const p = $('#porta');
  p.hidden = false;
  p.innerHTML = html;
}

// Topo da porta: gráfico subindo ao fundo, logo e nome.
function portaTopo() {
  return `
    <div class="porta-fundo" aria-hidden="true">
      <svg viewBox="0 0 400 300" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ouro-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#C9A227" stop-opacity=".16"/><stop offset="1" stop-color="#C9A227" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path class="grade" d="M0 75H400M0 150H400M0 225H400" vector-effect="non-scaling-stroke"/>
        <path class="area" d="M0 262C50 256 80 236 120 240S190 196 235 204S320 140 400 96V300H0Z"/>
        <path class="linha" d="M0 262C50 256 80 236 120 240S190 196 235 204S320 140 400 96" pathLength="1" vector-effect="non-scaling-stroke"/>
      </svg>
    </div>
    <header class="porta-topo">
      ${logoMarca()}
      <h1>Financeiro</h1>
      <span class="marca">Nosso Projeto 3D</span>
    </header>`;
}

const ICONE_CADEADO = '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></svg>';
const ICONE_OLHO = '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICONE_OLHO_FECHADO = '<svg viewBox="0 0 24 24"><path d="M4 4l16 16M10 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.2 7.4C3.9 9.1 2.5 12 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
const ICONE_SETA = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ICONE_FACEID = '<svg viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 16c1.5 1 3.5 1 5 0"/></svg>';

function telaConfigFaltando() {
  mostrarPorta(`
    ${portaTopo()}
    <div class="porta-painel">
      <div class="aviso-config">
        Falta conectar o banco. Abra <code>js/config.js</code> e preencha
        <code>SUPABASE_URL</code>, <code>SUPABASE_KEY</code> e os e-mails dos usuários.
        O passo a passo está no <code>README.md</code>.
      </div>
    </div>`);
}

function telaLogin(msg = '') {
  const us = window.CAIXA_CONFIG.USUARIOS || [];
  const ultimo = localStorage.getItem('caixa_email') || us[0]?.email || '';
  const sel = Math.max(0, us.findIndex(u => u.email === ultimo));
  mostrarPorta(`
    ${portaTopo()}
    <form class="porta-painel" id="form-login" autocomplete="on">
      <div class="quem" style="--n:${us.length || 1};--i:${sel}">
        ${us.map((u, i) => `
          <button type="button" data-email="${esc(u.email)}" data-i="${i}" class="${i === sel ? 'ativo' : ''}">
            <span class="avatar" style="background:${i === 0 ? '#C9A227' : '#8FB5C9'}">${esc(u.nome[0])}</span>
            ${esc(u.nome)}
          </button>`).join('')}
      </div>
      <input class="oculto" type="email" name="username" id="login-email" autocomplete="username" value="${esc(us[sel]?.email || '')}" tabindex="-1">
      <div class="campo-senha">
        ${ICONE_CADEADO}
        <input class="campo" type="password" id="login-senha" name="password" autocomplete="current-password" placeholder="Senha" required>
        <button type="button" class="olho" id="login-olho" aria-label="Mostrar senha">${ICONE_OLHO}</button>
      </div>
      <p class="erro" id="login-erro">${esc(msg)}</p>
      <button class="btn" type="submit" id="login-btn">Entrar ${ICONE_SETA}</button>
    </form>`);

  $$('.quem button').forEach(b => b.addEventListener('click', () => {
    $$('.quem button').forEach(x => x.classList.toggle('ativo', x === b));
    $('.quem').style.setProperty('--i', b.dataset.i);
    $('#login-email').value = b.dataset.email;
    $('#login-senha').focus();
  }));
  $('#login-olho').addEventListener('click', () => {
    const campo = $('#login-senha'), mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';
    $('#login-olho').innerHTML = mostrar ? ICONE_OLHO_FECHADO : ICONE_OLHO;
    $('#login-olho').setAttribute('aria-label', mostrar ? 'Esconder senha' : 'Mostrar senha');
  });
  $('#form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#login-email').value, senha = $('#login-senha').value;
    if (!email) return ($('#login-erro').textContent = 'Escolha quem está entrando.');
    const btn = $('#login-btn');
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      await Api.login(email, senha);
      localStorage.setItem('caixa_email', email);
      const u = us.find(x => x.email === email);
      if (u) localStorage.setItem('caixa_nome', u.nome);
      await entrarNoApp(true);
    } catch (err) {
      $('#login-erro').textContent = err.message;
      btn.disabled = false; btn.innerHTML = `Entrar ${ICONE_SETA}`;
    }
  });
}

function telaBloqueio() {
  const nome = localStorage.getItem('caixa_nome') || '';
  mostrarPorta(`
    ${portaTopo()}
    <div class="porta-painel">
      <button class="faceid" id="btn-desbloquear" aria-label="Desbloquear com Face ID">${ICONE_FACEID}</button>
      <p class="faceid-rotulo">${nome ? `Olá, ${esc(nome)}. ` : ''}Toque para desbloquear</p>
      <button class="btn link" id="btn-senha">Entrar com senha</button>
      <p class="erro" id="bloq-erro" style="text-align:center"></p>
    </div>`);
  const tentar = async (auto = false) => {
    try { await Lock.verificar(); await entrarNoApp(); }
    catch (_) { if (!auto) $('#bloq-erro').textContent = 'Não foi possível confirmar. Toque para tentar de novo.'; }
  };
  $('#btn-desbloquear').addEventListener('click', () => tentar());
  $('#btn-senha').addEventListener('click', async () => { await Api.sair(); Lock.desativar(); telaLogin(); });
  tentar(true);
}

/* ===================== Dados ===================== */
async function carregarTudo() {
  try {
    await gerarRecorrentes(true);
    const [p, c, l, rc] = await Promise.all([Api.perfis(), Api.categorias(), Api.lancamentos(), buscarRecorrentes()]);
    S.perfis = p; S.categorias = c; S.recorrentes = rc;
    S.lancs = l.map(x => ({ ...x, valor: Number(x.valor) }));
    S.offline = false;
    S.carregadoEm = Date.now();
    try { localStorage.setItem('caixa_cache', JSON.stringify({ p, c, l: S.lancs, rc })); } catch (_) {}
  } catch (e) {
    if (e.auth) throw e;
    const cache = JSON.parse(localStorage.getItem('caixa_cache') || 'null');
    if (!cache) throw e;
    S.perfis = cache.p; S.categorias = cache.c; S.lancs = cache.l; S.recorrentes = cache.rc || [];
    S.offline = true;
    toast('Sem conexão. Mostrando os últimos dados salvos.', true);
  }
  S.perfil = perfil(Api.sessao().user.id) || null;
  if (!S.perfil) {
    const e = new Error('Seu usuário ainda não tem perfil no banco. Rode o passo 2 do setup.sql.');
    e.auth = true; throw e;
  }
}

/* ===================== Recorrentes (V2) ===================== */
// Pede ao banco para lançar o que já venceu. Se a V2 do banco ainda não foi
// instalada (v2.sql), segue sem recorrentes, sem travar o app.
async function gerarRecorrentes(forcar = false) {
  if (!forcar && Date.now() - S.geradoEm < 3600e3) return 0;
  try { const n = await Api.gerarRecorrentes(); S.geradoEm = Date.now(); return n || 0; }
  catch (e) { if (e.auth) throw e; return 0; }
}
async function buscarRecorrentes() {
  try { return (await Api.recorrentes()).map(r => ({ ...r, valor: Number(r.valor) })); }
  catch (e) { if (e.auth) throw e; return []; }
}

/* ===================== Sincronização automática ===================== */
// Enquanto o app está aberto, confere a cada 30 s se a outra pessoa lançou algo.
const INTERVALO_SYNC = 30000;
let syncT = null, sincronizando = false;

function assinatura(lancs, cats) {
  const ult = lancs.reduce((m, l) => (String(l.atualizado_em || '') > m ? String(l.atualizado_em || '') : m), '');
  const maxId = lancs.reduce((m, l) => Math.max(m, l.id), 0);
  return `${lancs.length}|${maxId}|${ult}|${cats.map(c => `${c.id}:${c.nome}:${c.natureza}:${c.ordem}`).join(',')}`;
}

function iniciarSync() {
  clearInterval(syncT);
  syncT = setInterval(sincronizar, INTERVALO_SYNC);
}

async function sincronizar() {
  // Não atualiza no meio de um lançamento ou edição, nem com o app em segundo plano
  if (sincronizando || S.arrastando || document.hidden || $('#shell').hidden || S.form || !$('#sheet').hidden) return;
  sincronizando = true;
  try {
    await gerarRecorrentes();
    const [c, l, rc] = await Promise.all([Api.categorias(), Api.lancamentos(), buscarRecorrentes()]);
    S.recorrentes = rc;
    const novosLancs = l.map(x => ({ ...x, valor: Number(x.valor) }));
    novosLancs.sort((x, y) => (y.data > x.data ? 1 : y.data < x.data ? -1 : y.id - x.id));
    S.offline = false;
    S.carregadoEm = Date.now();
    if (assinatura(novosLancs, c) === assinatura(S.lancs, S.categorias)) return;
    if (S.form || S.arrastando || !$('#sheet').hidden) return; // abriu um formulário ou está arrastando

    const antes = new Set(S.lancs.map(x => x.id));
    const deOutros = novosLancs.filter(x => !antes.has(x.id) && x.usuario_id !== S.perfil.id);
    S.lancs = novosLancs; S.categorias = c;
    try { localStorage.setItem('caixa_cache', JSON.stringify({ p: S.perfis, c, l: novosLancs })); } catch (_) {}

    if (S.tela === 'historico' && $('#h-res')) $('#h-res').innerHTML = histResultados();
    else render();

    if (deOutros.length === 1) {
      const n = deOutros[0];
      toast(`${perfil(n.usuario_id)?.nome || 'Alguém'} lançou ${n.tipo === 'entrada' ? 'uma entrada' : 'uma saída'} de ${fmt(n.valor)}`);
    } else if (deOutros.length > 1) {
      toast(`${deOutros.length} lançamentos novos`);
    }
  } catch (e) {
    if (e.auth) tratarErro(e); // sem internet: tenta de novo no próximo ciclo, sem avisar
  } finally {
    sincronizando = false;
  }
}

async function tratarErro(e) {
  if (e.auth) { await Api.sair(); telaLogin(e.message); }
  else toast(e.message, true);
}

async function entrarNoApp(acabouDeLogar = false) {
  mostrarPorta('<div class="carregando"><div class="giro"></div></div>');
  try { await carregarTudo(); }
  catch (e) { return tratarErro(e); }
  $('#porta').hidden = true;
  $('#shell').hidden = false;
  render();
  iniciarSync();
  if (acabouDeLogar && !Lock.ativo() && await Lock.disponivel()) oferecerFaceId();
}

/* ===================== Navegação ===================== */
function irPara(tela) {
  S.tela = tela;
  $$('.nav button').forEach(b => b.classList.toggle('ativo', b.dataset.tela === tela));
  render();
  window.scrollTo(0, 0);
  // Entrada suave só ao trocar de aba (a sincronização a cada 30 s não anima)
  const m = $('#main');
  m.classList.remove('entrando'); void m.offsetWidth; m.classList.add('entrando');
}

function render() {
  const telas = { inicio: telaInicio, historico: telaHistorico, gestao: telaGestao, ajustes: telaAjustes };
  $('#main').innerHTML = telas[S.tela]();
  if (S.tela === 'ajustes') $$('.lista-ordem').forEach(ativarArraste);
}

/* ===================== Ordem das categorias (arrastar) ===================== */
// Segura a alça e arrasta. Durante o arraste só mexe com transform (não tira a linha
// do lugar, senão o iPhone cancela o toque); a ordem muda de verdade ao soltar.
// Perto da borda da tela, a página rola sozinha.
function ativarArraste(bloco) {
  $$('.alca', bloco).forEach(alca => alca.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { alca.setPointerCapture(e.pointerId); } catch (_) {}
    const linha = alca.closest('.cat-linha');
    const linhas = [...bloco.children];
    const de = linhas.indexOf(linha);
    const alturas = linhas.map(x => x.offsetHeight);
    const antes = linhas.map(x => x.dataset.id).join();
    const y0 = e.clientY + scrollY;
    let yDedo = e.clientY, para = de, rolando = null;
    S.arrastando = true;
    linha.classList.add('arrastando');
    linhas.forEach(x => { if (x !== linha) x.style.transition = 'transform .18s'; });

    const atualizar = () => {
      const dy = yDedo + scrollY - y0;
      linha.style.transform = `translateY(${dy}px)`;
      // nova posição: quantas linhas o centro da arrastada já passou
      let pos = de, acum = 0;
      if (dy > 0) for (let k = de + 1; k < linhas.length && dy > acum + alturas[k] / 2; k++) { acum += alturas[k]; pos = k; }
      else for (let k = de - 1; k >= 0 && -dy > acum + alturas[k] / 2; k--) { acum += alturas[k]; pos = k; }
      para = pos;
      const h = alturas[de];
      linhas.forEach((x, k) => {
        if (x === linha) return;
        const desloca = de < para && k > de && k <= para ? -h : de > para && k < de && k >= para ? h : 0;
        x.style.transform = desloca ? `translateY(${desloca}px)` : '';
      });
    };
    const rolar = () => {
      const borda = 90, alto = innerHeight;
      const v = yDedo < borda ? -(borda - yDedo) / 6 : yDedo > alto - borda ? (yDedo - (alto - borda)) / 6 : 0;
      if (v) { scrollBy(0, v); atualizar(); }
      rolando = requestAnimationFrame(rolar);
    };
    const mover = ev => { yDedo = ev.clientY; atualizar(); };
    const soltar = () => {
      cancelAnimationFrame(rolando);
      alca.removeEventListener('pointermove', mover);
      alca.removeEventListener('pointerup', soltar);
      alca.removeEventListener('pointercancel', soltar);
      linhas.forEach(x => { x.style.transition = ''; x.style.transform = ''; });
      linha.classList.remove('arrastando');
      if (para !== de) {
        const alvo = linhas[para];
        if (para > de) alvo.after(linha); else alvo.before(linha);
      }
      S.arrastando = false;
      const ids = [...bloco.children].map(x => Number(x.dataset.id));
      if (ids.join() !== antes) salvarOrdem(ids);
    };
    alca.addEventListener('pointermove', mover);
    alca.addEventListener('pointerup', soltar);
    alca.addEventListener('pointercancel', soltar);
    rolando = requestAnimationFrame(rolar);
  }));
}

async function salvarOrdem(ids) {
  const mudou = ids.map((id, i) => ({ c: cat(id), ordem: i + 1 })).filter(x => x.c && x.c.ordem !== x.ordem);
  mudou.forEach(x => { x.c.ordem = x.ordem; });
  try {
    await Promise.all(mudou.map(x => Api.editarCategoria(x.c.id, { ordem: x.ordem })));
    toast('Ordem salva');
  } catch (e) { tratarErro(e); carregarTudo().then(render).catch(() => {}); }
}

/* ===================== Início ===================== */
function itemLanc(l, mostrarData = false) {
  const c = cat(l.categoria_id), u = perfil(l.usuario_id);
  const sub = [mostrarData ? dataBonita(l.data) : null, u?.nome, l.forma_pagamento].filter(Boolean).join(' · ');
  return `
    <button class="item" data-acao="editar" data-id="${l.id}">
      <span class="ponto" style="background:${corCategoria(l.categoria_id)}"></span>
      <span class="meio">
        <span class="titulo">${esc(l.descricao || c?.nome || 'Sem categoria')}</span>
        <span class="sub">${esc(l.descricao ? (c?.nome || '') + (sub ? ' · ' + sub : '') : sub)}</span>
      </span>
      <span class="v ${l.tipo === 'entrada' ? 'e' : 's'}">${l.tipo === 'entrada' ? '+' : '−'} ${esc(fmt(l.valor))}</span>
    </button>`;
}

function itemCompacto(l) {
  const c = cat(l.categoria_id);
  return `
    <button class="item compacto" data-acao="editar" data-id="${l.id}">
      <span class="meio">
        <span class="titulo">${esc(l.descricao || c?.nome || 'Sem categoria')}</span>
        <span class="sub">${esc(dataBonita(l.data))}</span>
      </span>
      <span class="v ${l.tipo === 'entrada' ? 'e' : 's'}">${l.tipo === 'entrada' ? '+' : '−'} ${esc(fmt(l.valor))}</span>
    </button>`;
}

// Linha do saldo nos últimos 60 dias, apagada ao fundo do cartão do saldo.
// Sem movimento suficiente, não desenha nada (não inventa tendência).
function linhaSaldo() {
  const dias = 60, fim = new Date(), ini = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() - dias);
  const inicio = iso(ini);
  let saldo = 0;
  const porDia = {};
  for (const l of S.lancs) {
    const v = l.tipo === 'entrada' ? l.valor : -l.valor;
    if (l.data < inicio) saldo += v;
    else porDia[l.data] = (porDia[l.data] || 0) + v;
  }
  if (Object.keys(porDia).length < 2) return '';
  const pts = [];
  for (let i = 0; i <= dias; i++) {
    const d = iso(new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i));
    saldo += porDia[d] || 0;
    pts.push(saldo);
  }
  const min = Math.min(...pts), max = Math.max(...pts);
  if (max === min) return '';
  // Um ponto a cada 4 dias e curva suave, para não virar degraus
  const P = pts.filter((_, i) => i % 4 === 0 || i === dias)
    .map((v, i, a) => [i / (a.length - 1) * 300, 90 - (v - min) / (max - min) * 64]);
  const f = n => n.toFixed(1);
  let linha = `M${f(P[0][0])} ${f(P[0][1])}`;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i - 1] || P[i], b = P[i], c = P[i + 1], d = P[i + 2] || c;
    linha += `C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (d[0] - b[0]) / 6)} ${f(c[1] - (d[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`;
  }
  return `
    <svg class="hero-linha" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#C9A227" stop-opacity=".18"/><stop offset="1" stop-color="#C9A227" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${linha}L300 100L0 100Z" fill="url(#hero-area)"/>
      <path d="${linha}" class="traco" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

function telaInicio() {
  const agora = new Date();
  const ini = iso(new Date(agora.getFullYear(), agora.getMonth(), 1));
  const doMes = S.lancs.filter(l => l.data >= ini && l.data <= hoje());
  const ent = soma(doMes.filter(l => l.tipo === 'entrada'));
  const sai = soma(doMes.filter(l => l.tipo === 'saida'));
  const caixa = soma(S.lancs.filter(l => l.tipo === 'entrada')) - soma(S.lancs.filter(l => l.tipo === 'saida'));
  const ultimos = S.lancs.slice(0, 4);
  const mes = MESES_LONGO[agora.getMonth()];

  return `
    <div class="topo-home">
      <span>Olá, ${esc(S.perfil.nome)}</span>
      <span class="avatar mini" style="background:${esc(S.perfil.cor)}">${esc(S.perfil.nome[0])}</span>
    </div>

    <div class="caixa-hero">
      ${linhaSaldo()}
      <span class="rotulo">Saldo em caixa${S.offline ? ' (offline)' : ''}</span>
      <strong class="valor ${caixa < 0 ? 'neg' : ''}">${esc(fmt(caixa))}</strong>
      <span class="mes-resumo">${mes[0].toUpperCase() + mes.slice(1)}<span class="e">+${esc(fmt(ent))}</span><span class="s">−${esc(fmt(sai))}</span></span>
    </div>

    <div class="acoes">
      <button class="acao entrada" data-acao="novo" data-tipo="entrada">
        <span class="acao-icone"><svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg></span>Entrada
      </button>
      <button class="acao saida" data-acao="novo" data-tipo="saida">
        <span class="acao-icone"><svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg></span>Saída
      </button>
    </div>

    <section class="recentes">
      <div class="recentes-topo"><span>Recentes</span>${ultimos.length ? '<button data-tela-ir="historico">Ver todos</button>' : ''}</div>
      ${ultimos.length
        ? `<div class="lista bloco-lista">${ultimos.map(itemCompacto).join('')}</div>`
        : `<p class="vazio-simples">Nenhum lançamento ainda. Se já existe dinheiro em conta, comece com uma entrada em “Saldo inicial / ajuste”.</p>`}
    </section>`;
}

/* ===================== Formulário de lançamento ===================== */
let sheetT;
function abrirSheet(html) {
  clearTimeout(sheetT);
  const sh = $('#sheet'), fundo = $('#sheet-fundo');
  sh.classList.remove('modo-cat');
  sh.innerHTML = `<div class="puxador"></div>${html}`;
  sh.hidden = false; fundo.hidden = false;
  sh.scrollTop = 0;
  requestAnimationFrame(() => { sh.classList.add('aberto'); fundo.classList.add('aberto'); });
}
function fecharSheet() {
  const sh = $('#sheet'), fundo = $('#sheet-fundo');
  sh.classList.remove('aberto', 'modo-cat'); fundo.classList.remove('aberto');
  sheetT = setTimeout(() => { sh.hidden = true; fundo.hidden = true; sh.innerHTML = ''; }, 260);
  S.form = null;
}

// Ordem manual (coluna "ordem", do v2-ordem.sql). Sem ela no banco, as mais usadas primeiro.
const temOrdem = () => S.categorias.some(c => 'ordem' in c);
const porOrdem = (a, b) => (a.ordem ?? 1e9) - (b.ordem ?? 1e9) || a.nome.localeCompare(b.nome);
const proximaOrdem = tipo => temOrdem()
  ? { ordem: Math.max(0, ...S.categorias.filter(c => c.tipo === tipo).map(c => c.ordem || 0)) + 1 } : {};

function categoriasOrdenadas(tipo) {
  const lista = S.categorias.filter(c => c.tipo === tipo);
  if (temOrdem()) return lista.sort(porOrdem);
  const uso = {};
  S.lancs.forEach(l => { uso[l.categoria_id] = (uso[l.categoria_id] || 0) + 1; });
  return lista.sort((a, b) => (uso[b.id] || 0) - (uso[a.id] || 0) || a.nome.localeCompare(b.nome));
}

function abrirForm(tipo, lanc = null, opcoes = {}) {
  S.form = lanc
    ? { id: lanc.id, tipo: lanc.tipo, centavos: Math.round(lanc.valor * 100), categoria_id: lanc.categoria_id,
        data: lanc.data, descricao: lanc.descricao || '', forma_pagamento: lanc.forma_pagamento || '',
        usuario_id: lanc.usuario_id, novaCat: null, recorrente_id: lanc.recorrente_id || null }
    : { id: null, tipo, centavos: 0, categoria_id: null, data: hoje(), descricao: '',
        forma_pagamento: '', usuario_id: S.perfil.id, novaCat: null, repetir: !!opcoes.repetir };
  const f = S.form;
  const titulo = f.id ? 'Editar lançamento' : f.tipo === 'entrada' ? 'Nova entrada' : 'Nova saída';

  abrirSheet(`
    <div class="form-corpo">
    <div class="sheet-topo">
      <div><span class="tipo-tag ${f.tipo}">${f.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span><h2>${titulo}</h2></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button>
    </div>
    <input id="f-valor" class="valor-input ${f.tipo}" inputmode="numeric" placeholder="R$ 0,00"
      value="${f.centavos ? esc(fmt(f.centavos / 100)) : ''}" aria-label="Valor">

    <div class="grupo"><span class="rot">Categoria</span><div id="f-cats"></div></div>

    <div class="grupo">
      <label for="f-desc">Descrição</label>
      <input id="f-desc" class="campo" maxlength="120" value="${esc(f.descricao)}"
        placeholder="${f.tipo === 'entrada' ? 'Ex.: pedido Shopee #1234' : 'Ex.: 3 rolos PLA preto'}">
    </div>

    <details class="mais" ${f.repetir || f.data !== hoje() || (f.id && (f.forma_pagamento || f.usuario_id !== S.perfil.id)) ? 'open' : ''}>
    <summary>Mais detalhes</summary>
    <div class="grupo">
      <span class="rot">Data</span>
      <div class="linha-data">
        <button class="chip ${f.data === hoje() ? 'ativo' : ''}" data-acao="f-data" data-v="${hoje()}">Hoje</button>
        <button class="chip ${f.data === ontem() ? 'ativo' : ''}" data-acao="f-data" data-v="${ontem()}">Ontem</button>
        <input id="f-data" type="date" class="campo ${f.data !== hoje() && f.data !== ontem() ? 'on' : ''}" value="${f.data}" max="${hoje()}" aria-label="Outra data">
      </div>
    </div>

    ${f.id ? '' : `<div class="grupo">
      <button class="linha-toggle" data-acao="f-repetir" aria-pressed="${f.repetir}">
        <span>Repetir todo mês<small id="f-rep-txt">${esc(textoRepetir(f))}</small></span>
        <span class="toggle ${f.repetir ? 'on' : ''}"></span>
      </button>
    </div>`}

    <div class="grupo">
      <span class="rot">Forma de pagamento</span>
      <div class="chips" data-grupo="pag">
        ${PAGAMENTOS.map(p => `<button class="chip ${f.forma_pagamento === p ? 'ativo' : ''}" data-acao="f-pag" data-v="${esc(p)}">${esc(p)}</button>`).join('')}
      </div>
    </div>

    <div class="grupo">
      <span class="rot">Quem fez</span>
      <div class="chips" data-grupo="user">
        ${S.perfis.map(p => `<button class="chip ${f.usuario_id === p.id ? 'ativo' : ''}" data-acao="f-user" data-id="${p.id}">${esc(p.nome)}</button>`).join('')}
      </div>
    </div>
    </details>

    ${f.id ? (f.recorrente_id && S.recorrentes.some(r => r.id === f.recorrente_id)
      ? `<p class="nota-rec">Esse lançamento se repete todo mês. Para mudar o valor dos próximos ou pausar, vá em Ajustes › Lançamentos que se repetem.</p>` : '')
    : ''}

    <div class="acoes-form">
      <button class="btn ${f.tipo}" data-acao="salvar" id="f-salvar">${f.id ? 'Salvar alterações' : f.repetir ? 'Criar lançamento mensal' : f.tipo === 'entrada' ? 'Lançar entrada' : 'Lançar saída'}</button>
      ${f.id ? '<button class="btn perigo" data-acao="excluir">Excluir lançamento</button>' : ''}
    </div>
    </div>
    <div id="f-cat-painel" class="painel-cat"></div>`);

  renderCatsForm();
  // Ao abrir "Mais detalhes", rola até os campos (senão ficam escondidos embaixo)
  $('.mais').addEventListener('toggle', e => {
    if (!e.target.open) return;
    const sh = $('#sheet'), alvo = e.target;
    setTimeout(() => sh.scrollTo({ top: alvo.offsetTop - 16, behavior: 'smooth' }), 30);
  });
  const inp = $('#f-valor');
  inp.addEventListener('input', () => {
    const dig = inp.value.replace(/\D/g, '').slice(0, 11);
    f.centavos = parseInt(dig || '0', 10);
    inp.value = f.centavos ? fmt(f.centavos / 100) : '';
  });
  $('#f-desc').addEventListener('input', e => { f.descricao = e.target.value; });
  $('#f-data').addEventListener('change', e => {
    f.data = e.target.value || hoje();
    if ($('#f-rep-txt')) $('#f-rep-txt').textContent = textoRepetir(f);
    $$('[data-acao="f-data"]').forEach(b => b.classList.toggle('ativo', b.dataset.v === f.data));
    e.target.classList.toggle('on', f.data !== hoje() && f.data !== ontem());
  });
  if (!f.id) setTimeout(() => inp.focus(), 280);
}

function textoRepetir(f) {
  return f.repetir ? `Lança sozinho todo dia ${deISO(f.data).getDate()}` : 'Para assinaturas e contas do mês';
}

function renderCatsForm() {
  const f = S.form; if (!f) return;
  const c = cat(f.categoria_id);
  $('#f-cats').innerHTML = `
    <button class="seletor-cat ${c ? '' : 'vazio'}" data-acao="f-cat-abrir">
      ${c ? `<span class="ponto" style="background:${corCategoria(c.id)}"></span>` : ''}
      <span class="meio"><b>${esc(c ? c.nome : 'Escolher categoria')}</b>${c ? `<small>${esc(nomeNatureza(c.natureza))}</small>` : ''}</span>
      <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
    </button>`;
  renderPainelCats();
}

// Lista de categorias que ocupa o painel no lugar do formulário
function renderPainelCats() {
  const f = S.form, painel = $('#f-cat-painel'); if (!f || !painel) return;
  const lista = categoriasOrdenadas(f.tipo);
  const nat = NATUREZAS[f.tipo];
  painel.innerHTML = `
    <div class="sheet-topo">
      <button class="voltar" data-acao="f-cat-fechar" aria-label="Voltar"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
      <h2>Categoria</h2>
      <span style="width:34px"></span>
    </div>
    ${lista.length > 7 ? `<div class="busca"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg>
      <input class="campo" id="fc-busca" type="search" placeholder="Buscar categoria"></div>` : ''}
    <div class="bloco-lista lista-cat">
      ${lista.map(c => `
        <button class="item ${f.categoria_id === c.id ? 'escolhida' : ''}" data-acao="f-cat" data-id="${c.id}" data-nome="${esc(c.nome.toLowerCase())}">
          <span class="ponto" style="background:${corCategoria(c.id)}"></span>
          <span class="meio"><span class="titulo">${esc(c.nome)}</span><span class="sub">${esc(nomeNatureza(c.natureza))}</span></span>
          ${f.categoria_id === c.id ? '<svg class="check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}
        </button>`).join('')}
    </div>
    ${f.novaCat ? `
      <div class="nova-cat">
        <input id="nc-nome" class="campo" maxlength="40" placeholder="Nome da categoria" value="${esc(f.novaCat.nome)}">
        <span class="rot-nc">Conta como</span>
        <div class="chips" data-grupo="nat">
          ${nat.map(n => `<button class="chip ${f.novaCat.natureza === n[0] ? 'ativo' : ''}" data-acao="nc-nat" data-v="${n[0]}">${n[1]}</button>`).join('')}
        </div>
        <p class="dica-nat">${esc(nat.find(n => n[0] === f.novaCat.natureza)[2])}</p>
        <button class="btn" data-acao="nc-criar">Criar e usar</button>
      </div>` : `<button class="btn link nova-cat-btn" data-acao="f-nova-cat">+ Nova categoria</button>`}`;
  $('#fc-busca')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    $$('.lista-cat .item').forEach(b => { b.hidden = !!q && !b.dataset.nome.includes(q); });
  });
  if (f.novaCat) {
    const i = $('#nc-nome');
    i.addEventListener('input', e => { f.novaCat.nome = e.target.value; });
    i.focus();
  }
}

function abrirPainelCat(abrir) {
  const sh = $('#sheet');
  sh.classList.toggle('modo-cat', abrir);
  sh.scrollTop = 0;
  if (!abrir && S.form) { S.form.novaCat = null; renderCatsForm(); }
}

async function criarCategoriaForm() {
  const f = S.form, nome = (f.novaCat.nome || '').trim();
  if (!nome) return toast('Dê um nome para a categoria.', true);
  const existe = S.categorias.find(c => c.tipo === f.tipo && c.nome.toLowerCase() === nome.toLowerCase());
  if (existe) {
    if (!existe.ativa) { const r = await Api.editarCategoria(existe.id, { ativa: true }); Object.assign(existe, r); }
    f.categoria_id = existe.id; f.novaCat = null; abrirPainelCat(false); return;
  }
  try {
    const nova = await Api.criarCategoria({ nome, tipo: f.tipo, natureza: f.novaCat.natureza, ...proximaOrdem(f.tipo) });
    S.categorias.push(nova);
    f.categoria_id = nova.id; f.novaCat = null;
    abrirPainelCat(false);
    toast(`Categoria “${nome}” criada`);
  } catch (e) { tratarErro(e); }
}

async function salvarForm() {
  const f = S.form;
  if (!f.centavos) { toast('Digite o valor.', true); $('#f-valor').focus(); return; }
  if (!f.categoria_id) { toast('Escolha uma categoria.', true); abrirPainelCat(true); return; }
  const dados = {
    tipo: f.tipo, valor: f.centavos / 100, categoria_id: f.categoria_id, data: f.data,
    descricao: f.descricao.trim() || null, forma_pagamento: f.forma_pagamento || null, usuario_id: f.usuario_id
  };
  const btn = $('#f-salvar'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (f.id) {
      const r = await Api.editarLancamento(f.id, dados);
      const i = S.lancs.findIndex(l => l.id === f.id);
      S.lancs[i] = { ...r, valor: Number(r.valor) };
      toast('Alterações salvas');
    } else if (f.repetir) {
      // Cria a regra e deixa o banco lançar este mês (e os anteriores, se a data for antiga)
      const { data, ...resto } = dados;
      const rec = await Api.criarRecorrente({ ...resto, dia_mes: deISO(data).getDate(), inicio: data });
      S.recorrentes.push({ ...rec, valor: Number(rec.valor) });
      await gerarRecorrentes(true);
      S.lancs = (await Api.lancamentos()).map(x => ({ ...x, valor: Number(x.valor) }));
      toast(`${fmt(dados.valor)} todo dia ${deISO(data).getDate()}: criado`);
    } else {
      const r = await Api.criarLancamento(dados);
      S.lancs.push({ ...r, valor: Number(r.valor) });
      toast(`${f.tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${fmt(dados.valor)} lançada`);
    }
    S.lancs.sort((a, b) => (b.data > a.data ? 1 : b.data < a.data ? -1 : b.id - a.id));
    fecharSheet(); render();
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Tentar de novo';
    tratarErro(e);
  }
}

async function excluirForm() {
  const f = S.form;
  if (!await confirmar(`Excluir este lançamento de ${fmt(f.centavos / 100)}? Não dá pra desfazer.`)) return;
  try {
    await Api.excluirLancamento(f.id);
    S.lancs = S.lancs.filter(l => l.id !== f.id);
    fecharSheet(); render(); toast('Lançamento excluído');
  } catch (e) { tratarErro(e); }
}

/* ===================== Histórico ===================== */
function telaHistorico() {
  const h = S.hist;
  return `
    <h1 class="titulo-tela">Histórico</h1>
    <div class="busca">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg>
      <input class="campo" id="h-busca" type="search" placeholder="Buscar" value="${esc(h.busca)}">
    </div>
    <div class="segmento seg-h">
      ${[['todos', 'Tudo'], ['entrada', 'Entradas'], ['saida', 'Saídas']].map(([v, r]) =>
        `<button class="${h.tipo === v ? 'ativo' : ''}" data-acao="h-tipo" data-v="${v}">${r}</button>`).join('')}
    </div>
    <div id="h-res">${histResultados()}</div>`;
}

const SETA_ENT = '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
const SETA_SAI = '<svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
const ICONE_REPETE = '<svg class="rep" viewBox="0 0 24 24" aria-label="Se repete todo mês"><path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4"/></svg>';
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function itemHist(l) {
  const c = cat(l.categoria_id), u = perfil(l.usuario_id);
  const sub = [l.descricao ? c?.nome : null, l.forma_pagamento].filter(Boolean).join(' · ');
  return `
    <button class="item hist" data-acao="editar" data-id="${l.id}">
      <span class="icone-tipo ${l.tipo}">${l.tipo === 'entrada' ? SETA_ENT : SETA_SAI}</span>
      <span class="meio">
        <span class="titulo">${esc(l.descricao || c?.nome || 'Sem categoria')}</span>
        <span class="sub">${u ? `<i class="quem" style="background:${esc(u.cor)}" title="${esc(u.nome)}">${esc(u.nome[0])}</i>` : ''}${l.recorrente_id ? ICONE_REPETE : ''}<span class="sub-txt">${esc(sub)}</span></span>
      </span>
      <span class="v ${l.tipo === 'entrada' ? 'e' : 's'}">${l.tipo === 'entrada' ? '+' : '−'} ${esc(fmt(l.valor))}</span>
    </button>`;
}

// Dentro do mês, o dia aparece curto: "Hoje", "Ontem" ou "Terça, 22"
function diaCurto(s) {
  if (s === hoje()) return 'Hoje';
  if (s === ontem()) return 'Ontem';
  const d = deISO(s);
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()}`;
}

function histResultados() {
  const h = S.hist, q = h.busca.trim().toLowerCase();
  const lista = S.lancs.filter(l => {
    if (h.tipo !== 'todos' && l.tipo !== h.tipo) return false;
    if (!q) return true;
    const alvo = [l.descricao, cat(l.categoria_id)?.nome, perfil(l.usuario_id)?.nome, l.forma_pagamento, fmt(l.valor)].join(' ').toLowerCase();
    return alvo.includes(q);
  });
  const vis = lista.slice(0, h.limite);
  const anoAtual = String(new Date().getFullYear());
  let html = '', diaAtual = null, mesAtual = null;
  vis.forEach(l => {
    const mes = l.data.slice(0, 7);
    if (mes !== mesAtual) {
      if (diaAtual) html += '</div>';
      diaAtual = null; mesAtual = mes;
      const [a, m] = mes.split('-');
      const nome = MESES_LONGO[Number(m) - 1];
      html += `<div class="mes-h">${nome[0].toUpperCase() + nome.slice(1)}${a !== anoAtual ? ` <span>${a}</span>` : ''}</div>`;
    }
    if (l.data !== diaAtual) {
      if (diaAtual) html += '</div>';
      diaAtual = l.data;
      html += `<div class="dia-h">${esc(diaCurto(l.data))}</div><div class="bloco-lista">`;
    }
    html += itemHist(l);
  });
  if (diaAtual) html += '</div>';
  const total = soma(lista.filter(l => l.tipo === 'entrada')) - soma(lista.filter(l => l.tipo === 'saida'));
  const resumo = q
    ? `${lista.length} resultado${lista.length === 1 ? '' : 's'}${lista.length ? ` · ${h.tipo === 'saida' ? '' : total >= 0 ? '+' : '−'}${esc(fmt(Math.abs(total)))}` : ''}`
    : '';

  const vazio = q || S.lancs.length
    ? `<p class="vazio-simples">${q ? 'Nada encontrado. Tente outra palavra.' : 'Nenhum lançamento desse tipo.'}</p>`
    : `<div class="vazio-hist">
        <span class="vazio-icone"><svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h9"/></svg></span>
        <strong>Nenhum lançamento ainda</strong>
        <div class="acoes">
          <button class="acao entrada" data-acao="novo" data-tipo="entrada"><span class="acao-icone">${SETA_ENT}</span>Entrada</button>
          <button class="acao saida" data-acao="novo" data-tipo="saida"><span class="acao-icone">${SETA_SAI}</span>Saída</button>
        </div>
      </div>`;

  return `
    ${resumo ? `<p class="resumo-busca">${resumo}</p>` : ''}
    ${vis.length ? `<div class="lista">${html}</div>` : vazio}
    ${lista.length > vis.length ? `<button class="btn link" data-acao="h-mais" style="width:100%;margin-top:8px">Mostrar mais</button>` : ''}`;
}

/* ===================== Gestão: cálculos ===================== */
function intervalo(f) {
  const h = new Date(), y = h.getFullYear(), m = h.getMonth();
  switch (f.periodo) {
    case 'mes': return { de: iso(new Date(y, m, 1)), ate: hoje() };
    case 'mespassado': return { de: iso(new Date(y, m - 1, 1)), ate: iso(new Date(y, m, 0)) };
    case '3m': return { de: iso(new Date(y, m - 2, 1)), ate: hoje() };
    case '6m': return { de: iso(new Date(y, m - 5, 1)), ate: hoje() };
    case '12m': return { de: iso(new Date(y, m - 11, 1)), ate: hoje() };
    case 'ano': return { de: `${y}-01-01`, ate: hoje() };
    case 'custom': return { de: f.de || '0000-01-01', ate: f.ate || hoje() };
    default: return { de: '0000-01-01', ate: hoje() };
  }
}
function intervaloAnterior(f, { de, ate }) {
  if (de === '0000-01-01') return null;
  const h = new Date(), y = h.getFullYear(), m = h.getMonth();
  if (f.periodo === 'mes') {
    const ultimoDia = new Date(y, m, 0).getDate();
    return { de: iso(new Date(y, m - 1, 1)), ate: iso(new Date(y, m - 1, Math.min(h.getDate(), ultimoDia))) };
  }
  if (f.periodo === 'mespassado') return { de: iso(new Date(y, m - 2, 1)), ate: iso(new Date(y, m - 1, 0)) };
  const d1 = deISO(de), d2 = deISO(ate);
  const dias = Math.round((d2 - d1) / 864e5) + 1;
  const fim = new Date(d1); fim.setDate(fim.getDate() - 1);
  const ini = new Date(fim); ini.setDate(ini.getDate() - dias + 1);
  return { de: iso(ini), ate: iso(fim) };
}
function noIntervalo(l, iv) { return l.data >= iv.de && l.data <= iv.ate; }
function aplicaFiltros(l, f, { tipo = true, categoria = true } = {}) {
  if (f.usuario !== 'todos' && l.usuario_id !== f.usuario) return false;
  if (tipo && f.tipo !== 'todos' && l.tipo !== f.tipo) return false;
  if (categoria && f.categoria !== 'todas' && String(l.categoria_id) !== f.categoria) return false;
  return true;
}
function porNatureza(lista) {
  const r = { venda: 0, aporte: 0, outra: 0, variavel: 0, fixa: 0, investimento: 0 };
  lista.forEach(l => { const n = cat(l.categoria_id)?.natureza; if (n in r) r[n] += l.valor; });
  return r;
}
function mesesEntre(iv) {
  const a = deISO(iv.de), b = deISO(iv.ate);
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + (b.getDate() / 31) - (a.getDate() - 1) / 31);
}
function variacao(atual, antes, inverso = false) {
  if (antes == null) return '';
  if (!antes) return atual ? '<em>sem base no período anterior</em>' : '<em>igual ao período anterior</em>';
  const v = (atual - antes) / antes;
  if (Math.abs(v) < 0.005) return '<em>igual ao período anterior</em>';
  const bom = inverso ? v < 0 : v > 0;
  return `<em class="${bom ? 'sobe' : 'desce'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(v * 100))}% vs anterior</em>`;
}

function analise(iv, ivAnt) {
  if (iv.de === '0000-01-01') {
    const p = S.lancs.reduce((m, l) => (l.data < m ? l.data : m), iv.ate);
    iv = { de: p, ate: iv.ate };
  }
  const per = S.lancs.filter(l => noIntervalo(l, iv));
  if (!per.length) return null;
  const n = porNatureza(per);
  const vendasL = per.filter(l => cat(l.categoria_id)?.natureza === 'venda');
  const meses = mesesEntre(iv);
  const mc = n.venda - n.variavel;
  const operacional = mc - n.fixa;
  const r = {
    n, meses, mc, operacional,
    nVendas: vendasL.length,
    ticket: vendasL.length ? n.venda / vendasL.length : null,
    mcPct: n.venda > 0 ? mc / n.venda : null,
    margem: n.venda > 0 ? operacional / n.venda : null,
    pesoVar: n.venda > 0 ? n.variavel / n.venda : null,
    depAporte: n.venda + n.aporte > 0 ? n.aporte / (n.venda + n.aporte) : null,
    ent: soma(per.filter(l => l.tipo === 'entrada')),
    sai: soma(per.filter(l => l.tipo === 'saida')),
    variacaoCaixa: soma(per.filter(l => l.tipo === 'entrada')) - soma(per.filter(l => l.tipo === 'saida')),
    vendasMes: n.venda / meses,
    fixaMes: n.fixa / meses,
    opMes: operacional / meses,
    cresc: null, ant: null
  };
  r.equilibrio = r.mcPct > 0 ? r.fixaMes / r.mcPct : null;
  if (ivAnt) {
    const a = porNatureza(S.lancs.filter(l => noIntervalo(l, ivAnt)));
    const la = S.lancs.filter(l => noIntervalo(l, ivAnt));
    r.ant = { venda: a.venda, operacional: a.venda - a.variavel - a.fixa,
      resultado: la.length ? soma(la.filter(l => l.tipo === 'entrada')) - soma(la.filter(l => l.tipo === 'saida')) : null };
    if (a.venda > 0) r.cresc = (n.venda - a.venda) / a.venda;
  }
  r.caixa = soma(S.lancs.filter(l => l.tipo === 'entrada')) - soma(S.lancs.filter(l => l.tipo === 'saida'));
  r.folego = operacional < 0 ? r.caixa / (-r.opMes) : null;

  // Retorno dos equipamentos (todo o histórico)
  const all = porNatureza(S.lancs);
  const opAll = all.venda - all.variavel - all.fixa;
  r.investTotal = all.investimento;
  r.retornoPct = all.investimento > 0 ? Math.max(0, opAll) / all.investimento : null;
  r.paybackMeses = all.investimento > 0 && opAll < all.investimento && r.opMes > 0 ? (all.investimento - Math.max(0, opAll)) / r.opMes : null;

  // Canais de venda e destino do dinheiro
  const agrupar = lista => {
    const g = {};
    lista.forEach(l => { const k = l.categoria_id; g[k] = g[k] || { id: k, valor: 0, qtd: 0 }; g[k].valor += l.valor; g[k].qtd++; });
    return Object.values(g).sort((a, b) => b.valor - a.valor).map(x => ({ ...x, nome: cat(x.id)?.nome || '—', cor: corCategoria(x.id) }));
  };
  r.canais = agrupar(vendasL);
  r.destinos = agrupar(per.filter(l => l.tipo === 'saida'));

  // Nota
  let nota = 50;
  const saidasTot = n.variavel + n.fixa + n.investimento;
  if (n.venda === 0 && saidasTot > 0) nota -= 20;
  else if (r.margem != null) nota += r.margem >= 0.25 ? 25 : r.margem >= 0.10 ? 15 : r.margem >= 0 ? 5 : -15;
  if (r.pesoVar != null) nota += r.pesoVar <= 0.4 ? 10 : r.pesoVar > 0.7 ? -10 : 0;
  if (r.depAporte != null) nota += r.depAporte > 0.5 ? -10 : r.depAporte === 0 ? 5 : 0;
  if (r.cresc != null) nota += r.cresc > 0.05 ? 10 : r.cresc < -0.1 ? -10 : 0;
  if (r.folego != null && r.folego < 3) nota -= 10;
  if (r.caixa < 0) nota -= 10;
  r.nota = Math.max(0, Math.min(100, Math.round(nota)));
  r.status = r.nota >= 70 ? ['Saudável', 'var(--ent)', 'As vendas cobrem a operação com folga.']
    : r.nota >= 45 ? ['Atenção', 'var(--ouro)', 'A operação se paga, mas há pontos para ajustar.']
    : ['Crítica', 'var(--sai)', 'Os gastos estão pesando mais que as vendas.'];

  // O que fazer (regras; a análise com IA entra na V2)
  const d = [];
  if (n.venda === 0 && saidasTot > 0) d.push(['alerta', 'Nenhuma venda registrada no período. Se houve vendas, lance-as para a análise ficar correta.']);
  if (r.equilibrio != null && r.vendasMes < r.equilibrio) d.push(['alerta', `Para pagar as contas fixas, vocês precisam vender pelo menos ${fmt(r.equilibrio)} por mês. Hoje a média é ${fmt(r.vendasMes)}.`]);
  if (r.mcPct != null && r.mcPct <= 0) d.push(['alerta', 'Os gastos para produzir e entregar já passam do valor vendido: vocês perdem dinheiro a cada venda. Revise os preços na calculadora.']);
  else if (r.pesoVar != null && r.pesoVar > 0.6) d.push(['alerta', `Os gastos de produção levam ${pct(r.pesoVar)} de cada venda. Comprar filamento em volume, reduzir falhas ou reajustar preços melhora isso.`]);
  const shopee = r.destinos.filter(x => /shopee/i.test(x.nome)).reduce((a, x) => a + x.valor, 0);
  if (shopee > 0 && n.venda > 0) d.push(['', `Taxas da Shopee levam ${pct(shopee / n.venda)} das vendas. Venda direta pelo catálogo e WhatsApp não tem essa taxa.`]);
  if (r.depAporte != null && r.depAporte > 0.4) d.push(['alerta', `${pct(r.depAporte)} do dinheiro que entrou foi colocado por vocês ou investidores, não veio de vendas. O objetivo é as vendas pagarem tudo sozinhas.`]);
  if (r.cresc != null && r.cresc < -0.1) d.push(['alerta', `As vendas caíram ${pct(-r.cresc)} em relação ao período anterior.`]);
  if (r.cresc != null && r.cresc > 0.1) d.push(['bom', `As vendas cresceram ${pct(r.cresc)} em relação ao período anterior.`]);
  if (r.folego != null) d.push([r.folego < 3 ? 'alerta' : '', r.folego <= 0 ? 'O caixa está negativo e a empresa gastando mais do que ganha.' : `A empresa está gastando mais do que ganha. Nesse ritmo, o dinheiro em caixa dura cerca de ${r.folego.toFixed(1).replace('.', ',')} meses.`]);
  if (r.paybackMeses != null) d.push(['', `No ritmo atual, os equipamentos terminam de se pagar em cerca de ${Math.ceil(r.paybackMeses)} ${Math.ceil(r.paybackMeses) === 1 ? 'mês' : 'meses'}.`]);
  if (!d.some(x => x[0] === 'alerta') && r.margem != null && r.margem >= 0 && r.equilibrio != null) d.push(['bom', `As vendas (${fmt(r.vendasMes)} por mês) já pagam as contas fixas com folga. Continuem registrando tudo.`]);
  r.dicas = d;
  return r;
}

/* ===================== Gestão: tela ===================== */
function selectFiltro(nome, opcoes, atual, padrao, rotulo) {
  return `<select data-filtro="${nome}" class="${atual !== padrao ? 'on' : ''}" aria-label="${rotulo}">
    ${opcoes.map(([v, r]) => `<option value="${esc(v)}" ${String(atual) === String(v) ? 'selected' : ''}>${esc(r)}</option>`).join('')}
  </select>`;
}

function barrasH(itens, total) {
  return `<div class="barras-h">${itens.map(it => `
    <div class="barra-h">
      <div class="topo"><span>${esc(it.rotulo)}</span><b>${esc(it.texto ?? fmt(it.valor))}</b></div>
      <div class="trilho"><div style="width:${total && it.valor ? Math.max(1.5, it.valor / total * 100) : 0}%;background:${it.cor}"></div></div>
      ${it.nota ? `<small>${esc(it.nota)}</small>` : ''}
    </div>`).join('')}</div>`;
}

function linhaDre(rotulo, valor, { sinal = '', forte = false, cor = '', extra = '', nota = '' } = {}) {
  return `<div class="dre-l ${forte ? 'forte' : ''}">
    <span>${esc(rotulo)}${extra ? ` <em>${extra}</em>` : ''}${nota ? `<small>${esc(nota)}</small>` : ''}</span>
    <b${cor ? ` style="color:${cor}"` : ''}>${sinal}${esc(fmt(Math.abs(valor)))}</b></div>`;
}

function deltaTxt(atual, antes) {
  if (antes == null || !antes) return '';
  const v = (atual - antes) / Math.abs(antes);
  if (Math.abs(v) < 0.005) return '';
  return `<i class="${v > 0 ? 'sobe' : 'desce'}">${v > 0 ? '▲' : '▼'} ${Math.abs(Math.round(v * 100))}%</i>`;
}

const PERIODOS = [['mes', 'Este mês'], ['mespassado', 'Mês passado'], ['3m', '3 meses'], ['6m', '6 meses'], ['12m', '12 meses'], ['ano', 'Este ano'], ['tudo', 'Tudo'], ['custom', 'Datas']];

function mesesGrafico(iv) {
  const fimEv = deISO(iv.ate), meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(fimEv.getFullYear(), fimEv.getMonth() - i, 1);
    const ivM = { de: iso(d), ate: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
    const lm = S.lancs.filter(l => noIntervalo(l, ivM));
    meses.push({ rotulo: MESES[d.getMonth()], ent: soma(lm.filter(l => l.tipo === 'entrada')), sai: soma(lm.filter(l => l.tipo === 'saida')) });
  }
  return meses;
}

const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// "1 – 24 de setembro", "agosto de 2026", "jul – set 2026"
function rotuloPeriodo(iv) {
  let de = iv.de;
  if (de === '0000-01-01') {
    if (!S.lancs.length) return 'Todo o histórico';
    de = S.lancs.reduce((m, l) => (l.data < m ? l.data : m), iv.ate);
  }
  const a = deISO(de), b = deISO(iv.ate), anoAtual = new Date().getFullYear();
  const mesmoMes = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  const fimDoMes = b.getDate() === new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
  if (mesmoMes) {
    const ano = b.getFullYear() !== anoAtual ? ` de ${b.getFullYear()}` : '';
    if (a.getDate() === 1 && fimDoMes) return `${MESES_LONGOS[b.getMonth()]}${ano || ` de ${b.getFullYear()}`}`;
    return `${a.getDate() === b.getDate() ? '' : a.getDate() + ' – '}${b.getDate()} de ${MESES_LONGOS[b.getMonth()]}${ano}`;
  }
  if (a.getFullYear() === b.getFullYear()) return `${MESES[a.getMonth()]} – ${MESES[b.getMonth()]} ${b.getFullYear()}`;
  return `${MESES[a.getMonth()]} ${a.getFullYear()} – ${MESES[b.getMonth()]} ${b.getFullYear()}`;
}

// Cartão do topo: resultado do período, entradas x saídas e a saúde da empresa
function painelPeriodo(a) {
  const ent = a ? a.ent : 0, sai = a ? a.sai : 0, res = ent - sai;
  const tot = ent + sai;
  const cor = !tot ? 'var(--txt)' : res >= 0 ? 'var(--ent)' : 'var(--sai)';
  const antes = a?.ant?.resultado;
  let delta = '';
  if (antes != null && antes !== 0 && tot) {
    const v = (res - antes) / Math.abs(antes);
    if (Math.abs(v) >= 0.005) delta = `<span class="pp-delta ${v > 0 ? 'sobe' : 'desce'}">${v > 0 ? '▲' : '▼'} ${Math.abs(Math.round(v * 100))}%<small> vs anterior</small></span>`;
  }
  return `
    <section class="painel-periodo">
      <div class="pp-topo"><span>Resultado do período</span>${delta}</div>
      <div class="pp-valor" style="color:${cor}">${res < 0 ? '− ' : tot ? '+ ' : ''}${esc(fmt(Math.abs(res)))}</div>
      <div class="pp-barra" aria-hidden="true">
        ${tot ? `<i style="width:${ent / tot * 100}%;background:var(--ent)"></i><i style="width:${sai / tot * 100}%;background:var(--sai)"></i>` : ''}
      </div>
      <div class="pp-leg">
        <span><i style="background:var(--ent)"></i>Entradas <b>${esc(fmt(ent))}</b></span>
        <span><i style="background:var(--sai)"></i>Saídas <b>${esc(fmt(sai))}</b></span>
      </div>
      ${a ? `
      <div class="pp-saude">
        ${Charts.anel(a.nota, a.status[1])}
        <div><strong style="color:${a.status[1]}">${a.status[0]}<em>nota ${a.nota} de 100</em></strong><span>${a.status[2]}</span></div>
      </div>` : `
      <div class="pp-vazio">
        <span>Nenhum lançamento nesse período.</span>
        <div><button class="pp-novo" data-acao="novo" data-tipo="entrada">+ Entrada</button><button class="pp-novo" data-acao="novo" data-tipo="saida">+ Saída</button></div>
      </div>`}
    </section>`;
}

function telaGestao() {
  const f = S.filtros;
  const iv = intervalo(f), ivAnt = intervaloAnterior(f, iv);
  const a = analise(iv, ivAnt);

  const topo = `
    <div class="g-topo">
      <span class="g-periodo">${esc(rotuloPeriodo(iv))}</span>
      <h1 class="titulo-tela">Gestão</h1>
    </div>`;
  const periodos = `
    <div class="chips rolar periodos">
      ${PERIODOS.map(([v, r]) => `<button class="chip ${f.periodo === v ? 'ativo' : ''}" data-acao="g-periodo" data-v="${v}">${r}</button>`).join('')}
    </div>
    ${f.periodo === 'custom' ? `<div class="filtros">
      <input type="date" data-filtro="de" value="${esc(f.de)}" aria-label="De">
      <input type="date" data-filtro="ate" value="${esc(f.ate)}" aria-label="Até"></div>` : ''}`;

  if (!a) return `${topo}${periodos}${painelPeriodo(null)}`;

  const n = a.n;
  const meses = mesesGrafico(iv);

  // A cada R$ 100 vendidos
  const base100 = n.venda > 0;
  // só custos e despesas da operação, para as barras + sobra fecharem R$ 100
  const op = a.destinos.filter(x => cat(x.id)?.natureza !== 'investimento');
  let topDest = op.slice(0, 5);
  if (op.length > 6) topDest.push({ nome: `Outros (${op.length - 5})`, valor: op.slice(5).reduce((s, x) => s + x.valor, 0), cor: 'var(--txt-4)' });
  else topDest = op;
  const maxDest = Math.max(1, ...topDest.map(x => x.valor));
  const destinos = topDest.map(x => ({
    rotulo: x.nome, valor: x.valor, cor: x.cor,
    texto: base100 ? fmt(x.valor / n.venda * 100) : pct(x.valor / op.reduce((s, y) => s + y.valor, 0))
  }));
  const sobra100 = base100 ? a.operacional / n.venda * 100 : null;

  // Frases simples, uma ideia por linha
  const fato = (st, titulo, expl) => `<div class="fato ${st}"><i></i><div><p>${titulo}</p><small>${expl}</small></div></div>`;
  const B = v => `<b>${esc(v)}</b>`;
  const fatos = [];
  if (a.ticket != null) fatos.push(fato('', `Cada venda rende em média ${B(fmt(a.ticket))}`,
    `Foram ${a.nVendas} venda${a.nVendas === 1 ? '' : 's'} nesse período, somando ${esc(fmt(n.venda))}.`));
  if (a.mcPct != null) {
    const s100 = Math.max(0, a.mcPct * 100);
    fatos.push(fato(a.mcPct >= 0.4 ? 'ok' : a.mcPct >= 0.2 ? '' : 'alerta',
      a.mcPct > 0 ? `A cada ${B('R$ 100')} vendidos, sobram ${B(fmt(s100))}` : `As vendas não cobrem nem os gastos de produção`,
      a.mcPct > 0 ? 'Isso é o que fica depois de pagar filamento, embalagem, frete e taxas. É dessa sobra que saem as contas fixas e o lucro.'
        : 'Cada venda está custando mais do que o preço cobrado. Revise os preços na calculadora.'));
  }
  if (a.equilibrio != null) {
    const acima = a.vendasMes >= a.equilibrio;
    fatos.push(fato(acima ? 'ok' : 'alerta', `A meta mínima é vender ${B(fmt(a.equilibrio))} por mês`,
      `É o valor que paga as contas fixas. Hoje vocês vendem ${esc(fmt(a.vendasMes))} por mês: ${acima ? 'acima da meta.' : `faltam ${esc(fmt(a.equilibrio - a.vendasMes))} por mês.`}`));
  }
  fatos.push(a.folego == null
    ? fato('ok', 'A empresa está ganhando mais do que gasta', `O dinheiro em caixa hoje é ${esc(fmt(a.caixa))}.`)
    : fato('alerta', a.folego <= 0 ? 'O caixa está negativo' : `O caixa aguenta cerca de ${B(a.folego.toFixed(1).replace('.', ',') + ' meses')}`,
      `A empresa está gastando mais do que ganha. Hoje há ${esc(fmt(a.caixa))} em caixa.`));
  if (a.retornoPct != null) fatos.push(a.retornoPct >= 1
    ? fato('ok', 'Os equipamentos já se pagaram', `O lucro acumulado já cobriu os ${esc(fmt(a.investTotal))} gastos em impressoras e ferramentas.`)
    : fato('', `${B(pct(a.retornoPct))} dos equipamentos já se pagou`,
      `Dos ${esc(fmt(a.investTotal))} gastos em impressoras e ferramentas, o lucro já devolveu ${esc(fmt(a.retornoPct * a.investTotal))}.${a.paybackMeses != null ? ` No ritmo atual, o resto se paga em uns ${Math.ceil(a.paybackMeses)} meses.` : ''}`));

  // Explorar
  const lista = S.lancs.filter(l => noIntervalo(l, iv) && aplicaFiltros(l, f));
  const ent = soma(lista.filter(l => l.tipo === 'entrada')), sai = soma(lista.filter(l => l.tipo === 'saida'));
  const cats = [...S.categorias].sort((x, y) => x.tipo.localeCompare(y.tipo) || x.nome.localeCompare(y.nome))
    .filter(c => f.tipo === 'todos' || c.tipo === f.tipo);
  const porPessoa = S.perfis.map(p => {
    const lp = lista.filter(l => l.usuario_id === p.id);
    return { rotulo: p.nome, cor: p.cor, valor: lp.length, texto: `${lp.length} lançamento${lp.length === 1 ? '' : 's'}` };
  });

  return `
    ${topo}
    ${periodos}
    ${painelPeriodo(a)}

    <section class="bloco-g">
      <div class="cab"><span>Como fechou o período</span></div>
      <div class="dre">
        ${linhaDre('Vendemos', n.venda, { extra: deltaTxt(n.venda, a.ant?.venda) })}
        ${linhaDre('Gastos para produzir e entregar', n.variavel, { sinal: '− ', nota: 'filamento, embalagem, frete, taxas' })}
        ${linhaDre('Contas fixas', n.fixa, { sinal: '− ', nota: 'assinaturas, anúncios, manutenção' })}
        ${linhaDre(a.operacional >= 0 ? 'Lucro' : 'Prejuízo', a.operacional, { sinal: a.operacional < 0 ? '− ' : '', forte: true, cor: a.operacional >= 0 ? 'var(--ent)' : 'var(--sai)' })}
        ${n.investimento ? linhaDre('Compra de equipamentos', n.investimento, { sinal: '− ' }) : ''}
        ${n.aporte + n.outra ? linhaDre('Dinheiro colocado e outras entradas', n.aporte + n.outra, { sinal: '+ ' }) : ''}
        ${linhaDre(a.variacaoCaixa >= 0 ? 'O caixa aumentou' : 'O caixa diminuiu', a.variacaoCaixa, { forte: true })}
      </div>
    </section>

    <section class="bloco-g">
      <div class="cab"><span>O que os números dizem</span></div>
      <div class="fatos">${fatos.join('')}</div>
    </section>

    <section class="bloco-g">
      <div class="cab"><span>Análise com IA</span></div>
      <div id="ia-bloco">${blocoIA(iv)}</div>
    </section>

    ${a.dicas.length ? `
    <section class="bloco-g">
      <div class="cab"><span>O que fazer</span></div>
      <ul class="dicas">${a.dicas.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join('')}</ul>
    </section>` : ''}

    <section class="bloco-g">
      <div class="cab"><span>Últimos 6 meses</span></div>
      ${Charts.barrasMensais(meses)}
      <div class="legenda">
        <span><i style="background:var(--ent)"></i>Entradas</span>
        <span><i style="background:var(--sai)"></i>Saídas</span>
        <span class="muted">ponto = resultado do mês</span>
      </div>
    </section>

    ${destinos.length ? `
    <section class="bloco-g">
      <div class="cab"><span>${base100 ? 'De cada R$ 100 vendidos' : 'Para onde foi o dinheiro'}</span>${n.investimento ? '<span class="pequeno">sem contar equipamentos</span>' : ''}</div>
      ${barrasH(destinos, maxDest)}
      ${sobra100 != null ? `<div class="sobra"><span>Sobra para a empresa</span><b style="color:${sobra100 >= 0 ? 'var(--ent)' : 'var(--sai)'}">${sobra100 < 0 ? '− ' : ''}${esc(fmt(Math.abs(sobra100)))}</b></div>` : ''}
    </section>` : ''}

    ${a.canais.length ? `
    <section class="bloco-g">
      <div class="cab"><span>De onde vêm as vendas</span></div>
      ${barrasH(a.canais.map(c => ({ rotulo: c.nome, valor: c.valor, cor: c.cor, texto: pct(c.valor / n.venda),
        nota: `${fmt(c.valor)} · ${c.qtd} venda${c.qtd === 1 ? '' : 's'} · ticket ${fmt(c.valor / c.qtd)}` })), n.venda)}
    </section>` : ''}

    <section class="bloco-g">
      <div class="cab"><span>Explorar lançamentos</span></div>
      <div class="filtros">
        ${selectFiltro('usuario', [['todos', 'Todas as pessoas'], ...S.perfis.map(p => [p.id, p.nome])], f.usuario, 'todos', 'Pessoa')}
        ${selectFiltro('tipo', [['todos', 'Entradas e saídas'], ['entrada', 'Só entradas'], ['saida', 'Só saídas']], f.tipo, 'todos', 'Tipo')}
        ${selectFiltro('categoria', [['todas', 'Todas as categorias'], ...cats.map(c => [String(c.id), c.nome])], f.categoria, 'todas', 'Categoria')}
      </div>
      <div class="explorar-tot">
        ${f.tipo !== 'saida' ? `<div><span>Entradas</span><b style="color:var(--ent)">${esc(fmt(ent))}</b></div>` : ''}
        ${f.tipo !== 'entrada' ? `<div><span>Saídas</span><b style="color:var(--sai)">${esc(fmt(sai))}</b></div>` : ''}
        <div><span>Lançamentos</span><b>${lista.length}</b></div>
      </div>
      ${f.usuario === 'todos' && lista.length ? `<p class="sub-titulo">Quem lançou</p>${barrasH(porPessoa, lista.length)}` : ''}
      <button class="btn sec" data-acao="exportar" style="margin-top:18px">
        <svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>
        Exportar esses lançamentos (CSV)
      </button>
    </section>`;
}

function exportarCSV() {
  const f = S.filtros, iv = intervalo(f);
  const lista = S.lancs.filter(l => noIntervalo(l, iv) && aplicaFiltros(l, f));
  if (!lista.length) return toast('Nada para exportar nesse filtro.', true);
  const campo = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [['Data', 'Tipo', 'Categoria', 'Natureza', 'Valor', 'Descrição', 'Pagamento', 'Quem'].map(campo).join(';')];
  lista.forEach(l => {
    const c = cat(l.categoria_id);
    linhas.push([
      l.data.split('-').reverse().join('/'), l.tipo === 'entrada' ? 'Entrada' : 'Saída', c?.nome, nomeNatureza(c?.natureza),
      l.valor.toFixed(2).replace('.', ','), l.descricao, l.forma_pagamento, perfil(l.usuario_id)?.nome
    ].map(campo).join(';'));
  });
  const nome = `caixa-np3d-${iv.de === '0000-01-01' ? 'tudo' : iv.de}-a-${iv.ate}.csv`;
  const arquivo = new File(['\ufeff' + linhas.join('\r\n')], nome, { type: 'text/csv' });
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    navigator.share({ files: [arquivo], title: nome }).catch(() => {});
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(arquivo); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
}

/* ===================== Ajustes ===================== */
function telaAjustes() {
  const grupos = ['entrada', 'saida'].map(t => ({
    t, lista: S.categorias.filter(c => c.tipo === t).sort(temOrdem() ? porOrdem : (a, b) => a.nome.localeCompare(b.nome))
  }));
  return `
    <h1 class="titulo-tela">Ajustes</h1>
    <section class="secao">
      <div class="bloco">
        <div class="perfil-linha">
          <span class="avatar" style="background:${esc(S.perfil.cor)}">${esc(S.perfil.nome[0])}</span>
          <div><strong>${esc(S.perfil.nome)}</strong><br><span class="pequeno muted">${esc(Api.sessao().user.email)}</span></div>
        </div>
      </div>
    </section>

    <section class="secao">
      <div class="secao-topo"><h2>Segurança</h2></div>
      <div class="bloco" style="padding-top:4px;padding-bottom:4px">
        ${Lock.celular() ? `<button class="opcao" data-acao="${Lock.ativo() ? 'faceid-off' : 'faceid-on'}">
          <span>Face ID ao abrir<small>Pede o Face ID sempre que o app abre ou volta depois de 1 minuto</small></span>
          <span class="dir ${Lock.ativo() ? 'on' : ''}">${Lock.ativo() ? 'Ativado' : 'Ativar'}</span>
        </button>` : ''}
        <button class="opcao" data-acao="sair"><span>Sair da conta<small>Pede a senha na próxima vez</small></span><span class="dir">Sair</span></button>
      </div>
    </section>

    <section class="secao">
      <div class="secao-topo"><h2>Automático</h2></div>
      <div class="bloco" style="padding-top:4px;padding-bottom:4px">
        <button class="opcao" data-acao="rec-lista">
          <span>Lançamentos que se repetem<small>Assinaturas e contas lançadas sozinhas todo mês</small></span>
          <span class="dir">${S.recorrentes.filter(r => r.ativa).length || 'Ver'}</span>
        </button>
      </div>
    </section>

    <section class="secao">
      <div class="secao-topo"><h2>Categorias</h2><button data-acao="cat-nova">+ Nova</button></div>
      ${grupos.map(g => `
        <p class="sub-titulo">${g.t === 'entrada' ? 'Entradas' : 'Saídas'}</p>
        <div class="bloco lista-ordem" data-tipo="${g.t}" style="padding-top:2px;padding-bottom:2px">
          ${g.lista.map(c => `
            <div class="cat-linha" data-id="${c.id}">
              ${temOrdem() ? `<span class="alca" aria-label="Arrastar para mudar a ordem"><svg viewBox="0 0 24 24"><path d="M5 8h14M5 12h14M5 16h14"/></svg></span>` : ''}
              <button class="opcao" data-acao="cat-editar" data-id="${c.id}">
                <span style="display:flex;align-items:center;gap:10px">
                  <span class="ponto" style="width:9px;height:9px;border-radius:50%;background:${corCategoria(c.id)}"></span>
                  <span>${esc(c.nome)}<small>${esc(nomeNatureza(c.natureza))}</small></span>
                </span>
                <span class="dir">Editar</span>
              </button>
            </div>`).join('')}
        </div>`).join('')}
    </section>

    <section class="secao">
      <div class="secao-topo"><h2>App</h2></div>
      <div class="bloco" style="padding-top:4px;padding-bottom:4px">
        <button class="opcao" data-acao="recarregar"><span>Atualizar dados<small>O app já atualiza sozinho a cada 30 segundos. ${S.carregadoEm ? 'Última vez às ' + new Date(S.carregadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.' : 'Sem conexão.'}</small></span><span class="dir">Atualizar</span></button>
        <div class="opcao"><span>Instalar no iPhone<small>No Safari: Compartilhar › Adicionar à Tela de Início</small></span></div>
      </div>
    </section>

    <p class="rodape">Caixa · Nosso Projeto 3D · versão ${VERSAO}</p>`;
}

function abrirCategoria(c = null) {
  const est = c ? { id: c.id, tipo: c.tipo, nome: c.nome, natureza: c.natureza, excluindo: false, destino: null }
    : { id: null, tipo: 'saida', nome: '', natureza: 'variavel' };
  const usos = c ? S.lancs.filter(l => l.categoria_id === c.id).length + S.recorrentes.filter(r => r.categoria_id === c.id).length : 0;
  const desenhar = () => {
    const nat = NATUREZAS[est.tipo];
    const outras = c ? S.categorias.filter(x => x.tipo === c.tipo && x.id !== c.id).sort((a, b) => a.nome.localeCompare(b.nome)) : [];
    abrirSheet(`
      <div class="sheet-topo"><h2>${c ? 'Editar categoria' : 'Nova categoria'}</h2><button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      ${c ? '' : `<div class="grupo"><div class="segmento">
        <button class="${est.tipo === 'entrada' ? 'ativo' : ''}" data-cat-tipo="entrada">Entrada</button>
        <button class="${est.tipo === 'saida' ? 'ativo' : ''}" data-cat-tipo="saida">Saída</button></div></div>`}
      <div class="grupo"><label for="cat-nome">Nome</label><input id="cat-nome" class="campo" maxlength="40" value="${esc(est.nome)}"></div>
      <div class="grupo"><span class="rot">Conta como</span>
        <div class="chips">${nat.map(n => `<button class="chip ${est.natureza === n[0] ? 'ativo' : ''}" data-cat-nat="${n[0]}">${n[1]}</button>`).join('')}</div>
        <p class="dica-nat" style="margin-top:10px">${esc(nat.find(n => n[0] === est.natureza)?.[2] || '')}</p>
      </div>
      ${est.excluindo ? `
        <div class="grupo excluir-cat">
          <span class="rot">Mover ${usos} lançamento${usos === 1 ? '' : 's'} para</span>
          ${outras.length
            ? `<div class="chips">${outras.map(x => `<button class="chip ${est.destino === x.id ? 'ativo' : ''}" data-cat-destino="${x.id}">${esc(x.nome)}</button>`).join('')}</div>`
            : `<p class="dica-nat">Crie outra categoria de ${c.tipo === 'entrada' ? 'entrada' : 'saída'} primeiro, para receber esses lançamentos.</p>`}
        </div>` : ''}
      <div class="acoes-form">
        ${est.excluindo
          ? `<button class="btn perigo" id="cat-excluir-ok" ${est.destino ? '' : 'disabled'}>Mover e excluir</button>
             <button class="btn link" id="cat-excluir-nao" style="width:100%">Cancelar</button>`
          : `<button class="btn" id="cat-salvar">${c ? 'Salvar alterações' : 'Criar categoria'}</button>
             ${c ? '<button class="btn perigo" id="cat-excluir">Excluir categoria</button>' : ''}`}
      </div>`);
    $('#cat-nome').addEventListener('input', e => { est.nome = e.target.value; });
    $$('[data-cat-tipo]').forEach(b => b.addEventListener('click', () => {
      est.tipo = b.dataset.catTipo; est.natureza = NATUREZAS[est.tipo][0][0]; desenhar();
    }));
    $$('[data-cat-nat]').forEach(b => b.addEventListener('click', () => { est.natureza = b.dataset.catNat; desenhar(); }));
    $$('[data-cat-destino]').forEach(b => b.addEventListener('click', () => { est.destino = Number(b.dataset.catDestino); desenhar(); }));
    $('#cat-salvar')?.addEventListener('click', async () => {
      const nome = est.nome.trim();
      if (!nome) return toast('Dê um nome para a categoria.', true);
      try {
        // ativa: true traz de volta categorias arquivadas na versão antiga
        if (c) Object.assign(c, await Api.editarCategoria(c.id, { nome, natureza: est.natureza, ativa: true }));
        else S.categorias.push(await Api.criarCategoria({ nome, tipo: est.tipo, natureza: est.natureza, ...proximaOrdem(est.tipo) }));
        fecharSheet(); render(); toast(c ? 'Categoria salva' : 'Categoria criada');
      } catch (e) { tratarErro(e); }
    });
    $('#cat-excluir')?.addEventListener('click', async () => {
      if (usos) { est.excluindo = true; return desenhar(); }
      if (await confirmar(`Excluir a categoria “${c.nome}”?`)) excluirCategoria(c);
    });
    $('#cat-excluir-nao')?.addEventListener('click', () => { est.excluindo = false; est.destino = null; desenhar(); });
    $('#cat-excluir-ok')?.addEventListener('click', () => excluirCategoria(c, est.destino));
  };
  desenhar();
}

async function excluirCategoria(c, destino = null) {
  try {
    if (destino) {
      await Api.moverCategoria(c.id, destino);
      S.lancs.forEach(l => { if (l.categoria_id === c.id) l.categoria_id = destino; });
      S.recorrentes.forEach(r => { if (r.categoria_id === c.id) r.categoria_id = destino; });
    }
    await Api.excluirCategoria(c.id);
    S.categorias = S.categorias.filter(x => x.id !== c.id);
    fecharSheet(); render(); toast('Categoria excluída');
  } catch (e) {
    if (e.auth) return tratarErro(e);
    // A resposta pode ter se perdido: confere no banco antes de mostrar erro
    try {
      S.categorias = await Api.categorias();
      if (!S.categorias.some(x => x.id === c.id)) { fecharSheet(); render(); return toast('Categoria excluída'); }
    } catch (_) { /* sem conexão de verdade */ }
    tratarErro(e);
  }
}

/* ---------- Recorrentes: telas ---------- */
function abrirRecorrentes() {
  const lista = [...S.recorrentes].sort((x, y) => y.ativa - x.ativa || x.dia_mes - y.dia_mes);
  abrirSheet(`
    <div class="sheet-topo"><h2>Lançamentos que se repetem</h2><button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
    ${lista.length ? `<div class="lista">${lista.map(r => `
      <button class="item compacto ${r.ativa ? '' : 'cat-inativa'}" data-acao="rec-editar" data-id="${r.id}">
        <span class="meio">
          <span class="titulo">${esc(r.descricao || cat(r.categoria_id)?.nome || '—')}</span>
          <span class="sub">Todo dia ${r.dia_mes}${r.ativa ? '' : ' · pausado'}</span>
        </span>
        <span class="v ${r.tipo === 'entrada' ? 'e' : 's'}">${r.tipo === 'entrada' ? '+' : '−'} ${esc(fmt(r.valor))}</span>
      </button>`).join('')}</div>`
    : `<p class="muted">Nenhum ainda. Ao lançar uma saída ou entrada, ligue “Repetir todo mês”.</p>`}
    <div class="acoes-form"><button class="btn sec" data-acao="rec-novo">Criar lançamento mensal</button></div>`);
}

function abrirRecorrente(r) {
  if (!r) return;
  const est = { centavos: Math.round(r.valor * 100), dia: r.dia_mes, descricao: r.descricao || '' };
  abrirSheet(`
    <div class="sheet-topo">
      <div><span class="tipo-tag ${r.tipo}">${r.tipo === 'entrada' ? 'Entrada mensal' : 'Saída mensal'}</span><h2>${esc(cat(r.categoria_id)?.nome || '')}</h2></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button>
    </div>
    <input id="r-valor" class="valor-input ${r.tipo}" inputmode="numeric" value="${esc(fmt(r.valor))}" aria-label="Valor">
    <div class="grupo"><label for="r-dia">Dia do mês</label>
      <input id="r-dia" class="campo" type="number" inputmode="numeric" min="1" max="31" value="${r.dia_mes}"></div>
    <div class="grupo"><label for="r-desc">Descrição</label>
      <input id="r-desc" class="campo" maxlength="120" value="${esc(est.descricao)}"></div>
    <p class="nota-rec">As mudanças valem para os próximos meses. O que já foi lançado continua no histórico.</p>
    <div class="acoes-form">
      <button class="btn" id="r-salvar">Salvar alterações</button>
      <button class="btn sec" id="r-pausar">${r.ativa ? 'Pausar' : 'Retomar'}</button>
      <button class="btn perigo" id="r-excluir">Excluir</button>
    </div>`);
  const iv = $('#r-valor');
  iv.addEventListener('input', () => {
    const dig = iv.value.replace(/\D/g, '').slice(0, 11);
    est.centavos = parseInt(dig || '0', 10);
    iv.value = est.centavos ? fmt(est.centavos / 100) : '';
  });
  const atualizar = async (dados, msg) => {
    try {
      Object.assign(r, await Api.editarRecorrente(r.id, dados));
      r.valor = Number(r.valor);
      await gerarRecorrentes(true);
      await carregarTudo(); render(); abrirRecorrentes(); toast(msg);
    } catch (e) { tratarErro(e); }
  };
  $('#r-salvar').addEventListener('click', () => {
    const dia = Math.round(Number($('#r-dia').value));
    if (!est.centavos) return toast('Digite o valor.', true);
    if (!(dia >= 1 && dia <= 31)) return toast('O dia precisa ser de 1 a 31.', true);
    atualizar({ valor: est.centavos / 100, dia_mes: dia, descricao: $('#r-desc').value.trim() || null }, 'Alterações salvas');
  });
  $('#r-pausar').addEventListener('click', () => {
    // Ao retomar, não lança os meses que ficaram pausados
    const dados = r.ativa ? { ativa: false } : { ativa: true, gerado_ate: hoje() > (r.gerado_ate || '') ? hoje() : r.gerado_ate };
    atualizar(dados, r.ativa ? 'Pausado: não será mais lançado' : 'Retomado: volta no próximo vencimento');
  });
  $('#r-excluir').addEventListener('click', async () => {
    if (!await confirmar('Excluir esse lançamento mensal? O que já foi lançado continua no histórico.')) return;
    try {
      await Api.excluirRecorrente(r.id);
      S.recorrentes = S.recorrentes.filter(x => x.id !== r.id);
      render(); abrirRecorrentes(); toast('Lançamento mensal excluído');
    } catch (e) { tratarErro(e); }
  });
}

/* ---------- Análise com IA ---------- */
function chaveIA(iv) {
  const f = S.filtros;
  return `${f.periodo}|${iv.de}|${iv.ate}`;
}
function iaSalva(chave) {
  try { const m = JSON.parse(localStorage.getItem('caixa_ia') || '{}'); return m[chave] || null; } catch (_) { return null; }
}
function guardarIA(chave, valor) {
  try {
    const m = JSON.parse(localStorage.getItem('caixa_ia') || '{}');
    m[chave] = valor;
    const chaves = Object.keys(m);
    if (chaves.length > 8) chaves.slice(0, chaves.length - 8).forEach(k => delete m[k]);
    localStorage.setItem('caixa_ia', JSON.stringify(m));
  } catch (_) {}
}

function dadosParaIA(iv, a, meses) {
  const r2 = v => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);
  const n = a.n;
  return {
    periodo: { de: iv.de === '0000-01-01' ? 'início' : iv.de, ate: iv.ate, meses: r2(a.meses) },
    vendas: r2(n.venda), numero_de_vendas: a.nVendas, valor_medio_por_venda: r2(a.ticket),
    vendas_por_mes: r2(a.vendasMes), vendas_no_periodo_anterior: r2(a.ant?.venda),
    gastos_para_produzir_e_entregar: r2(n.variavel), contas_fixas: r2(n.fixa),
    lucro: r2(a.operacional), compra_de_equipamentos: r2(n.investimento),
    dinheiro_colocado_por_socios_ou_investidores: r2(n.aporte), outras_entradas: r2(n.outra),
    dinheiro_em_caixa_hoje: r2(a.caixa), venda_minima_mensal_para_pagar_contas_fixas: r2(a.equilibrio),
    percentual_dos_equipamentos_ja_pago_pelo_lucro: a.retornoPct == null ? null : Math.round(a.retornoPct * 100),
    canais_de_venda: a.canais.map(c => ({ canal: c.nome, valor: r2(c.valor), vendas: c.qtd })),
    saidas_por_categoria: a.destinos.map(d => ({ categoria: d.nome, tipo: nomeNatureza(cat(d.id)?.natureza), valor: r2(d.valor), lancamentos: d.qtd })),
    ultimos_6_meses: meses.map(m => ({ mes: m.rotulo, entradas: r2(m.ent), saidas: r2(m.sai) })),
    lancamentos_mensais_automaticos: S.recorrentes.filter(r => r.ativa).map(r => ({ categoria: cat(r.categoria_id)?.nome, valor: r2(r.valor), tipo: r.tipo }))
  };
}

async function pedirAnaliseIA() {
  const iv = intervalo(S.filtros), a = analise(iv, intervaloAnterior(S.filtros, iv));
  if (!a) return;
  const chave = chaveIA(iv);
  S.ia = { chave, estado: 'carregando' };
  atualizarBlocoIA(iv);
  try {
    const analiseIA = await Api.analisar(dadosParaIA(iv, a, mesesGrafico(iv)));
    S.ia = { chave, estado: 'ok', analise: analiseIA, em: Date.now() };
    S.ia.assin = assinatura(S.lancs, S.categorias);
    guardarIA(chave, { analise: analiseIA, em: S.ia.em, assin: S.ia.assin });
  } catch (e) {
    if (e.auth) return tratarErro(e);
    S.ia = { chave, estado: 'erro', erro: e.message };
  }
  atualizarBlocoIA(iv);
}

function atualizarBlocoIA(iv) {
  const el = $('#ia-bloco');
  if (el && S.tela === 'gestao') el.innerHTML = blocoIA(iv);
}

function blocoIA(iv) {
  const chave = chaveIA(iv);
  let st = S.ia && S.ia.chave === chave ? S.ia : null;
  if (!st) { const salvo = iaSalva(chave); if (salvo) st = { chave, estado: 'ok', ...salvo }; }
  const lista = (itens, cls) => (itens || []).filter(Boolean).map(t => `<li class="${cls}">${esc(t)}</li>`).join('');

  if (st?.estado === 'carregando') return `<div class="ia-card"><div class="ia-carregando"><div class="giro"></div><span>Analisando os números do período…</span></div></div>`;
  if (st?.estado === 'ok') {
    const x = st.analise || {};
    return `<div class="ia-card">
      ${x.resumo ? `<p class="ia-resumo">${esc(x.resumo)}</p>` : ''}
      ${(x.bom || []).length ? `<p class="sub-titulo">Indo bem</p><ul class="dicas">${lista(x.bom, 'bom')}</ul>` : ''}
      ${(x.atencao || []).length ? `<p class="sub-titulo">Atenção</p><ul class="dicas">${lista(x.atencao, 'alerta')}</ul>` : ''}
      ${(x.acoes || []).length ? `<p class="sub-titulo">O que fazer agora</p>
        <ol class="ia-acoes">${x.acoes.map(ac => `<li><b>${esc(ac.titulo || '')}</b>${ac.detalhe ? `<span>${esc(ac.detalhe)}</span>` : ''}</li>`).join('')}</ol>` : ''}
      ${st.assin && st.assin !== assinatura(S.lancs, S.categorias) ? '<p class="ia-aviso">Teve lançamento novo depois dessa análise. Toque em “Analisar de novo” para atualizar.</p>' : ''}
      <div class="ia-rodape">
        <span>Gerada às ${new Date(st.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} de ${new Date(st.em).toLocaleDateString('pt-BR')}</span>
        <button data-acao="ia-analisar">Analisar de novo</button>
      </div>
    </div>`;
  }
  return `<div class="ia-card">
    ${st?.estado === 'erro' ? `<p class="erro" style="margin:0 0 12px">${esc(st.erro)}</p>` : ''}
    <p class="ia-intro">A IA lê os números desse período e diz, em linguagem simples, o que está bom, o que preocupa e o que fazer.</p>
    <button class="btn" data-acao="ia-analisar">${st?.estado === 'erro' ? 'Tentar de novo' : 'Analisar com IA'}</button>
    <p class="ia-privacidade">Só os totais vão para o Google Gemini (plano grátis). Descrições dos lançamentos não são enviadas.</p>
  </div>`;
}

function oferecerFaceId() {
  abrirSheet(`
    <div class="sheet-topo"><h2>Proteger com Face ID?</h2><button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
    <p class="muted">Assim o app pede o Face ID sempre que for aberto, sem precisar digitar a senha.</p>
    <div class="acoes-form">
      <button class="btn" data-acao="faceid-on">Ativar Face ID</button>
      <button class="btn link" data-acao="fechar">Agora não</button>
    </div>`);
}

async function ativarFaceId() {
  if (!await Lock.disponivel()) {
    return toast('Face ID disponível só no app instalado pelo Safari, no endereço https.', true);
  }
  try {
    await Lock.ativar(S.perfil.nome, Api.sessao().user.email);
    fecharSheet(); render(); toast('Face ID ativado');
  } catch (_) {
    Lock.desativar();
    toast('Face ID não foi ativado. Tente de novo.', true);
  }
}

/* ===================== Eventos ===================== */
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-tela]');
  if (nav) return irPara(nav.dataset.tela);
  const ir = e.target.closest('[data-tela-ir]');
  if (ir) return irPara(ir.dataset.telaIr);

  const el = e.target.closest('[data-acao]');
  if (!el) return;
  const f = S.form;
  const marcar = () => el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('ativo', c === el));
  switch (el.dataset.acao) {
    case 'novo': return abrirForm(el.dataset.tipo);
    case 'editar': {
      const l = S.lancs.find(x => x.id === Number(el.dataset.id));
      return l && abrirForm(l.tipo, l);
    }
    case 'fechar': return fecharSheet();
    case 'f-cat': f.categoria_id = Number(el.dataset.id); return abrirPainelCat(false);
    case 'f-cat-abrir': return abrirPainelCat(true);
    case 'f-cat-fechar': return abrirPainelCat(false);
    case 'f-nova-cat': f.novaCat = f.novaCat ? null : { nome: '', natureza: NATUREZAS[f.tipo][0][0] }; return renderPainelCats();
    case 'nc-nat': f.novaCat.natureza = el.dataset.v; return renderPainelCats();
    case 'nc-criar': return criarCategoriaForm();
    case 'f-data': f.data = el.dataset.v; $('#f-data').value = f.data; $('#f-data').classList.remove('on');
      return $$('[data-acao="f-data"]').forEach(b => b.classList.toggle('ativo', b === el));
    case 'f-pag':
      if (f.forma_pagamento === el.dataset.v) { f.forma_pagamento = ''; el.classList.remove('ativo'); }
      else { f.forma_pagamento = el.dataset.v; marcar(); }
      return;
    case 'f-user': f.usuario_id = el.dataset.id; return marcar();
    case 'salvar': return salvarForm();
    case 'excluir': return excluirForm();
    case 'h-tipo': S.hist.tipo = el.dataset.v; S.hist.limite = 60; return render();
    case 'h-mais': S.hist.limite += 60; $('#h-res').innerHTML = histResultados(); return;
    case 'exportar': return exportarCSV();
    case 'f-repetir':
      f.repetir = !f.repetir;
      el.setAttribute('aria-pressed', f.repetir);
      el.querySelector('.toggle').classList.toggle('on', f.repetir);
      $('#f-rep-txt').textContent = textoRepetir(f);
      $('#f-salvar').textContent = f.repetir ? 'Criar lançamento mensal' : (f.tipo === 'entrada' ? 'Lançar entrada' : 'Lançar saída');
      return;
    case 'rec-lista': return abrirRecorrentes();
    case 'rec-editar': return abrirRecorrente(S.recorrentes.find(r => r.id === Number(el.dataset.id)));
    case 'rec-novo': fecharSheet(); return setTimeout(() => abrirForm('saida', null, { repetir: true }), 280);
    case 'ia-analisar': return pedirAnaliseIA();
    case 'g-periodo': S.filtros.periodo = el.dataset.v; return render();
    case 'faceid-on': return ativarFaceId();
    case 'faceid-off': Lock.desativar(); render(); return toast('Face ID desativado');
    case 'cat-nova': return abrirCategoria();
    case 'cat-editar': return abrirCategoria(cat(Number(el.dataset.id)));
    case 'recarregar':
      return carregarTudo().then(() => { render(); if (!S.offline) toast('Dados atualizados'); }).catch(tratarErro);
    case 'sair':
      return confirmar('Sair da conta neste aparelho?', { ok: 'Sair' }).then(ok => { if (ok) { Lock.desativar(); Api.sair().then(() => telaLogin()); } });
      return;
  }
});

document.addEventListener('change', e => {
  const k = e.target.dataset.filtro;
  if (!k) return;
  S.filtros[k] = e.target.value;
  if (k === 'tipo') S.filtros.categoria = 'todas';
  render();
});

let buscaT;
document.addEventListener('input', e => {
  if (e.target.id !== 'h-busca') return;
  clearTimeout(buscaT);
  buscaT = setTimeout(() => {
    S.hist.busca = e.target.value; S.hist.limite = 60;
    $('#h-res').innerHTML = histResultados();
  }, 180);
});

$('#sheet-fundo').addEventListener('click', fecharSheet);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) fecharSheet(); });

// Trava ao voltar depois de 1 min em segundo plano; recarrega dados após 2 min
let saiuEm = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { saiuEm = Date.now(); return; }
  if ($('#shell').hidden || !saiuEm) return;
  const fora = Date.now() - saiuEm;
  if (Lock.ativo() && fora > 60e3) { fecharSheet(); return telaBloqueio(); }
  sincronizar(); // voltou para o app: confere na hora se tem novidade
});

/* ===================== Início do app ===================== */
function iniciar() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (!Api.configurado()) return telaConfigFaltando();
  if (!Api.sessao()) return telaLogin();
  if (Lock.ativo()) return telaBloqueio();
  entrarNoApp();
}
iniciar();
