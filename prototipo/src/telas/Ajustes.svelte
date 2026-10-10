<script>
  import { ChevronRight, ScanFace, LogOut, Repeat, RefreshCw, Plus, GripVertical } from '@lucide/svelte'
  import { S, avisar } from '../lib/estado.svelte.js'
  import { nomeNatureza } from '../lib/dados.js'
  import { fmt } from '../lib/formato.js'

  let faceId = $state(true)
  let aba = $state('saida')
  const cats = $derived(S.categorias.filter(c => c.tipo === aba))
</script>

{#snippet opcao(Icone, titulo, sub, dir, acao)}
  <button class="flex w-full items-center gap-3.5 px-4 py-3.5 text-left not-last:border-b not-last:border-linha/60" onclick={acao}>
    <Icone size={19} class="shrink-0 text-txt-3" />
    <span class="min-w-0 flex-1"><span class="block text-[15px]">{titulo}</span>{#if sub}<span class="block text-[12px] text-txt-3">{sub}</span>{/if}</span>
    {#if dir}<span class="text-[13px] text-txt-2">{dir}</span>{/if}
    <ChevronRight size={17} class="text-txt-3" />
  </button>
{/snippet}

<div class="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
  <header class="flex items-center gap-4 pt-1 lg:col-span-2">
    <span class="grid size-14 place-items-center rounded-full text-[22px] font-semibold text-fundo" style="background:{S.perfil.cor}">{S.perfil.nome[0]}</span>
    <div>
      <h1 class="num text-[26px] font-semibold">{S.perfil.nome}</h1>
      <p class="text-[13px] text-txt-3">junior@exemplo.com</p>
    </div>
  </header>

  <div class="space-y-6">
    <section>
      <h2 class="mb-2 px-1 text-[13px] text-txt-3">Segurança</h2>
      <div class="overflow-hidden rounded-[22px] border border-linha bg-sup">
        <button class="flex w-full items-center gap-3.5 border-b border-linha/60 px-4 py-3.5 text-left" aria-pressed={faceId} onclick={() => (faceId = !faceId)}>
          <ScanFace size={19} class="text-txt-3" />
          <span class="flex-1"><span class="block text-[15px]">Face ID ao abrir</span><span class="text-[12px] text-txt-3">Depois de 5 minutos sem usar</span></span>
          <span class="relative h-7 w-12 rounded-full transition-colors {faceId ? 'bg-ambar' : 'bg-sup-3'}"><span class="absolute top-1 left-1 size-5 rounded-full bg-white transition-transform {faceId ? 'translate-x-5' : ''}"></span></span>
        </button>
        {@render opcao(LogOut, 'Sair da conta', 'Pede a senha na próxima vez', '', () => avisar('No protótipo não sai'))}
      </div>
    </section>

    <section>
      <h2 class="mb-2 px-1 text-[13px] text-txt-3">Automático</h2>
      <div class="overflow-hidden rounded-[22px] border border-linha bg-sup">
        {#each S.recorrentes as r}
          {@render opcao(Repeat, r.descricao, `Todo dia ${r.dia_mes}`, fmt(r.valor), () => {})}
        {/each}
      </div>
    </section>

    <section>
      <h2 class="mb-2 px-1 text-[13px] text-txt-3">App</h2>
      <div class="overflow-hidden rounded-[22px] border border-linha bg-sup">
        {@render opcao(RefreshCw, 'Atualizar dados', 'Atualiza sozinho a cada 30 segundos', '', () => avisar('Dados atualizados'))}
      </div>
      <p class="mt-4 text-center text-[12px] text-txt-3">Financeiro NP3D · versão 4.0 (protótipo)</p>
    </section>
  </div>

  <section>
    <div class="mb-2 flex items-center justify-between px-1">
      <h2 class="text-[13px] text-txt-3">Categorias</h2>
      <button class="-mr-2 flex h-10 items-center gap-1 px-2 text-[13px] font-medium text-ambar"><Plus size={15} />Nova</button>
    </div>
    <div class="mb-3 grid grid-cols-2 rounded-full bg-sup-2 p-1">
      {#each [['entrada', 'Entradas'], ['saida', 'Saídas']] as [v, r]}
        <button class="h-10 rounded-full text-[14px] font-medium transition-colors {aba === v ? 'bg-sup-3 text-txt' : 'text-txt-3'}" onclick={() => (aba = v)}>{r}</button>
      {/each}
    </div>
    <div class="overflow-hidden rounded-[22px] border border-linha bg-sup">
      {#each cats as c (c.id)}
        <div class="flex items-center gap-3 px-4 py-3 not-last:border-b not-last:border-linha/60">
          <GripVertical size={17} class="text-txt-3" />
          <span class="size-3 rounded-full" style="background:{c.cor}"></span>
          <span class="flex-1"><span class="block text-[15px]">{c.nome}</span><span class="text-[12px] text-txt-3">{nomeNatureza(c.natureza)}</span></span>
          <ChevronRight size={17} class="text-txt-3" />
        </div>
      {/each}
    </div>
  </section>
</div>
