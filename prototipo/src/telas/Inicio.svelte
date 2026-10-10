<script>
  import { ArrowDownLeft, ArrowUpRight, ChevronRight } from '@lucide/svelte'
  import CartaoMes from '../componentes/CartaoMes.svelte'
  import ItemLanc from '../componentes/ItemLanc.svelte'
  import GraficoMeses from '../componentes/GraficoMeses.svelte'
  import Lancar from '../componentes/Lancar.svelte'
  import { S, tela, abrirLancar, irPara } from '../lib/estado.svelte.js'
  import { porMes } from '../lib/analise.js'
  import { DIAS, MESES_LONGO, dataBonita } from '../lib/formato.js'

  const agora = new Date()
  const recentes = $derived(S.lancs.slice(0, tela.largo ? 6 : 5))
  const meses = $derived(porMes(S.lancs, 6))
  const abrir = l => abrirLancar(l.tipo, l)
</script>

<div class="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
  <div class="space-y-5 lg:space-y-6">
    <header class="flex items-center justify-between pt-1">
      <div>
        <p class="text-[13px] text-txt-3 first-letter:uppercase">{DIAS[agora.getDay()]}, {agora.getDate()} de {MESES_LONGO[agora.getMonth()]}<span class="ml-2 rounded-full bg-ambar-fundo px-2 py-0.5 text-[11px] text-ambar">dados de exemplo</span></p>
        <h1 class="num text-[26px] font-semibold lg:text-[32px]">Oi, {S.perfil.nome}</h1>
      </div>
      <button class="grid size-11 place-items-center rounded-full text-[17px] font-semibold text-fundo lg:hidden" style="background:{S.perfil.cor}" aria-label="Ajustes" onclick={() => irPara('ajustes')}>{S.perfil.nome[0]}</button>
    </header>

    <CartaoMes grande={tela.largo} />

    <!-- Atalhos: já abrem o lançamento no tipo certo -->
    <div class="grid grid-cols-2 gap-3 lg:hidden">
      <button class="flex h-16 items-center gap-3 rounded-[22px] bg-ent-fundo px-4 text-left active:scale-[0.98]" onclick={() => abrirLancar('entrada')}>
        <span class="grid size-9 place-items-center rounded-full bg-ent text-fundo"><ArrowDownLeft size={19} strokeWidth={2.4} /></span>
        <span class="text-[16px] font-semibold text-ent">Entrada</span>
      </button>
      <button class="flex h-16 items-center gap-3 rounded-[22px] bg-sai-fundo px-4 text-left active:scale-[0.98]" onclick={() => abrirLancar('saida')}>
        <span class="grid size-9 place-items-center rounded-full bg-sai text-fundo"><ArrowUpRight size={19} strokeWidth={2.4} /></span>
        <span class="text-[16px] font-semibold text-sai">Saída</span>
      </button>
    </div>

    <div class="min-[1360px]:grid min-[1360px]:grid-cols-2 min-[1360px]:gap-6">
    <section class="hidden rounded-[28px] border border-linha bg-sup p-6 lg:mb-6 lg:block min-[1360px]:mb-0 min-[1360px]:self-start">
      <GraficoMeses {meses} altura={170} />
    </section>

    <section>
      <div class="mb-1 flex items-center justify-between px-1">
        <h2 class="text-[15px] font-semibold">Últimos lançamentos</h2>
        <button class="-mr-2 flex h-10 items-center px-2 text-[13px] text-txt-2" onclick={() => irPara('historico')}>Ver todos<ChevronRight size={16} /></button>
      </div>
      <div class="-mx-2">
        {#each recentes as l, i (l.id)}
          {#if i === 0 || recentes[i - 1].data !== l.data}
            <p class="px-3 pt-3 pb-1 text-[12px] text-txt-3 first-letter:uppercase">{dataBonita(l.data)}</p>
          {/if}
          <ItemLanc {l} aoAbrir={abrir} />
        {/each}
      </div>
    </section>
    </div>
  </div>

  <!-- Computador: o lançamento fica sempre à mão -->
  {#if tela.largo}
    <aside class="sticky top-6 h-[calc(100dvh-48px)] max-h-[780px] overflow-hidden rounded-[28px] border border-linha bg-sup">
      <Lancar modo="painel" fixo />
    </aside>
  {/if}
</div>
