<script>
  import { X, Trash2, CalendarDays, Wallet, User, Repeat, ChevronRight, Check, LayoutGrid } from '@lucide/svelte'
  import Teclado from './Teclado.svelte'
  import Folha from './Folha.svelte'
  import Dinheiro from './Dinheiro.svelte'
  import { S, cat, perfil, categoriasDoTipo, abrirLancar, fecharLancar, salvarLanc, excluirLanc, criarCategoria, avisar, tratarErro } from '../lib/estado.svelte.js'
  import { NATUREZAS, nomeNatureza, PAGAMENTOS } from '../lib/dados.js'
  import { hoje, ontem, dataBonita, deISO } from '../lib/formato.js'

  // modo 'tela' = celular (tela cheia); 'painel' = computador (fixo ao lado)
  // fixo = painel do Início no computador: depois de lançar, já abre um novo em branco
  let { modo = 'tela', fixo = false } = $props()

  if (!S.lancar) abrirLancar('entrada')
  // o painel fixo nunca fica vazio (ex.: tocar em Início estando no Início descarta o formulário em branco)
  $effect(() => { if (fixo && !S.lancar) abrirLancar('entrada') })
  const f = $derived(S.lancar)
  const c = $derived(f ? cat(f.categoria_id) : null)
  const cats = $derived(f ? categoriasDoTipo(f.tipo) : [])
  const rapidas = $derived.by(() => {
    const top = cats.slice(0, modo === 'painel' ? 3 : 5)
    // a categoria escolhida pela lista completa também aparece na fila
    // (compara pelo id: a lista vem do estado reativo e o objeto da categoria não é o mesmo)
    const escolhida = cats.find(k => k.id === f.categoria_id)
    if (escolhida && !top.some(k => k.id === escolhida.id)) top.unshift(escolhida)
    return top
  })

  let folha = $state(null) // 'cats' | 'detalhes' | 'excluir'
  let falta = $state(null) // campo que falta preencher: 'cat' | 'desc' (treme)
  let enviando = $state(false)
  let tentarDeNovo = $state(false)
  let campoDesc = $state()
  let nova = $state(null) // nova categoria sendo criada: { nome, natureza }

  function tecla(t) {
    if (t === 'limpar') f.centavos = 0
    else if (t === 'apagar') f.centavos = Math.floor(f.centavos / 10)
    else if (String(f.centavos).length + t.length <= 10) f.centavos = Number(String(f.centavos) + t)
  }

  function trocarTipo(tipo) {
    if (f.tipo === tipo) return
    f.tipo = tipo
    f.categoria_id = null
  }

  // No computador, os números do teclado físico também funcionam
  function teclaFisica(e) {
    if (!f || modo !== 'painel' || folha) return
    if (e.key === 'Escape' && !fixo) return cancelar()
    if (e.target.matches?.('input, textarea, select')) return
    if (/^[0-9]$/.test(e.key)) { tecla(e.key); e.preventDefault() }
    else if (e.key === 'Backspace') { tecla('apagar'); e.preventDefault() }
    else if (e.key === 'Enter') { lancar(); e.preventDefault() }
  }

  const marcarFalta = campo => { falta = campo; setTimeout(() => (falta = null), 600) }

  // Valor, categoria e descrição são obrigatórios; o resto é opcional
  async function lancar() {
    // toque duplo rápido: o botão só desativa na próxima atualização da tela, então trava aqui
    if (enviando) return
    if (!f.centavos) return avisar('Digite o valor.', 'erro')
    if (!f.categoria_id) { marcarFalta('cat'); return avisar('Escolha a categoria.', 'erro') }
    if (!f.descricao.trim()) { marcarFalta('desc'); campoDesc?.focus(); return avisar('Escreva a descrição.', 'erro') }
    enviando = true
    const editando = !!f.id, tipo = f.tipo, mensal = f.repetir
    try {
      await salvarLanc(f)
      tentarDeNovo = false
      avisar(editando ? 'Alterações salvas' : mensal ? 'Lançamento mensal criado' : tipo === 'entrada' ? 'Entrada lançada' : 'Saída lançada')
      if (fixo) abrirLancar(editando ? 'entrada' : tipo)
      else fecharLancar()
    } catch (e) {
      tentarDeNovo = true
      tratarErro(e)
    } finally {
      enviando = false
    }
  }

  async function excluir() {
    if (enviando) return
    enviando = true
    try {
      await excluirLanc(f.id)
      folha = null
      avisar('Lançamento excluído')
      cancelar()
    } catch (e) { tratarErro(e) }
    finally { enviando = false }
  }

  async function criarNova() {
    const nome = (nova?.nome || '').trim()
    if (!nome) return avisar('Dê um nome para a categoria.', 'erro')
    try {
      const c = await criarCategoria({ nome, tipo: f.tipo, natureza: nova.natureza })
      f.categoria_id = c.id
      nova = null
      folha = null
      avisar(`Categoria “${nome}” criada`)
    } catch (e) { tratarErro(e) }
  }
  const temRecorrente = $derived(!!(f?.id && f.recorrente_id && S.recorrentes.some(r => r.id === f.recorrente_id)))

  function cancelar() {
    if (fixo) abrirLancar('entrada')
    else fecharLancar()
  }

  const resumoData = $derived(f ? (f.repetir ? `Todo dia ${deISO(f.data).getDate()}` : dataBonita(f.data)) : '')
  const corTipo = $derived(f?.tipo === 'saida' ? 'text-sai' : 'text-ent')
