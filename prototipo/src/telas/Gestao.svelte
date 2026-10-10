<script>
  import { Sparkles, Download, TrendingUp, TrendingDown } from '@lucide/svelte'
  import Dinheiro from '../componentes/Dinheiro.svelte'
  import GraficoMeses from '../componentes/GraficoMeses.svelte'
  import { S, cat, avisar } from '../lib/estado.svelte.js'
  import { analise, porMes, PERIODOS } from '../lib/analise.js'
  import { fmt, pct, dataCurta } from '../lib/formato.js'

  const a = $derived(analise(S.lancs, cat, S.periodo))
  const meses = $derived(porMes(S.lancs, 6))

  // De cada R$ 100 vendidos: para onde vai e quanto sobra
  const fatias = $derived.by(() => {
    if (!a || a.n.venda <= 0) return []
    const top = a.destinos.slice(0, 4).map(d => ({ nome: d.c.nome, cor: d.c.cor, v: (d.valor / a.n.venda) * 100 }))
    const resto = a.destinos.slice(4).reduce((s, d) => s + d.valor, 0)
    if (resto) top.push({ nome: 'Outros', cor: 'var(--color-txt-3)', v: (resto / a.n.venda) * 100 })
    return top
  })
  const sobra = $derived(a && a.n.venda > 0 ? (a.lucro / a.n.venda) * 100 : null)

  let ia = $state(null)
  async function pedirIA() {
    ia = 'carregando'
    await new Promise(r => setTimeout(r, 1400))
    ia = 'As vendas pela Shopee seguem sendo a maior parte, mas as encomendas personalizadas rendem quase 4 vezes mais por venda. Vale divulgar mais esse serviço no WhatsApp. O filamento é o maior gasto: comprar 5 rolos de uma vez costuma sair 15% mais barato.'
  }
</script>

