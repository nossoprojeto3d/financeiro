<script>
  import { fly, fade } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { House, List, ChartColumn, Settings, Plus, CircleCheck, CircleAlert } from '@lucide/svelte'
  import Inicio from './telas/Inicio.svelte'
  import Historico from './telas/Historico.svelte'
  import Gestao from './telas/Gestao.svelte'
  import Ajustes from './telas/Ajustes.svelte'
  import Lancar from './componentes/Lancar.svelte'
  import { S, tela, irPara, abrirLancar, fecharLancar } from './lib/estado.svelte.js'

  const TELAS = { inicio: Inicio, historico: Historico, gestao: Gestao, ajustes: Ajustes }
  const NAV = [['inicio', 'Início', House], ['historico', 'Histórico', List], ['gestao', 'Gestão', ChartColumn], ['ajustes', 'Ajustes', Settings]]
  const Tela = $derived(TELAS[S.tela])

  // No Início do computador o lançamento já está na tela; no resto ele abre por cima
  const sobreposto = $derived(!!S.lancar && !(tela.largo && S.tela === 'inicio'))

  function novo() {
    if (tela.largo && S.tela === 'inicio') return document.querySelector('aside button[role=radio]')?.focus()
    abrirLancar('entrada')
  }
</script>

<div class="min-h-dvh lg:flex">
  <!-- Computador: menu lateral -->
  <nav class="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-linha px-4 py-6 lg:flex" aria-label="Navegação">
    <div class="mb-8 flex items-center gap-2.5 px-2">
      <img src="./favicon.svg" alt="" class="size-8" />
      <span class="num text-[17px] font-semibold">Financeiro</span>
    </div>
    <button class="mb-6 flex h-11 items-center justify-center gap-2 rounded-2xl bg-ambar text-[15px] font-semibold text-fundo hover:bg-ambar-forte" onclick={novo}>
      <Plus size={18} strokeWidth={2.4} /> Novo lançamento
    </button>
    {#each NAV as [id, rot, Icone]}
      <button class="mb-1 flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors {S.tela === id ? 'bg-sup-2 text-txt' : 'text-txt-2 hover:bg-sup'}" aria-current={S.tela === id ? 'page' : undefined} onclick={() => irPara(id)}>
        <Icone size={19} strokeWidth={S.tela === id ? 2.2 : 1.8} />{rot}
      </button>
    {/each}
    <div class="mt-auto flex items-center gap-3 px-2">
      <span class="grid size-9 place-items-center rounded-full text-[15px] font-semibold text-fundo" style="background:{S.perfil.cor}">{S.perfil.nome[0]}</span>
      <span class="text-[14px] text-txt-2">{S.perfil.nome}</span>
    </div>
  </nav>

  <main class="mx-auto w-full max-w-[1180px] px-4 pt-[max(16px,env(safe-area-inset-top))] pb-32 lg:px-8 lg:pt-6 lg:pb-10">
    {#key S.tela}
      <div in:fade={{ duration: 160 }}><Tela /></div>
    {/key}
  </main>

  <!-- Celular: barra inferior com o + no meio -->
  <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-fundo/85 pb-seguro backdrop-blur-xl lg:hidden" aria-label="Navegação">
    <div class="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
      {#each NAV as [id, rot, Icone], i}
        {#if i === 2}
          <div class="flex justify-center">
            <button class="-mt-7 grid size-15 place-items-center rounded-[22px] bg-ambar text-fundo shadow-[0_10px_30px_-8px_rgba(245,184,61,.55)] transition-transform active:scale-95" aria-label="Novo lançamento" onclick={novo}>
              <Plus size={28} strokeWidth={2.4} />
            </button>
          </div>
        {/if}
        <button class="flex h-full flex-col items-center justify-center gap-1 text-[11px] transition-colors {S.tela === id ? 'text-txt' : 'text-txt-3'}" aria-current={S.tela === id ? 'page' : undefined} onclick={() => irPara(id)}>
          <Icone size={22} strokeWidth={S.tela === id ? 2.2 : 1.7} />{rot}
        </button>
      {/each}
    </div>
  </nav>
</div>

<!-- Lançamento por cima: tela cheia no celular, gaveta à direita no computador -->
{#if sobreposto}
  {#if tela.largo}
    <div class="trava-rolagem fixed inset-0 z-40">
      <button class="absolute inset-0 bg-black/50" aria-label="Fechar" onclick={fecharLancar} transition:fade={{ duration: 180 }}></button>
      <div class="absolute inset-y-3 right-3 w-[420px] overflow-hidden rounded-[28px] border border-linha bg-sup" transition:fly={{ x: 440, duration: 300, easing: cubicOut }}>
        <Lancar modo="painel" />
      </div>
    </div>
  {:else}
    <div class="trava-rolagem fixed inset-0 z-40 bg-fundo" transition:fly={{ y: 800, duration: 340, easing: cubicOut, opacity: 1 }}>
      <Lancar modo="tela" />
    </div>
  {/if}
{/if}

{#if S.aviso}
  {#key S.aviso.id}
    <div class="pointer-events-none fixed inset-x-0 top-[max(14px,env(safe-area-inset-top))] z-[60] flex justify-center px-4" role="status" transition:fly={{ y: -24, duration: 220 }}>
      <div class="flex items-center gap-2 rounded-full border border-linha bg-sup-2 py-2.5 pr-5 pl-3.5 text-[14px] font-medium shadow-2xl">
        {#if S.aviso.tipo === 'erro'}<CircleAlert size={18} class="text-sai" />{:else}<CircleCheck size={18} class="text-ent" />{/if}
        {S.aviso.texto}
      </div>
    </div>
  {/key}
{/if}
