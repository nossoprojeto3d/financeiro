<script>
  import { ChevronRight, ScanFace, LogOut, Repeat, RefreshCw, Plus, GripVertical, Smartphone, Minus } from '@lucide/svelte'
  import Folha from '../componentes/Folha.svelte'
  import Teclado from '../componentes/Teclado.svelte'
  import Dinheiro from '../componentes/Dinheiro.svelte'
  import { Api } from '../lib/api.js'
  import { Lock } from '../lib/lock.js'
  import {
    S, VERSAO, cat, temOrdem, porOrdem, avisar, confirmar, tratarErro, sair, carregarTudo, ativarFaceId,
    criarCategoria, salvarCategoria, excluirCategoria, salvarOrdem, editarRecorrente, excluirRecorrente, abrirLancar, irPara,
  } from '../lib/estado.svelte.js'
  import { NATUREZAS, nomeNatureza, corSegura } from '../lib/dados.js'
  import { fmt, hoje } from '../lib/formato.js'

  let faceId = $state(Lock.ativo())
  let aba = $state('saida')
  const cats = $derived(S.categorias.filter(c => c.tipo === aba).sort(temOrdem() ? porOrdem : (a, b) => a.nome.localeCompare(b.nome)))
  let folha = $state(null) // { tipo: 'cat' | 'recs' | 'rec', ... }
  let ocupado = $state(false)

  async function alternarFaceId() {
    if (faceId) { Lock.desativar(); faceId = false; return avisar('Face ID desativado') }
    await ativarFaceId()
    faceId = Lock.ativo()
  }
  async function pedirSair() {
    if (await confirmar('Sair da conta neste aparelho?', { ok: 'Sair', perigo: false })) sair()
  }
  async function atualizar() {
    if (ocupado) return
    ocupado = true
    try { await carregarTudo(); if (!S.offline) avisar('Dados atualizados') } catch (e) { tratarErro(e) }
    finally { ocupado = false }
  }

  /* ---------- Categorias ---------- */
  function abrirCat(c = null) {
    folha = c
      ? { tipo: 'cat', c, nome: c.nome, natureza: c.natureza, catTipo: c.tipo, excluindo: false, destino: null }
      : { tipo: 'cat', c: null, nome: '', natureza: NATUREZAS[aba][0][0], catTipo: aba }
  }
  const usos = c => S.lancs.filter(l => l.categoria_id === c.id).length + S.recorrentes.filter(r => r.categoria_id === c.id).length
  async function salvarCat() {
    const f = folha, nome = f.nome.trim()
    if (!nome) return avisar('Dê um nome para a categoria.', 'erro')
    if (ocupado) return
    ocupado = true
    try {
      if (f.c) await salvarCategoria(f.c, { nome, natureza: f.natureza })
      else await criarCategoria({ nome, tipo: f.catTipo, natureza: f.natureza })
      folha = null
      avisar(f.c ? 'Categoria salva' : 'Categoria criada')
    } catch (e) { tratarErro(e) }
    finally { ocupado = false }
  }
  async function pedirExcluirCat() {
    const c = folha.c
    if (usos(c)) { folha.excluindo = true; return }
    if (await confirmar(`Excluir a categoria “${c.nome}”?`)) fazerExcluirCat(c, null)
  }
  async function fazerExcluirCat(c, destino) {
    if (ocupado) return
    ocupado = true
    try { await excluirCategoria(c, destino); folha = null; avisar('Categoria excluída') }
    catch (e) { tratarErro(e) }
    finally { ocupado = false }
  }

  // Arrastar pela alça para mudar a ordem. Durante o arraste só mexe com transform
  // (tirar a linha do lugar faz o iPhone cancelar o toque); a ordem muda ao soltar.
  let lista = $state()
  function arrastar(e, id) {
    e.preventDefault()
    const alca = e.currentTarget
    try { alca.setPointerCapture(e.pointerId) } catch (_) {}
    const linhas = [...lista.children]
    const linha = linhas.find(x => x.dataset.id === String(id))
    const de = linhas.indexOf(linha)
    const alturas = linhas.map(x => x.offsetHeight)
    const y0 = e.clientY + scrollY
    let yDedo = e.clientY, para = de, rolando
    S.arrastando = true
    linha.classList.add('relative', 'z-10', 'bg-sup-2', 'shadow-2xl')
    linhas.forEach(x => { if (x !== linha) x.style.transition = 'transform .18s' })
    const atualizarPos = () => {
      const dy = yDedo + scrollY - y0
      linha.style.transform = `translateY(${dy}px)`
      let pos = de, acum = 0
      if (dy > 0) for (let k = de + 1; k < linhas.length && dy > acum + alturas[k] / 2; k++) { acum += alturas[k]; pos = k }
      else for (let k = de - 1; k >= 0 && -dy > acum + alturas[k] / 2; k--) { acum += alturas[k]; pos = k }
      para = pos
      const h = alturas[de]
      linhas.forEach((x, k) => {
        if (x === linha) return
        const d = de < para && k > de && k <= para ? -h : de > para && k < de && k >= para ? h : 0
        x.style.transform = d ? `translateY(${d}px)` : ''
      })
    }
    const rolar = () => {
      const borda = 90, alto = innerHeight
      const v = yDedo < borda ? -(borda - yDedo) / 6 : yDedo > alto - borda ? (yDedo - (alto - borda)) / 6 : 0
      if (v) { scrollBy(0, v); atualizarPos() }
      rolando = requestAnimationFrame(rolar)
    }
    const mover = ev => { yDedo = ev.clientY; atualizarPos() }
    const soltar = () => {
      cancelAnimationFrame(rolando)
      alca.removeEventListener('pointermove', mover)
      alca.removeEventListener('pointerup', soltar)
      alca.removeEventListener('pointercancel', soltar)
      linhas.forEach(x => { x.style.transition = ''; x.style.transform = '' })
      linha.classList.remove('relative', 'z-10', 'bg-sup-2', 'shadow-2xl')
      S.arrastando = false
      if (para === de) return
      const ids = cats.map(c => c.id)
      ids.splice(para, 0, ids.splice(de, 1)[0])
      salvarOrdem(ids)
    }
    alca.addEventListener('pointermove', mover)
    alca.addEventListener('pointerup', soltar)
    alca.addEventListener('pointercancel', soltar)
    rolando = requestAnimationFrame(rolar)
  }

  /* ---------- Lançamentos que se repetem ---------- */
  const recs = $derived([...S.recorrentes].sort((x, y) => y.ativa - x.ativa || x.dia_mes - y.dia_mes))
  function abrirRec(r) {
    folha = { tipo: 'rec', r, centavos: Math.round(r.valor * 100), dia: r.dia_mes, descricao: r.descricao || '' }
  }
  function teclaRec(t) {
    const f = folha
    if (t === 'limpar') f.centavos = 0
    else if (t === 'apagar') f.centavos = Math.floor(f.centavos / 10)
    else if (String(f.centavos).length + t.length <= 10) f.centavos = Number(String(f.centavos) + t)
  }
  async function salvarRec(dados, msg) {
    if (ocupado) return
    ocupado = true
    try { await editarRecorrente(folha.r, dados); folha = { tipo: 'recs' }; avisar(msg) }
    catch (e) { tratarErro(e) }
    finally { ocupado = false }
  }
  function salvarRecForm() {
    const f = folha
    if (!f.centavos) return avisar('Digite o valor.', 'erro')
    salvarRec({ valor: f.centavos / 100, dia_mes: f.dia, descricao: f.descricao.trim() || null }, 'Alterações salvas')
  }
  function pausarRec() {
    const r = folha.r
    // Ao retomar, não lança os meses que ficaram pausados
    const dados = r.ativa ? { ativa: false } : { ativa: true, gerado_ate: hoje() > (r.gerado_ate || '') ? hoje() : r.gerado_ate }
    salvarRec(dados, r.ativa ? 'Pausado: não será mais lançado' : 'Retomado: volta no próximo vencimento')
  }
  async function excluirRec() {
    const r = folha.r
    if (!await confirmar('Excluir esse lançamento mensal? O que já foi lançado continua no histórico.')) return
    try { await excluirRecorrente(r); folha = { tipo: 'recs' }; avisar('Lançamento mensal excluído') }
    catch (e) { tratarErro(e) }
  }
  function novoMensal() {
    folha = null
    irPara('inicio')
    abrirLancar('saida', null, { repetir: true })
    avisar('Preencha o lançamento mensal')
  }
  const carregadoAs = $derived(S.carregadoEm ? new Date(S.carregadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '')
</script>

{#snippet opcao(Icone, titulo, sub, dir, acao)}
  <button class="flex w-full items-center gap-3.5 px-4 py-3.5 text-left not-last:border-b not-last:border-linha/60" onclick={acao}>
    <Icone size={19} class="shrink-0 text-txt-3" />
    <span class="min-w-0 flex-1"><span class="block text-[15px]">{titulo}</span>{#if sub}<span class="block text-[12px] text-txt-3">{sub}</span>{/if}</span>
    {#if dir}<span class="text-[13px] text-txt-2">{dir}</span>{/if}
    <ChevronRight size={17} class="shrink-0 text-txt-3" />
  </button>
{/snippet}

{#snippet chip(on, texto, acao)}
  <button class="h-10 rounded-full px-4 text-[14px] font-medium {on ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={acao}>{texto}</button>
{/snippet}

<div class="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
  <header class="flex items-center gap-4 pt-1 lg:col-span-2">
    <span class="grid size-14 place-items-center rounded-full text-[22px] font-semibold text-fundo" style="background:{corSegura(S.perfil.cor)}">{S.perfil.nome[0]}</span>
    <div class="min-w-0">
      <h1 class="num text-[26px] font-semibold">{S.perfil.nome}</h1>
      <p class="truncate text-[13px] text-txt-3">{Api.sessao()?.user.email}</p>
    </div>
  </header>

  <div class="space-y-6">
    <section>
      <h2 class="mb-2 px-1 text-[13px] text-txt-3">Segurança</h2>
      <div class="overflow-hidden rounded-[22px] border border-linha bg-sup">
        {#if Lock.celular()}
          <button class="flex w-full items-center gap-3.5 border-b border-linha/60 px-4 py-3.5 text-left" aria-pressed={faceId} onclick={alternarFaceId}>
            <ScanFace size={19} class="text-txt-3" />
            <span class="flex-1"><span class="block text-[15px]">Face ID ao abrir</span><span class="text-[12px] text-txt-3">Depois de 5 minutos sem usar</span></span>
            <span class="relative h-7 w-12 shrink-0 rounded-full transition-colors {faceId ? 'bg-ambar' : 'bg-sup-3'}"><span class="absolute top-1 left-1 size-5 rounded-full bg-white transition-transform {faceId ? 'translate-x-5' : ''}"></span></span>
          </button>
        {/if}
        {@render opcao(LogOut, 'Sair da conta', 'Pede a senha na próxima vez', '', pedirSair)}
      </div>
    </section>

    <section>
      <h2 class="mb-2 px-1 text-[13px] text-txt-3">Automático</h2>
      <div class="overflow-hidden rounded-[22px] border border-linha bg-sup">
        {@render opcao(Repeat, 'Lançamentos que se repetem', 'Assinaturas e contas lançadas sozinhas todo mês', String(S.recorrentes.filter(r => r.ativa).length || ''), () => (folha = { tipo: 'recs' }))}
      </div>
    </section>

    <section>
      <h2 class="mb-2 px-1 text-[13px] text-txt-3">App</h2>
      <div class="overflow-hidden rounded-[22px] border border-linha bg-sup">
        {@render opcao(RefreshCw, ocupado ? 'Atualizando…' : 'Atualizar dados', `Atualiza sozinho a cada 30 segundos.${carregadoAs ? ` Última vez às ${carregadoAs}.` : ''}`, '', atualizar)}
        <div class="flex items-center gap-3.5 px-4 py-3.5">
          <Smartphone size={19} class="shrink-0 text-txt-3" />
          <span><span class="block text-[15px]">Instalar no iPhone</span><span class="text-[12px] text-txt-3">No Safari: Compartilhar › Adicionar à Tela de Início</span></span>
        </div>
      </div>
      <p class="mt-4 text-center text-[12px] text-txt-3">Financeiro NP3D · versão {VERSAO}</p>
    </section>
  </div>

  <section>
    <div class="mb-2 flex items-center justify-between px-1">
      <h2 class="text-[13px] text-txt-3">Categorias</h2>
      <button class="-mr-2 flex h-10 items-center gap-1 px-2 text-[13px] font-medium text-ambar" onclick={() => abrirCat()}><Plus size={15} />Nova</button>
    </div>
    <div class="mb-3 grid grid-cols-2 rounded-full bg-sup-2 p-1">
      {#each [['entrada', 'Entradas'], ['saida', 'Saídas']] as [v, r]}
        <button class="h-10 rounded-full text-[14px] font-medium transition-colors {aba === v ? 'bg-sup-3 text-txt' : 'text-txt-3'}" onclick={() => (aba = v)}>{r}</button>
      {/each}
    </div>
    <div class="overflow-hidden rounded-[22px] border border-linha bg-sup" bind:this={lista}>
      {#each cats as c (c.id)}
        <div class="flex items-center not-last:border-b not-last:border-linha/60" data-id={c.id}>
          {#if temOrdem()}
            <button class="grid h-14 w-11 shrink-0 cursor-grab touch-none place-items-center text-txt-3" aria-label="Arrastar para mudar a ordem" onpointerdown={e => arrastar(e, c.id)}><GripVertical size={18} /></button>
          {/if}
          <button class="flex min-h-14 flex-1 items-center gap-3 py-3 pr-4 text-left {temOrdem() ? '' : 'pl-4'}" onclick={() => abrirCat(c)}>
            <span class="size-3 shrink-0 rounded-full" style="background:{c.cor}"></span>
            <span class="min-w-0 flex-1"><span class="block truncate text-[15px]">{c.nome}</span><span class="text-[12px] text-txt-3">{nomeNatureza(c.natureza)}</span></span>
            <ChevronRight size={17} class="shrink-0 text-txt-3" />
          </button>
        </div>
      {/each}
    </div>
  </section>
</div>

{#if folha?.tipo === 'cat'}
  {@const f = folha}
  <Folha titulo={f.c ? 'Editar categoria' : 'Nova categoria'} aoFechar={() => (folha = null)}>
    {#if !f.c}
      <div class="mb-4 grid grid-cols-2 rounded-full bg-sup-2 p-1">
        {#each [['entrada', 'Entrada'], ['saida', 'Saída']] as [v, r]}
          <button class="h-10 rounded-full text-[14px] font-medium {f.catTipo === v ? 'bg-sup-3 text-txt' : 'text-txt-3'}" onclick={() => { f.catTipo = v; f.natureza = NATUREZAS[v][0][0] }}>{r}</button>
        {/each}
      </div>
    {/if}
    <input bind:value={f.nome} maxlength="40" placeholder="Nome da categoria" enterkeyhint="done" aria-label="Nome"
      class="h-12 w-full rounded-2xl border border-linha bg-transparent px-4 text-[16px] placeholder:text-txt-3 focus:border-sup-3 focus:outline-none" />
    <p class="mt-4 mb-2 text-[13px] text-txt-3">Conta como</p>
    <div class="flex flex-wrap gap-2">
      {#each NATUREZAS[f.catTipo] as [v, r]}{@render chip(f.natureza === v, r, () => (f.natureza = v))}{/each}
    </div>
    <p class="mt-2 text-[12px] leading-relaxed text-txt-3">{NATUREZAS[f.catTipo].find(n => n[0] === f.natureza)?.[2]}</p>

    {#if f.excluindo}
      {@const outras = S.categorias.filter(x => x.tipo === f.c.tipo && x.id !== f.c.id).sort((a, b) => a.nome.localeCompare(b.nome))}
      <div class="mt-5 rounded-2xl bg-sai-fundo/50 p-4">
        <p class="mb-2 text-[13px] text-txt-2">Mover {usos(f.c)} lançamento{usos(f.c) === 1 ? '' : 's'} para</p>
        {#if outras.length}
          <div class="flex flex-wrap gap-2">{#each outras as x}{@render chip(f.destino === x.id, x.nome, () => (f.destino = x.id))}{/each}</div>
        {:else}
          <p class="text-[13px] text-txt-3">Crie outra categoria de {f.c.tipo === 'entrada' ? 'entrada' : 'saída'} primeiro, para receber esses lançamentos.</p>
        {/if}
      </div>
      <button class="mt-5 h-12 w-full rounded-2xl bg-sai text-[15px] font-semibold text-fundo disabled:opacity-40" disabled={!f.destino || ocupado} onclick={() => fazerExcluirCat(f.c, f.destino)}>{ocupado ? 'Excluindo…' : 'Mover e excluir'}</button>
      <button class="mt-2 h-12 w-full rounded-2xl text-[15px] text-txt-2" onclick={() => { f.excluindo = false; f.destino = null }}>Cancelar</button>
    {:else}
      <button class="mt-6 h-12 w-full rounded-2xl bg-ambar text-[15px] font-semibold text-fundo disabled:opacity-60" disabled={ocupado} onclick={salvarCat}>{ocupado ? 'Salvando…' : f.c ? 'Salvar alterações' : 'Criar categoria'}</button>
      {#if f.c}<button class="mt-2 h-12 w-full rounded-2xl text-[15px] font-medium text-sai" onclick={pedirExcluirCat}>Excluir categoria</button>{/if}
    {/if}
  </Folha>
{/if}

{#if folha?.tipo === 'recs'}
  <Folha titulo="Lançamentos que se repetem" aoFechar={() => (folha = null)}>
    {#if recs.length}
      <div class="overflow-hidden rounded-2xl bg-sup-2/50">
        {#each recs as r (r.id)}
          <button class="flex w-full items-center gap-3 px-4 py-3 text-left not-last:border-b not-last:border-linha/60 {r.ativa ? '' : 'opacity-50'}" onclick={() => abrirRec(r)}>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[15px]">{r.descricao || cat(r.categoria_id)?.nome || '—'}</span>
              <span class="text-[12px] text-txt-3">Todo dia {r.dia_mes}{r.ativa ? '' : ', pausado'}</span>
            </span>
            <Dinheiro valor={r.tipo === 'entrada' ? r.valor : -r.valor} sinal moeda={false} class="text-[15px] font-semibold {r.tipo === 'entrada' ? 'text-ent' : ''}" />
          </button>
        {/each}
      </div>
    {:else}
      <p class="text-[14px] text-txt-2">Nenhum ainda. Ao lançar, ligue “Repetir todo mês” em Detalhes.</p>
    {/if}
    <button class="mt-4 h-12 w-full rounded-2xl border border-dashed border-sup-3 text-[15px] text-txt-2" onclick={novoMensal}>+ Criar lançamento mensal</button>
  </Folha>
{/if}

{#if folha?.tipo === 'rec'}
  {@const f = folha}
  <Folha titulo={cat(f.r.categoria_id)?.nome || 'Lançamento mensal'} aoFechar={() => (folha = { tipo: 'recs' })}>
    <p class="text-center text-[13px] text-txt-3">{f.r.tipo === 'entrada' ? 'Entrada mensal' : 'Saída mensal'}</p>
    <div class="py-2 text-center {f.r.tipo === 'entrada' ? 'text-ent' : 'text-sai'}"><Dinheiro valor={f.centavos / 100} class="text-[40px] font-semibold" /></div>
    <Teclado aoTocar={teclaRec} compacto />
    <div class="mt-4 flex items-center justify-between rounded-2xl bg-sup-2/50 px-4 py-2">
      <span class="text-[15px]">Dia do mês</span>
      <span class="flex items-center gap-1">
        <button class="grid size-10 place-items-center rounded-full text-txt-2 disabled:opacity-30" aria-label="Dia anterior" disabled={f.dia <= 1} onclick={() => f.dia--}><Minus size={18} /></button>
        <span class="num w-8 text-center text-[18px] font-semibold">{f.dia}</span>
        <button class="grid size-10 place-items-center rounded-full text-txt-2 disabled:opacity-30" aria-label="Próximo dia" disabled={f.dia >= 31} onclick={() => f.dia++}><Plus size={18} /></button>
      </span>
    </div>
    <input bind:value={f.descricao} maxlength="120" placeholder="Descrição" enterkeyhint="done" aria-label="Descrição"
      class="mt-3 h-12 w-full rounded-2xl border border-linha bg-transparent px-4 text-[16px] placeholder:text-txt-3 focus:border-sup-3 focus:outline-none" />
    <p class="mt-3 text-[12px] text-txt-3">As mudanças valem para os próximos meses. O que já foi lançado continua no histórico.</p>
    <button class="mt-4 h-12 w-full rounded-2xl bg-ambar text-[15px] font-semibold text-fundo disabled:opacity-60" disabled={ocupado} onclick={salvarRecForm}>{ocupado ? 'Salvando…' : 'Salvar alterações'}</button>
    <div class="mt-2 grid grid-cols-2 gap-2">
      <button class="h-12 rounded-2xl bg-sup-3 text-[15px] font-medium" disabled={ocupado} onclick={pausarRec}>{f.r.ativa ? 'Pausar' : 'Retomar'}</button>
      <button class="h-12 rounded-2xl text-[15px] font-medium text-sai" onclick={excluirRec}>Excluir</button>
    </div>
  </Folha>
{/if}
