<script>
  // Cartão "A pagar" do Início: total e o que pede atenção; tocar abre a tela com a lista
  import { ChevronRight } from '@lucide/svelte'
  import Dinheiro from './Dinheiro.svelte'
  import { S, irPara } from '../lib/estado.svelte.js'
  import { resumoContas } from '../lib/contas.js'
  import { hoje } from '../lib/formato.js'

  // compacto = lado a lado com o A receber (sem a seta)
  let { compacto = false } = $props()
  const r = $derived(resumoContas(S.contas, hoje()))
  const alerta = $derived(r.atrasadas ? `${r.atrasadas} atrasada${r.atrasadas === 1 ? '' : 's'}`
    : r.semana ? `${r.semana} ${r.semana === 1 ? 'vence' : 'vencem'} esta semana` : '')
</script>

<button class="flex w-full items-center gap-3 rounded-[28px] border border-linha bg-sup {compacto ? 'p-4' : 'p-5'} text-left transition-colors hover:bg-sup-2/60 active:bg-sup-2" onclick={() => irPara('pagar')}>
  <span class="min-w-0 flex-1">
    <span class="block text-[13px] text-txt-2">A pagar</span>
    {#if S.contas.length}
      <Dinheiro valor={r.total} class="mt-0.5 block text-[22px] font-semibold" />
      <span class="block truncate text-[13px] {r.atrasadas || r.urgentes ? 'text-sai' : 'text-txt-3'}">{alerta || `${S.contas.length} conta${S.contas.length === 1 ? '' : 's'}`}</span>
    {:else}
      <span class="mt-0.5 block text-[15px] text-txt-3">Nada a pagar</span>
    {/if}
  </span>
  {#if !compacto}<ChevronRight size={20} class="shrink-0 text-txt-3" />{/if}
</button>
