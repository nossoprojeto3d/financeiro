// Comunicação com o Supabase usando fetch puro (sem bibliotecas).
import { CONFIG } from './config.js'

export const Api = (() => {
  const C = CONFIG;
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
    if (/failed to fetch|networkerror|load failed/i.test(m)) {
      return navigator.onLine === false ? 'Sem conexão com a internet.' : 'Não deu para falar com o servidor. Tente de novo.';
    }
    if (/foreign key/i.test(m)) return 'Ainda há lançamentos nessa categoria. Atualize os dados e tente de novo.';
    if (/row-level security/i.test(m)) return 'Sem permissão. Seu usuário tem perfil no banco? (passo 2 do setup.sql)';
    return m || 'Algo deu errado.';
  }

  let ultimaResposta = 0; // hora da última resposta do servidor
  async function chamar(url, opcoes) {
    try { const r = await fetch(url, opcoes); ultimaResposta = Date.now(); return r; }
    catch (e) {
      // não chegou ao servidor (sem internet, sinal caiu): quem chamou pode guardar para depois
      const erro = new Error(traduzir(e.message)); erro.rede = true; throw erro;
    }
  }
  const esperar = ms => new Promise(ok => setTimeout(ok, ms));

  // Depois de muito tempo parado, o iPhone às vezes usa uma conexão que já caiu e
  // a primeira chamada falha. Antes de gravar, uma consulta leve (que pode repetir
  // sem risco) acorda a conexão; assim o lançamento não precisa ser repetido.
  async function acordar() {
    if (Date.now() - ultimaResposta < 60e3) return;
    const url = `${C.SUPABASE_URL}/rest/v1/perfis?select=id&limit=1`;
    const h = { apikey: C.SUPABASE_KEY, Authorization: `Bearer ${sessao.access_token}` };
    await chamar(url, { headers: h }).catch(() => esperar(700).then(() => chamar(url, { headers: h }))).catch(() => {});
  }

  async function auth(caminho, corpo) {
    const pedido = () => chamar(`${C.SUPABASE_URL}/auth/v1/${caminho}`, {
      method: 'POST',
      headers: { apikey: C.SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });
    // Falha de rede: tenta mais uma vez (entrar e renovar a sessão não duplicam nada)
    const r = await pedido().catch(() => esperar(700).then(pedido));
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
    const headers = { apikey: C.SUPABASE_KEY, Authorization: `Bearer ${await token()}` };
    if (method === 'POST') await acordar();
    if (body) headers['Content-Type'] = 'application/json'; // só quando há corpo (DELETE vai sem)
    if (prefer) headers.Prefer = prefer;
    if (range) { headers.Range = range; headers['Range-Unit'] = 'items'; }
    const pedido = () => chamar(`${C.SUPABASE_URL}/rest/v1/${caminho}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    // Falha de rede: tenta mais uma vez (menos no POST, que poderia duplicar)
    const r = await pedido().catch(async e => {
      if (method === 'POST') throw e;
      await esperar(700);
      return pedido();
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
  // o Supabase respondeu que a tabela de fiados não existe (v4-fiados.sql ainda não rodou)
  const semTabelaFiados = e => /fiados/i.test(e.message) && /could not find the table|does not exist|schema cache/i.test(e.message);

  return {
    configurado, login, sair, semTabelaFiados,
    sessao: () => sessao,
    perfis: () => rest('perfis?select=id,nome,cor&order=nome'),
    categorias: () => rest('categorias?select=*&order=nome'),
    lancamentos: () => todos('lancamentos?select=*&order=data.desc,id.desc'),
    // Com etiqueta (id_cliente): se o mesmo lançamento chegar duas vezes, o banco ignora o
    // segundo e aqui se busca o que já estava lá. Sem o v4-sem-internet.sql, envia sem etiqueta.
    criarLancamento: async d => {
      if (!d.id_cliente) return rest('lancamentos', { method: 'POST', body: d, ...volta }).then(r => r[0]);
      try {
        const r = await rest('lancamentos?on_conflict=id_cliente', { method: 'POST', body: d, prefer: 'return=representation,resolution=ignore-duplicates' });
        if (r?.length) return r[0];
        return (await rest(`lancamentos?id_cliente=eq.${d.id_cliente}&select=*`))[0];
      } catch (e) {
        if (e.rede || e.auth || !/id_cliente|on conflict/i.test(e.message)) throw e;
        const { id_cliente, ...sem } = d;
        return rest('lancamentos', { method: 'POST', body: sem, ...volta }).then(r => r[0]);
      }
    },
    editarLancamento: (id, d) => rest(`lancamentos?id=eq.${id}`, { method: 'PATCH', body: d, ...volta }).then(r => r[0]),
    excluirLancamento: id => rest(`lancamentos?id=eq.${id}`, { method: 'DELETE' }),
    criarCategoria: d => rest('categorias', { method: 'POST', body: d, ...volta }).then(r => r[0]),
    editarCategoria: (id, d) => rest(`categorias?id=eq.${id}`, { method: 'PATCH', body: d, ...volta }).then(r => r[0]),
    excluirCategoria: id => rest(`categorias?id=eq.${id}`, { method: 'DELETE' }),
    // Passa lançamentos, recorrentes e fiados de uma categoria para outra (antes de excluir)
    moverCategoria: async (de, para) => {
      await rest(`lancamentos?categoria_id=eq.${de}`, { method: 'PATCH', body: { categoria_id: para } });
      await rest(`recorrentes?categoria_id=eq.${de}`, { method: 'PATCH', body: { categoria_id: para } });
      // sem a tabela de fiados no banco (v4-fiados.sql não rodado), segue
      await rest(`fiados?categoria_id=eq.${de}`, { method: 'PATCH', body: { categoria_id: para } })
        .catch(e => { if (e.auth || !semTabelaFiados(e)) throw e; });
    },

    // V2: recorrentes
    recorrentes: () => rest('recorrentes?select=*&order=dia_mes'),
    criarRecorrente: d => rest('recorrentes', { method: 'POST', body: d, ...volta }).then(r => r[0]),
    editarRecorrente: (id, d) => rest(`recorrentes?id=eq.${id}`, { method: 'PATCH', body: d, ...volta }).then(r => r[0]),
    excluirRecorrente: id => rest(`recorrentes?id=eq.${id}`, { method: 'DELETE' }),
    gerarRecorrentes: () => rest('rpc/gerar_recorrentes', { method: 'POST', body: {} }),

    // V4: fiados (quem levou e ainda não pagou)
    fiados: () => todos('fiados?select=*&order=data.asc,id.asc'),
    criarFiado: d => rest('fiados', { method: 'POST', body: d, ...volta }).then(r => r[0]),
    editarFiado: (id, d) => rest(`fiados?id=eq.${id}`, { method: 'PATCH', body: d, ...volta }).then(r => r[0]),
    // devolve o que apagou: vazio quando o fiado já tinha sido recebido ou excluído em outro celular
    excluirFiado: id => rest(`fiados?id=eq.${id}`, { method: 'DELETE', ...volta }),
    // Cria a venda e apaga o fiado (ou só desconta, se pagou uma parte) no mesmo passo.
    // Sem valor, recebe tudo o que falta. "esperado" = pago e valor que a tela mostrava: o banco
    // recusa se o fiado mudou nesse meio-tempo (outro celular). Antes do v4-fiados-historico.sql
    // a função não conhece esses dois campos: aí tenta de novo sem eles (a 1ª chamada nem rodou).
    receberFiado: async (id, forma, data, valor = null, esperado = null) => {
      const base = { p_id: id, p_forma: forma, p_data: data, ...(valor != null ? { p_valor: valor } : {}) }
      const chamar = corpo => rest('rpc/receber_fiado', { method: 'POST', body: corpo }).then(r => (Array.isArray(r) ? r[0] : r))
      if (!esperado) return chamar(base)
      try {
        return await chamar({ ...base, p_pago_esperado: esperado.pago, p_valor_esperado: esperado.valor })
      } catch (e) {
        if (e.auth || !/could not find the function/i.test(e.message)) throw e
        return chamar(base)
      }
    },

    // V2: análise com IA (Edge Function que guarda a chave do Gemini)
    analisar: async dados => {
      await token(); await acordar();
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
