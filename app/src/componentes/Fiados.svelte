<script>
  // Cartão "A receber" do Início: só o total; tocar abre a tela com a lista
  import { ChevronRight } from '@lucide/svelte'
  import Dinheiro from './Dinheiro.svelte'
  import { S, irPara } from '../lib/estado.svelte.js'
  import { pessoas, totalFalta } from '../lib/fiados.js'

  const total = $derived(totalFalta(S.fiados))
  const n = $derived(pessoas(S.fiados))
</script>

<button class="flex w-full items-center gap-3 rounded-[28px] border border-linha bg-sup p-5 text-left transition-colors hover:bg-sup-2/60 active:bg-sup-2" onclick={() => irPara('receber')}>
  <span class="min-w-0 flex-1">
    <span class="block text-[13px] text-txt-2">A receber</span>
    {#if n}
      <Dinheiro valor={total} class="mt-0.5 block text-[22px] font-semibold" />
      <span class="block text-[13px] text-txt-3">{n} {n === 1 ? 'pessoa te deve' : 'pessoas te devem'}</span>
    {:else}
      <span class="mt-0.5 block text-[15px] text-txt-3">Ninguém te deve 🎉</span>
    {/if}
  </span>
  <ChevronRight size={20} class="shrink-0 text-txt-3" />
</button>
