<script>
  import Dinheiro from './Dinheiro.svelte'
  import { cat, perfil, S } from '../lib/estado.svelte.js'
  let { l, aoAbrir } = $props()
  const c = $derived(cat(l.categoria_id))
  const quem = $derived(perfil(l.usuario_id))
</script>

<button class="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-sup-2/60 active:bg-sup-2" onclick={() => aoAbrir(l)}>
  <span class="grid size-10 shrink-0 place-items-center rounded-[14px]" style="background:color-mix(in oklab, {c?.cor} 16%, transparent)">
    <span class="flex flex-col items-center gap-[3px]" aria-hidden="true">
      <span class="h-[3px] w-2 rounded-full opacity-50" style="background:{c?.cor}"></span>
      <span class="h-[3px] w-3 rounded-full opacity-75" style="background:{c?.cor}"></span>
      <span class="h-[3px] w-4 rounded-full" style="background:{c?.cor}"></span>
    </span>
  </span>
  <span class="min-w-0 flex-1">
    <span class="block truncate text-[15px] text-txt">{l.descricao || c?.nome}</span>
    <span class="block truncate text-[13px] text-txt-3">{l.descricao ? c?.nome : ''}{#if quem && quem.id !== S.perfil.id}{l.descricao ? ' · ' : ''}{quem.nome}{/if}</span>
  </span>
  <Dinheiro valor={l.tipo === 'entrada' ? l.valor : -l.valor} sinal moeda={false} class="text-[16px] font-semibold {l.tipo === 'entrada' ? 'text-ent' : 'text-txt'}" />
</button>
