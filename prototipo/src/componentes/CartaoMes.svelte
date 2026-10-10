<script>
  import Vaso from './Vaso.svelte'
  import Dinheiro from './Dinheiro.svelte'
  import { S, cat } from '../lib/estado.svelte.js'
  import { analise, saldoCaixa } from '../lib/analise.js'
  import { fmt, MESES_LONGO } from '../lib/formato.js'
  let { grande = false } = $props()

  const caixa = $derived(saldoCaixa(S.lancs))
  const a = $derived(analise(S.lancs, cat, 'mes'))
  const meta = $derived(a?.meta ?? null)
  const vendas = $derived(a?.n.venda ?? 0)
  const progresso = $derived(meta ? vendas / meta : 0)
  const mes = MESES_LONGO[new Date().getMonth()]
</script>

<section class="relative overflow-hidden rounded-[28px] border border-linha bg-sup p-5 {grande ? 'lg:p-7' : ''}">
  <div class="flex items-start gap-4">
    <div class="min-w-0 flex-1">
      <p class="text-[13px] text-txt-2">Em caixa</p>
      <Dinheiro valor={caixa} class="mt-1 block text-[38px] leading-none font-semibold {grande ? 'lg:text-[52px]' : ''} {caixa < 0 ? 'text-sai' : ''}" />

      <div class="mt-6">
        <p class="text-[13px] text-txt-2">Vendas de {mes}</p>
        <Dinheiro valor={vendas} class="mt-0.5 block text-[22px] font-semibold {grande ? 'lg:text-[28px]' : ''}" />
        {#if meta}
          <p class="mt-1 text-[13px] leading-snug text-txt-3">
            {#if progresso >= 1}
              <span class="text-ent">Meta mínima de {fmt(meta)} batida</span>
            {:else}
              Faltam <span class="text-ambar">{fmt(meta - vendas)}</span> para a meta
            {/if}
          </p>
        {/if}
      </div>
    </div>
    {#if meta}
      <div class="shrink-0 pt-1">
        <Vaso {progresso} largura={grande ? 150 : 104} altura={grande ? 170 : 118} camadas={grande ? 22 : 16} />
        <p class="num mt-1 text-center text-[13px] font-semibold {progresso >= 1 ? 'text-ent' : 'text-ambar'}">{Math.min(999, Math.round(progresso * 100))}%</p>
      </div>
    {/if}
  </div>
</section>
