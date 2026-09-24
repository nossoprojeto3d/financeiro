// Comunicação com o Supabase usando fetch puro (sem bibliotecas).
const Api = (() => {
  const C = window.CAIXA_CONFIG;
  const CHAVE = 'caixa_sessao';
  let sessao = null;
  try { sessao = JSON.parse(localStorage.getItem(CHAVE)); } catch (_) { sessao = null; }

  function salvar(s) {
    sessao = s;
    if (s) localStorage.setItem(CHAVE, JSON.stringify(s));
    else localStorage.removeItem(CHAVE);
  }

  function configurado() {
    return !!(C && C.SUPABASE_URL && C.SUPABASE_KEY &&
      !C.SUPABASE_URL.includes('SEU-PROJETO') && !C.SUPABASE_KEY.includes('SUA_CHAVE'));
  }

  function erroAuth(msg) { const e = new Error(msg); e.auth = true; return e; }

  function traduzir(msg) {
    const m = String(msg || '');
    if (/invalid login credentials/i.test(m)) return 'Senha incorreta. Confira e tente de novo.';
    if (/email not confirmed/i.test(m)) return 'E-mail ainda não confirmado no Supabase (marque "Auto Confirm User").';
    if (/refresh token/i.test(m)) return 'Sua sessão expirou. Entre com a senha de novo.';
    if (/failed to fetch|networkerror|load failed/i.test(m)) return 'Sem conexão com a internet.';
    if (/row-level security/i.test(m)) return 'Sem permissão. Seu usuário tem perfil no banco? (passo 2 do setup.sql)';
    return m || 'Algo deu errado.';
  }

  async function chamar(url, opcoes) {
    try { return await fetch(url, opcoes); }
    catch (e) { throw new Error(traduzir(e.message)); }
  }

  async function auth(caminho, corpo) {
    const r = await chamar(`${C.SUPABASE_URL}/auth/v1/${caminho}`, {
      method: 'POST',
      headers: { apikey: C.SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = traduzir(j.error_description || j.msg || j.message || j.error);
      throw r.status === 400 || r.status === 401 ? erroAuth(msg) : new Error(msg);
    }
    return j;
  }

  function guardar(j) {
    salvar({
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
      user: { id: j.user.id, email: j.user.email }
    });
  }

  async function login(email, senha) {
    guardar(await auth('token?grant_type=password', { email, password: senha }));
    return sessao;
  }

  let renovando = null;
  function renovar() {
    if (!sessao) return Promise.reject(erroAuth('Entre com a senha para continuar.'));
    if (!renovando) {
      renovando = auth('token?grant_type=refresh_token', { refresh_token: sessao.refresh_token })
        .then(guardar)
        .catch(e => { if (e.auth) salvar(null); throw e; })
        .finally(() => { renovando = null; });
    }
    return renovando;
  }

  async function token() {
    if (!sessao) throw erroAuth('Entre com a senha para continuar.');
    if (sessao.expires_at - Date.now() / 1000 < 90) await renovar();
    return sessao.access_token;
  }

  async function sair() {
    if (sessao) {
      chamar(`${C.SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: C.SUPABASE_KEY, Authorization: `Bearer ${sessao.access_token}` }
      }).catch(() => {});
    }
    salvar(null);
  }

  async function rest(caminho, { method = 'GET', body, prefer, range } = {}, tentar = true) {
    const headers = {
      apikey: C.SUPABASE_KEY,
      Authorization: `Bearer ${await token()}`,
      'Content-Type': 'application/json'
    };
    if (prefer) headers.Prefer = prefer;
    if (range) { headers.Range = range; headers['Range-Unit'] = 'items'; }
    const r = await chamar(`${C.SUPABASE_URL}/rest/v1/${caminho}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    if (r.status === 401 && tentar) { await renovar(); return rest(caminho, { method, body, prefer, range }, false); }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(traduzir(j.message || `Erro ${r.status}`));
    }
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  }

  // Busca paginada (o Supabase devolve no máximo 1000 linhas por vez)
  async function todos(caminho) {
    const lote = 1000; let de = 0; const saida = [];
    for (;;) {
      const parte = await rest(caminho, { range: `${de}-${de + lote - 1}` });
      saida.push(...parte);
      if (parte.length < lote) return saida;
      de += lote;
    }
  }

  const volta = { prefer: 'return=representation' };

  return {
    configurado, login, sair,
    sessao: () => sessao,
    perfis: () => rest('perfis?select=id,nome,cor&order=nome'),
    categorias: () => rest('categorias?select=*&order=nome'),
    lancamentos: () => todos('lancamentos?select=*&order=data.desc,id.desc'),
    criarLancamento: d => rest('lancamentos', { method: 'POST', body: d, ...volta }).then(r => r[0]),
    editarLancamento: (id, d) => rest(`lancamentos?id=eq.${id}`, { method: 'PATCH', body: d, ...volta }).then(r => r[0]),
    excluirLancamento: id => rest(`lancamentos?id=eq.${id}`, { method: 'DELETE' }),
    criarCategoria: d => rest('categorias', { method: 'POST', body: d, ...volta }).then(r => r[0]),
    editarCategoria: (id, d) => rest(`categorias?id=eq.${id}`, { method: 'PATCH', body: d, ...volta }).then(r => r[0]),

    // V2: recorrentes
    recorrentes: () => rest('recorrentes?select=*&order=dia_mes'),
    criarRecorrente: d => rest('recorrentes', { method: 'POST', body: d, ...volta }).then(r => r[0]),
    editarRecorrente: (id, d) => rest(`recorrentes?id=eq.${id}`, { method: 'PATCH', body: d, ...volta }).then(r => r[0]),
    excluirRecorrente: id => rest(`recorrentes?id=eq.${id}`, { method: 'DELETE' }),
    gerarRecorrentes: () => rest('rpc/gerar_recorrentes', { method: 'POST', body: {} }),

    // V2: análise com IA (Edge Function que guarda a chave do Gemini)
    analisar: async dados => {
      const r = await chamar(`${C.SUPABASE_URL}/functions/v1/analise`, {
        method: 'POST',
        headers: { apikey: C.SUPABASE_KEY, Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dados })
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 404) throw new Error('A análise com IA ainda não foi instalada no Supabase (veja o README, parte V2).');
      if (!r.ok || !j.analise) throw new Error(j.erro || `Erro ${r.status} na análise.`);
      return j.analise;
    }
  };
})();