</script>

<svelte:window onkeydown={teclaFisica} />

{#if f}
  <div class="flex h-full flex-col {modo === 'tela' ? 'pt-seguro' : ''}">
    <!-- Topo -->
    <div class="flex items-center gap-2 px-4 pt-3 {modo === 'painel' ? 'px-5 pt-5' : ''}">
      {#if !fixo || f.id}
        <button class="grid size-10 shrink-0 place-items-center rounded-full text-txt-2 hover:bg-sup-2" aria-label="Fechar" onclick={cancelar}><X size={22} /></button>
      {/if}
      {#if f.id}
        <p class="flex-1 text-[15px] font-medium text-txt-2">Editando {f.tipo === 'entrada' ? 'entrada' : 'saída'}</p>
        <button class="grid size-10 shrink-0 place-items-center rounded-full text-txt-3 hover:bg-sai-fundo hover:text-sai" aria-label="Excluir lançamento" onclick={() => (folha = 'excluir')}><Trash2 size={19} /></button>
      {:else}
        <div class="relative mx-auto grid w-full max-w-[260px] grid-cols-2 rounded-full bg-sup-2 p-1 " role="radiogroup" aria-label="Tipo">
          <span class="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full transition-transform duration-300 ease-mola {f.tipo === 'saida' ? 'translate-x-full bg-sai-fundo' : 'bg-ent-fundo'}"></span>
          {#each [['entrada', 'Entrada'], ['saida', 'Saída']] as [v, r]}
            <button role="radio" aria-checked={f.tipo === v} class="relative z-10 h-10 rounded-full text-[15px] font-semibold transition-colors {f.tipo === v ? (v === 'entrada' ? 'text-ent' : 'text-sai') : 'text-txt-3'}" onclick={() => trocarTipo(v)}>{r}</button>
          {/each}
        </div>
        {#if !fixo}<span class="size-10 shrink-0"></span>{/if}
      {/if}
    </div>

    <!-- Valor -->
    <div class="flex flex-1 flex-col items-center justify-center px-5 py-3" aria-live="polite">
      <div class="transition-colors {f.centavos ? corTipo : 'text-txt-3'}">
        <Dinheiro valor={f.centavos / 100} class="text-[clamp(44px,12vw,60px)] leading-none font-semibold" />
      </div>
      {#if c}
        <p class="mt-2.5 text-[13px] text-txt-3">{nomeNatureza(c.natureza)}</p>
      {/if}
    </div>

    <div class="space-y-3 px-4 {modo === 'painel' ? 'px-5' : ''}">
      <!-- Categoria -->
      <div class="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] {falta === 'cat' ? 'animate-[tremer_.4s]' : ''} {modo === 'painel' ? 'flex-wrap overflow-visible' : ''}">
        {#each rapidas as k (k.id)}
          {@const on = f.categoria_id === k.id}
          <button
            class="flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[14px] font-medium transition-colors {on ? 'border-transparent bg-txt text-fundo' : 'border-linha text-txt-2 hover:border-sup-3'}"
            onclick={() => (f.categoria_id = on ? null : k.id)}
          >
            <span class="size-2.5 rounded-full ring-2 ring-black/20" style="background:{k.cor}"></span>{k.nome}
          </button>
        {/each}
        <button class="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-sup-3 px-3.5 text-[14px] text-txt-2" onclick={() => (folha = 'cats')}>
          <LayoutGrid size={15} /> Todas
        </button>
      </div>

      <input
        bind:this={campoDesc}
        bind:value={f.descricao}
        onkeydown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        maxlength="120"
        enterkeyhint="done"
        class="h-12 w-full rounded-2xl border bg-transparent px-4 text-[16px] text-txt placeholder:text-txt-3 focus:border-sup-3 focus:outline-none {falta === 'desc' ? 'animate-[tremer_.4s] border-sai' : 'border-linha'}"
        placeholder={f.tipo === 'entrada' ? 'Descrição · ex.: pedido Shopee #1234' : 'Descrição · ex.: 3 rolos PLA preto'}
      />

      <!-- Detalhes em uma linha: cada um mostra o que está valendo -->
      <!-- (numa linha só: o que não couber some com reticências, e "Detalhes" vira só a seta) -->
      <button class="flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-2xl px-1 text-left text-[13px] whitespace-nowrap text-txt-2" onclick={() => (folha = 'detalhes')}>
        <span class="flex shrink-0 items-center gap-1.5"><CalendarDays size={15} class="text-txt-3" />{resumoData}</span>
        {#if f.forma_pagamento}<span class="flex min-w-0 items-center gap-1.5"><Wallet size={15} class="shrink-0 text-txt-3" /><span class="truncate">{f.forma_pagamento}</span></span>{/if}
        {#if f.usuario_id !== S.perfil.id}<span class="flex shrink-0 items-center gap-1.5"><User size={15} class="text-txt-3" />{perfil(f.usuario_id)?.nome}</span>{/if}
        <span class="ml-auto flex shrink-0 items-center text-txt-3">{#if !f.forma_pagamento && f.usuario_id === S.perfil.id}Detalhes{/if}<ChevronRight size={16} /></span>
      </button>
    </div>

    <div class="px-3 pt-3 {modo === 'painel' ? 'px-5' : ''}">
      <Teclado aoTocar={tecla} compacto={modo === 'painel'} />
    </div>

    <div class="px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] {modo === 'painel' ? 'px-5 pb-5' : ''}">
      <button
        class="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-semibold text-fundo transition-[transform,opacity] active:scale-[0.98] disabled:opacity-60 {f.tipo === 'saida' ? 'bg-sai' : 'bg-ent'}"
        disabled={enviando}
        onclick={lancar}
      >
        {#if enviando}<span class="size-5 animate-spin rounded-full border-2 border-fundo/30 border-t-fundo"></span>
        {:else if tentarDeNovo}Tentar de novo
        {:else if f.id}<Check size={20} />Salvar alterações
        {:else}{f.repetir ? 'Criar lançamento mensal' : f.tipo === 'entrada' ? 'Lançar entrada' : 'Lançar saída'}{/if}
      </button>
    </div>
  </div>

  {#if folha === 'cats'}
    <Folha titulo="Categoria" aoFechar={() => { folha = null; nova = null }}>
      {#each NATUREZAS[f.tipo] as [nat, nome]}
        {@const lista = cats.filter(k => k.natureza === nat)}
        {#if lista.length}
          <p class="mt-3 mb-1.5 text-[13px] text-txt-3 first:mt-0">{nome}</p>
          <div class="overflow-hidden rounded-2xl bg-sup-2/50">
            {#each lista as k}
              <button class="flex h-13 w-full items-center gap-3 px-4 text-left text-[15px] not-last:border-b not-last:border-linha/60" onclick={() => { f.categoria_id = k.id; folha = null }}>
                <span class="size-3 rounded-full" style="background:{k.cor}"></span>
                <span class="flex-1">{k.nome}</span>
                {#if f.categoria_id === k.id}<Check size={18} class="text-ambar" />{/if}
              </button>
            {/each}
          </div>
        {/if}
      {/each}
      {#if nova}
        <div class="mt-4 rounded-2xl bg-sup-2/50 p-4">
          <input bind:value={nova.nome} maxlength="40" placeholder="Nome da categoria" enterkeyhint="done"
            class="h-12 w-full rounded-2xl border border-linha bg-transparent px-4 text-[16px] placeholder:text-txt-3 focus:border-sup-3 focus:outline-none" />
          <p class="mt-3 mb-2 text-[13px] text-txt-3">Conta como</p>
          <div class="flex flex-wrap gap-2">
            {#each NATUREZAS[f.tipo] as [v, r]}
              <button class="h-10 rounded-full px-4 text-[14px] font-medium {nova.natureza === v ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => (nova.natureza = v)}>{r}</button>
            {/each}
          </div>
          <p class="mt-2 text-[12px] text-txt-3">{NATUREZAS[f.tipo].find(n => n[0] === nova.natureza)?.[2]}</p>
          <button class="mt-4 h-12 w-full rounded-2xl bg-ambar text-[15px] font-semibold text-fundo" onclick={criarNova}>Criar e usar</button>
        </div>
      {:else}
        <button class="mt-4 h-12 w-full rounded-2xl border border-dashed border-sup-3 text-[15px] text-txt-2" onclick={() => (nova = { nome: '', natureza: NATUREZAS[f.tipo][0][0] })}>+ Nova categoria</button>
      {/if}
    </Folha>
  {/if}

  {#if folha === 'detalhes'}
    <Folha titulo="Detalhes" aoFechar={() => (folha = null)}>
      <p class="mb-2 text-[13px] text-txt-3">Data</p>
      <div class="flex gap-2">
        {#each [[hoje(), 'Hoje'], [ontem(), 'Ontem']] as [d, r]}
          <button class="h-10 rounded-full px-4 text-[14px] font-medium {f.data === d ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => (f.data = d)}>{r}</button>
        {/each}
        <input type="date" bind:value={f.data} max={hoje()} aria-label="Outra data"
          class="h-10 min-w-0 flex-1 rounded-full border px-3 text-[16px] [color-scheme:dark] {f.data !== hoje() && f.data !== ontem() ? 'border-transparent bg-txt text-fundo' : 'border-linha bg-transparent text-txt-2'}" />
      </div>

      {#if !f.id}
        <button class="mt-5 flex w-full items-center gap-3 rounded-2xl bg-sup-2/50 p-4 text-left" aria-pressed={f.repetir} onclick={() => (f.repetir = !f.repetir)}>
          <Repeat size={18} class="text-txt-3" />
          <span class="flex-1"><span class="block text-[15px]">Repetir todo mês</span><span class="text-[13px] text-txt-3">{f.repetir ? `Lança sozinho todo dia ${deISO(f.data).getDate()}` : 'Para assinaturas e contas do mês'}</span></span>
          <span class="relative h-7 w-12 rounded-full transition-colors {f.repetir ? 'bg-ambar' : 'bg-sup-3'}"><span class="absolute top-1 left-1 size-5 rounded-full bg-white transition-transform {f.repetir ? 'translate-x-5' : ''}"></span></span>
        </button>
      {/if}

      <p class="mt-5 mb-2 text-[13px] text-txt-3">Forma de pagamento</p>
      <div class="flex flex-wrap gap-2">
        {#each PAGAMENTOS as p}
          <button class="h-10 rounded-full px-4 text-[14px] font-medium {f.forma_pagamento === p ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => (f.forma_pagamento = f.forma_pagamento === p ? '' : p)}>{p}</button>
        {/each}
      </div>

      <p class="mt-5 mb-2 text-[13px] text-txt-3">Quem fez</p>
      <div class="flex gap-2">
        {#each S.perfis as p}
          <button class="flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium {f.usuario_id === p.id ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => (f.usuario_id = p.id)}>
            <span class="size-2.5 rounded-full" style="background:{p.cor}"></span>{p.nome}
          </button>
        {/each}
      </div>
      {#if temRecorrente}
        <p class="mt-5 rounded-2xl bg-sup-2/50 p-4 text-[13px] leading-relaxed text-txt-2">Esse lançamento se repete todo mês. Para mudar o valor dos próximos ou pausar, vá em Ajustes › Lançamentos que se repetem.</p>
      {/if}
      <button class="mt-6 h-12 w-full rounded-2xl bg-sup-3 text-[15px] font-semibold" onclick={() => (folha = null)}>Pronto</button>
    </Folha>
  {/if}

  {#if folha === 'excluir'}
    <Folha titulo="Excluir lançamento?" aoFechar={() => (folha = null)}>
      <p class="text-[15px] text-txt-2">O valor sai do caixa e não dá para desfazer.</p>
      <div class="mt-5 grid grid-cols-2 gap-2">
        <button class="h-12 rounded-2xl bg-sup-3 text-[15px] font-semibold" onclick={() => (folha = null)}>Cancelar</button>
        <button class="h-12 rounded-2xl bg-sai text-[15px] font-semibold text-fundo disabled:opacity-60" disabled={enviando} onclick={excluir}>{enviando ? 'Excluindo…' : 'Excluir'}</button>
      </div>
    </Folha>
  {/if}
{/if}

<style>
  @keyframes -global-tremer {
    0%, 100% { transform: translateX(0) }
    25% { transform: translateX(-6px) }
    75% { transform: translateX(6px) }
  }
</style>