<div class="space-y-5">
  <header class="pt-1">
    <h1 class="num text-[26px] font-semibold lg:text-[32px]">Gestão</h1>
  </header>

  <div class="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
    {#each PERIODOS as [v, r]}
      <button class="h-10 shrink-0 rounded-full px-4 text-[14px] font-medium transition-colors {S.periodo === v ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => { S.periodo = v; ia = null }}>{r}</button>
    {/each}
  </div>

  {#if !a}
    <p class="py-16 text-center text-[15px] text-txt-2">Nenhum lançamento nesse período.</p>
  {:else}
    <div class="grid gap-4 lg:grid-cols-2 lg:gap-5">
      <!-- O destaque: lucro do período -->
      <section class="rounded-[28px] border border-linha bg-sup p-5 lg:col-span-2 lg:flex lg:items-end lg:justify-between lg:p-7">
        <div>
          <p class="text-[13px] text-txt-2">{a.lucro >= 0 ? 'Lucro' : 'Prejuízo'} de {dataCurta(a.iv.de)} a {dataCurta(a.iv.ate)}</p>
          <Dinheiro valor={a.lucro} class="mt-1 block text-[40px] leading-none font-semibold lg:text-[56px] {a.lucro >= 0 ? 'text-ent' : 'text-sai'}" />
          {#if a.cresc != null}
            <p class="mt-3 flex items-center gap-1.5 text-[13px] {a.cresc >= 0 ? 'text-ent' : 'text-sai'}">
              {#if a.cresc >= 0}<TrendingUp size={15} />{:else}<TrendingDown size={15} />{/if}
              Vendas {a.cresc >= 0 ? 'subiram' : 'caíram'} {pct(Math.abs(a.cresc))} sobre o período anterior
            </p>
          {/if}
        </div>
        <dl class="mt-5 grid grid-cols-3 gap-3 border-t border-linha pt-4 lg:mt-0 lg:w-[460px] lg:border-0 lg:pt-0">
          <div><dt class="text-[12px] text-txt-3">Vendas</dt><dd><Dinheiro valor={a.n.venda} moeda={false} class="text-[16px] font-semibold" /></dd></div>
          <div><dt class="text-[12px] text-txt-3">Por venda</dt><dd><Dinheiro valor={a.ticket || 0} moeda={false} class="text-[16px] font-semibold" /></dd></div>
          <div><dt class="text-[12px] text-txt-3">Meta mínima</dt><dd>{#if a.meta}<Dinheiro valor={a.meta} moeda={false} class="text-[16px] font-semibold" />{:else}—{/if}<span class="text-[11px] text-txt-3">/mês</span></dd></div>
        </dl>
      </section>

      <!-- Como fechou -->
      <section class="rounded-[28px] border border-linha bg-sup p-5">
        <h2 class="mb-3 text-[15px] font-semibold">Como fechou</h2>
        {#snippet linha(rot, v, nota = '', forte = false, cor = '')}
          <div class="flex items-baseline justify-between gap-3 py-2 {forte ? 'mt-1 border-t border-linha pt-3' : ''}">
            <span class="min-w-0"><span class="block text-[14px] {forte ? 'font-semibold' : 'text-txt-2'}">{rot}</span>{#if nota}<span class="block text-[12px] text-txt-3">{nota}</span>{/if}</span>
            <Dinheiro valor={v} moeda={false} class="text-[15px] {forte ? 'text-[17px] font-semibold' : ''} {cor}" />
          </div>
        {/snippet}
        {@render linha('Vendemos', a.n.venda)}
        {@render linha('Gastos para produzir e entregar', -a.n.variavel, 'filamento, embalagem, frete, taxas')}
        {@render linha('Contas fixas', -a.n.fixa, 'assinaturas, anúncios, manutenção')}
        {@render linha(a.lucro >= 0 ? 'Lucro' : 'Prejuízo', a.lucro, '', true, a.lucro >= 0 ? 'text-ent' : 'text-sai')}
        {#if a.n.investimento}{@render linha('Compra de equipamentos', -a.n.investimento)}{/if}
        {#if a.n.aporte + a.n.outra}{@render linha('Dinheiro colocado e outras entradas', a.n.aporte + a.n.outra)}{/if}
        {@render linha(a.variacaoCaixa >= 0 ? 'O caixa aumentou' : 'O caixa diminuiu', a.variacaoCaixa, '', true)}
      </section>

      <!-- De cada R$ 100 -->
      {#if fatias.length}
        <section class="rounded-[28px] border border-linha bg-sup p-5">
          <h2 class="text-[15px] font-semibold">De cada R$ 100 vendidos</h2>
          <p class="mt-0.5 text-[13px] text-txt-3">sem contar equipamentos</p>
          <!-- barra empilhada como camadas de uma peça -->
          <div class="mt-4 flex h-11 overflow-hidden rounded-[14px] bg-sup-2">
            {#each fatias as fa}<span class="h-full border-r-2 border-sup" style="width:{fa.v}%;background:{fa.cor}"></span>{/each}
            {#if sobra > 0}<span class="h-full flex-1 bg-ent camadas text-ent-fundo/60"></span>{/if}
          </div>
          <ul class="mt-4 space-y-2.5">
            {#each fatias as fa}
              <li class="flex items-center gap-2.5 text-[14px]"><span class="size-2.5 rounded-full" style="background:{fa.cor}"></span><span class="flex-1 text-txt-2">{fa.nome}</span><span class="num">{fmt(fa.v)}</span></li>
            {/each}
            {#if sobra != null}
              <li class="flex items-center gap-2.5 border-t border-linha pt-3 text-[14px] font-semibold"><span class="size-2.5 rounded-full bg-ent"></span><span class="flex-1">Sobra para a empresa</span><span class="num {sobra >= 0 ? 'text-ent' : 'text-sai'}">{fmt(sobra)}</span></li>
            {/if}
          </ul>
        </section>
      {/if}

      <!-- Meses -->
      <section class="rounded-[28px] border border-linha bg-sup p-5">
        <h2 class="mb-4 text-[15px] font-semibold">Últimos 6 meses</h2>
        <GraficoMeses {meses} />
      </section>

      <!-- Canais -->
      {#if a.canais.length}
        <section class="rounded-[28px] border border-linha bg-sup p-5">
          <h2 class="mb-4 text-[15px] font-semibold">De onde vêm as vendas</h2>
          <ul class="space-y-4">
            {#each a.canais as k}
              <li>
                <div class="flex items-baseline justify-between text-[14px]"><span>{k.c.nome}</span><span class="num font-semibold">{pct(k.valor / a.n.venda)}</span></div>
                <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-sup-2"><div class="h-full rounded-full" style="width:{(k.valor / a.n.venda) * 100}%;background:{k.c.cor}"></div></div>
                <p class="mt-1 text-[12px] text-txt-3">{fmt(k.valor)} em {k.qtd} venda{k.qtd === 1 ? '' : 's'}, média de {fmt(k.valor / k.qtd)}</p>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <!-- Dicas + IA -->
      <section class="rounded-[28px] border border-linha bg-sup p-5 lg:col-span-2">
        <h2 class="mb-3 text-[15px] font-semibold">O que fazer</h2>
        <ul class="space-y-2.5">
          {#each a.dicas as [t, txt]}
            <li class="flex gap-3 text-[14px] leading-relaxed text-txt-2"><span class="mt-2 size-1.5 shrink-0 rounded-full {t === 'alerta' ? 'bg-sai' : t === 'bom' ? 'bg-ent' : 'bg-txt-3'}"></span>{txt}</li>
          {/each}
        </ul>
        <div class="mt-5 rounded-[20px] bg-ambar-fundo/60 p-4">
          {#if !ia}
            <button class="flex w-full items-center gap-3 text-left" onclick={pedirIA}>
              <span class="grid size-10 shrink-0 place-items-center rounded-full bg-ambar text-fundo"><Sparkles size={19} /></span>
              <span><span class="block text-[15px] font-semibold text-ambar">Pedir uma análise com IA</span><span class="text-[13px] text-txt-2">Usa só os totais, nunca as descrições</span></span>
            </button>
          {:else if ia === 'carregando'}
            <div class="flex items-center gap-3 text-[14px] text-txt-2"><span class="size-5 animate-spin rounded-full border-2 border-ambar/30 border-t-ambar"></span>Analisando o período…</div>
          {:else}
            <p class="flex gap-2 text-[14px] leading-relaxed text-txt"><Sparkles size={17} class="mt-0.5 shrink-0 text-ambar" />{ia}</p>
          {/if}
        </div>
      </section>
    </div>

    <button class="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-linha text-[14px] text-txt-2 lg:w-auto lg:px-6" onclick={() => avisar('No protótipo não exporta')}>
      <Download size={17} /> Exportar lançamentos do período (CSV)
    </button>
  {/if}
</div>
