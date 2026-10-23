<script>
  // Tela "A pagar": contas com vencimento, da que vence antes para a que vence depois, com o "Paguei"
  import { ChevronLeft, Plus, Repeat } from '@lucide/svelte'
  import Folha from '../componentes/Folha.svelte'
  import Dinheiro from '../componentes/Dinheiro.svelte'
  import Teclado from '../componentes/Teclado.svelte'
  import { S, irPara, abrirConta, pagarConta, avisar, tratarErro, CONTA_MUDOU } from '../lib/estado.svelte.js'
  import { situacao, resumoContas } from '../lib/contas.js'
  import { cent, fmt, hoje, ontem } from '../lib/formato.js'
  import { PAGAMENTOS } from '../lib/dados.js'

  const r = $derived(resumoContas(S.contas, hoje()))
  const alerta = $derived([r.atrasadas && `${r.atrasadas} atrasada${r.atrasadas === 1 ? '' : 's'}`,
    r.semana && `${r.semana} ${r.semana === 1 ? 'vence' : 'vencem'} esta semana`].filter(Boolean).join(' · '))

  let pg = $state(null) // conta sendo paga (painel aberto)
  let forma = $state('')
  let data = $state(hoje())
  let outroValor = $state(false)
  let centavos = $state(0)
  let enviando = $state(false)
  const valorPago = $derived(pg ? (outroValor ? centavos : cent(pg.valor)) : 0)

  function pedirPagar(ct) { pg = ct; forma = ''; data = hoje(); outroValor = false; centavos = 0 }
  // paga ou excluída em outro celular: quando a lista recarrega sem ela, o painel fecha
  $effect(() => { if (pg && !S.contas.some(x => x.id === pg.id)) pg = null })

  function tecla(t) {
    if (t === 'limpar') centavos = 0
    else if (t === 'apagar') centavos = Math.floor(centavos / 10)
    else if (String(centavos).length + t.length <= 10) centavos = Number(String(centavos) + t)
  }

  async function pagar() {
    if (enviando) return
    if (!valorPago) return avisar('Digite quanto pagou.', 'erro')
    if (!forma) return avisar('Escolha a forma de pagamento.', 'erro')
    if (!data || data > hoje()) return avisar('A data do pagamento não pode ser no futuro.', 'erro')
    enviando = true
    try {
      const mensal = !!pg.regra_id
      await pagarConta(pg, forma, data, valorPago / 100)
      avisar(mensal ? 'Paga · a do mês que vem aparece sozinha' : 'Paga · saiu do caixa')
      pg = null
    } catch (e) {
      tratarErro(e)
      if (e.message === CONTA_MUDOU) pg = null
    } finally {
      enviando = false
    }
  }
</script>

<div class="space-y-4 lg:max-w-[720px]">
  <header class="flex items-center gap-2 pt-1">
    <button class="-ml-2 grid size-10 place-items-center rounded-full text-txt-2 hover:bg-sup-2" aria-label="Voltar ao Início" onclick={() => irPara('inicio')}><ChevronLeft size={24} /></button>
    <h1 class="num text-[26px] font-semibold lg:text-[32px]">A pagar</h1>
  </header>

  <section class="rounded-[28px] border border-linha bg-sup p-5">
    <Dinheiro valor={r.total} class="block text-[34px] leading-none font-semibold" />
    <p class="mt-2 text-[13px] {r.atrasadas || r.urgentes ? 'text-sai' : 'text-txt-3'}">{S.contas.length ? alerta || 'Nada vencendo esta semana' : 'Nenhuma conta a pagar 🎉'}</p>
  </section>

  <button class="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-sup-3 text-[15px] text-txt-2" onclick={() => abrirConta()}>
    <Plus size={17} /> Anotar conta
  </button>

  {#if S.contas.length}
    <ul aria-label="Contas a pagar">
      {#each S.contas as ct (ct.id)}
        {@const st = situacao(ct.vencimento, hoje())}
        <li class="flex items-center gap-3 py-2.5 not-last:border-b not-last:border-linha/60">
          <button class="min-w-0 flex-1 py-1 text-left" onclick={() => abrirConta(ct)}>
            <span class="flex items-center gap-1.5 text-[15px] text-txt"><span class="truncate">{ct.descricao}</span>{#if ct.regra_id}<Repeat size={13} class="shrink-0 text-txt-3" aria-label="Todo mês" />{/if}</span>
            <span class="block truncate text-[13px] {st.urgente ? 'text-sai' : 'text-txt-3'}">{st.texto}</span>
          </button>
          <Dinheiro valor={ct.valor} moeda={false} class="text-[16px] font-semibold" />
          <button class="h-10 shrink-0 rounded-full bg-sai-fundo px-3.5 text-[14px] font-semibold text-sai" onclick={() => pedirPagar(ct)}>Paguei</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if pg}
  <Folha titulo="Paguei: {pg.descricao}" aoFechar={() => (pg = null)}>
    <p class="mb-2 text-[13px] text-txt-3">Quanto pagou?</p>
    <div class="grid grid-cols-2 gap-2">
      <button class="h-12 rounded-2xl text-[15px] font-medium {!outroValor ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => (outroValor = false)}>{fmt(pg.valor)}</button>
      <button class="h-12 rounded-2xl text-[15px] font-medium {outroValor ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => (outroValor = true)}>Outro valor</button>
    </div>
    {#if outroValor}
      <div class="mt-4 text-center" aria-live="polite">
        <Dinheiro valor={centavos / 100} class="text-[40px] leading-none font-semibold {centavos ? 'text-sai' : 'text-txt-3'}" />
        <p class="mt-1.5 text-[13px] text-txt-3">Ex.: a conta de energia deste mês veio diferente</p>
      </div>
      <div class="mt-3"><Teclado aoTocar={tecla} compacto /></div>
    {/if}

    <p class="mt-5 mb-2 text-[13px] text-txt-3">Forma de pagamento</p>
    <div class="flex flex-wrap gap-2">
      {#each PAGAMENTOS as p}
        <button class="h-10 rounded-full px-4 text-[14px] font-medium {forma === p ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => (forma = p)}>{p}</button>
      {/each}
    </div>

    <p class="mt-5 mb-2 text-[13px] text-txt-3">Data do pagamento</p>
    <div class="flex gap-2">
      {#each [[hoje(), 'Hoje'], [ontem(), 'Ontem']] as [d, rot]}
        <button class="h-10 rounded-full px-4 text-[14px] font-medium {data === d ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => (data = d)}>{rot}</button>
      {/each}
      <input type="date" bind:value={data} max={hoje()} aria-label="Outra data"
        class="h-10 min-w-0 flex-1 rounded-full border px-3 text-[16px] [color-scheme:dark] {data !== hoje() && data !== ontem() ? 'border-transparent bg-txt text-fundo' : 'border-linha bg-transparent text-txt-2'}" />
    </div>

    <!-- preso no rodapé do painel: com o teclado aberto, o painel rola e o botão continua à vista -->
    <div class="sticky -bottom-5 -mx-5 mt-6 bg-sup px-5 pt-2 pb-5">
      <button class="flex h-14 w-full items-center justify-center rounded-2xl bg-sai text-[17px] font-semibold text-fundo active:scale-[0.98] disabled:opacity-60" disabled={enviando} onclick={pagar}>
        {#if enviando}<span class="size-5 animate-spin rounded-full border-2 border-fundo/30 border-t-fundo"></span>{:else}Confirmar {fmt(valorPago / 100)}{/if}
      </button>
    </div>
  </Folha>
{/if}
