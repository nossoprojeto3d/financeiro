<script>
  // Tela "A receber": todos os fiados, do mais antigo para o mais novo, com o "Recebeu"
  // (que aceita pagar tudo ou só uma parte)
  import { ChevronLeft, Plus } from '@lucide/svelte'
  import Folha from '../componentes/Folha.svelte'
  import Dinheiro from '../componentes/Dinheiro.svelte'
  import Teclado from '../componentes/Teclado.svelte'
  import { S, irPara, abrirFiado, receberFiado, avisar, tratarErro } from '../lib/estado.svelte.js'
  import { pessoas, haQuanto, falta, totalFalta } from '../lib/fiados.js'
  import { cent, fmt, hoje, ontem } from '../lib/formato.js'
  import { PAGAMENTOS } from '../lib/dados.js'

  const total = $derived(totalFalta(S.fiados))
  const n = $derived(pessoas(S.fiados))

  let rc = $state(null) // fiado sendo recebido (painel aberto)
  let forma = $state('')
  let data = $state(hoje())
  let parte = $state(false) // false = pagou tudo; true = só uma parte
  let centavos = $state(0) // valor da parte, digitado no teclado do app
  let enviando = $state(false)

  const resta = $derived(rc ? cent(falta(rc)) : 0) // em centavos
  // pagar uma parte só existe com o v4-fiados-parcial.sql no banco (coluna "pago")
  const aceitaParte = $derived(!!rc && 'pago' in rc)
  const valorPago = $derived(parte ? centavos : resta)

  function pedirReceber(fz) { rc = fz; forma = ''; data = hoje(); parte = false; centavos = 0 }
  // recebido ou excluído em outro celular: quando a lista recarrega sem ele, o painel fecha
  $effect(() => { if (rc && !S.fiados.some(x => x.id === rc.id)) rc = null })

  function tecla(t) {
    if (t === 'limpar') centavos = 0
    else if (t === 'apagar') centavos = Math.floor(centavos / 10)
    else if (String(centavos).length + t.length <= 10) centavos = Number(String(centavos) + t)
  }

  async function receber() {
    if (enviando) return
    if (parte && !centavos) return avisar('Digite quanto pagou.', 'erro')
    if (parte && centavos > resta) return avisar(`O que falta é ${fmt(resta / 100)}.`, 'erro')
    if (!forma) return avisar('Escolha a forma de pagamento.', 'erro')
    // o iPhone deixa apagar o campo de data: confere aqui antes de mandar
    if (!data || data < rc.data || data > hoje()) return avisar('A data do pagamento não pode ser antes da entrega nem no futuro.', 'erro')
    enviando = true
    // guarda antes: depois de receber, o fiado já vem com o novo "pago"
    const ehParte = parte && centavos < resta, vaiFaltar = resta - centavos
    try {
      await receberFiado(rc, forma, data, ehParte ? centavos / 100 : null)
      avisar(ehParte ? `Recebido ${fmt(centavos / 100)} · faltam ${fmt(vaiFaltar / 100)}` : 'Recebido · entrou no caixa')
      rc = null
    } catch (e) {
      tratarErro(e)
    } finally {
      enviando = false
    }
  }
</script>

<div class="space-y-4 lg:max-w-[720px]">
  <header class="flex items-center gap-2 pt-1">
    <button class="-ml-2 grid size-10 place-items-center rounded-full text-txt-2 hover:bg-sup-2" aria-label="Voltar ao Início" onclick={() => irPara('inicio')}><ChevronLeft size={24} /></button>
    <h1 class="num text-[26px] font-semibold lg:text-[32px]">A receber</h1>
  </header>

  <section class="rounded-[28px] border border-linha bg-sup p-5">
    <Dinheiro valor={total} class="block text-[34px] leading-none font-semibold" />
    <p class="mt-2 text-[13px] text-txt-3">{n ? `${n} ${n === 1 ? 'pessoa te deve' : 'pessoas te devem'}` : 'Ninguém te deve 🎉'}</p>
  </section>

  <button class="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-sup-3 text-[15px] text-txt-2" onclick={() => abrirFiado()}>
    <Plus size={17} /> Anotar fiado
  </button>

  {#if S.fiados.length}
    <div>
      {#each S.fiados as fz (fz.id)}
        <div class="flex items-center gap-3 py-2.5 not-last:border-b not-last:border-linha/60">
          <button class="min-w-0 flex-1 py-1 text-left" onclick={() => abrirFiado(fz)}>
            <span class="block truncate text-[15px] text-txt">{fz.nome}</span>
            <span class="block truncate text-[13px] text-txt-3">{haQuanto(fz.data, hoje())} · {fz.descricao}</span>
            {#if fz.pago > 0}<span class="block truncate text-[12px] text-ent">pagou {fmt(fz.pago)} de {fmt(fz.valor)}</span>{/if}
          </button>
          <Dinheiro valor={falta(fz)} moeda={false} class="text-[16px] font-semibold" />
          <button class="h-10 shrink-0 rounded-full bg-ent-fundo px-3.5 text-[14px] font-semibold text-ent" onclick={() => pedirReceber(fz)}>Recebeu</button>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if rc}
  <Folha titulo="Recebeu de {rc.nome}" aoFechar={() => (rc = null)}>
    {#if aceitaParte}
      <p class="mb-2 text-[13px] text-txt-3">Quanto pagou?</p>
      <div class="grid grid-cols-2 gap-2">
        <button class="h-12 rounded-2xl text-[15px] font-medium {!parte ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => (parte = false)}>Tudo · {fmt(resta / 100)}</button>
        <button class="h-12 rounded-2xl text-[15px] font-medium {parte ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => (parte = true)}>Só uma parte</button>
      </div>
      {#if parte}
        <div class="mt-4 text-center" aria-live="polite">
          <Dinheiro valor={centavos / 100} class="text-[40px] leading-none font-semibold {centavos > resta ? 'text-sai' : centavos ? 'text-ent' : 'text-txt-3'}" />
          <p class="mt-1.5 text-[13px] text-txt-3">
            {#if centavos > resta}Mais do que falta ({fmt(resta / 100)})
            {:else if centavos}Vai faltar {fmt((resta - centavos) / 100)}
            {:else}Digite o valor que ele pagou{/if}
          </p>
        </div>
        <div class="mt-3"><Teclado aoTocar={tecla} compacto /></div>
      {/if}
    {/if}

    <p class="mb-2 text-[13px] text-txt-3 {aceitaParte ? 'mt-5' : ''}">Forma de pagamento</p>
    <div class="flex flex-wrap gap-2">
      {#each PAGAMENTOS as p}
        <button class="h-10 rounded-full px-4 text-[14px] font-medium {forma === p ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => (forma = p)}>{p}</button>
      {/each}
    </div>

    <p class="mt-5 mb-2 text-[13px] text-txt-3">Data</p>
    <div class="flex gap-2">
      {#each [[hoje(), 'Hoje'], [ontem(), 'Ontem']].filter(([d]) => d >= rc.data) as [d, r]}
        <button class="h-10 rounded-full px-4 text-[14px] font-medium {data === d ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => (data = d)}>{r}</button>
      {/each}
      <input type="date" bind:value={data} min={rc.data} max={hoje()} aria-label="Outra data"
        class="h-10 min-w-0 flex-1 rounded-full border px-3 text-[16px] [color-scheme:dark] {data !== hoje() && data !== ontem() ? 'border-transparent bg-txt text-fundo' : 'border-linha bg-transparent text-txt-2'}" />
    </div>

    <!-- preso no rodapé do painel: com o teclado aberto, o painel rola e o botão continua à vista -->
    <div class="sticky -bottom-5 -mx-5 mt-6 bg-sup px-5 pt-2 pb-5">
      <button class="flex h-14 w-full items-center justify-center rounded-2xl bg-ent text-[17px] font-semibold text-fundo active:scale-[0.98] disabled:opacity-60" disabled={enviando} onclick={receber}>
        {#if enviando}<span class="size-5 animate-spin rounded-full border-2 border-fundo/30 border-t-fundo"></span>{:else}Confirmar {fmt(valorPago / 100)}{/if}
      </button>
    </div>
  </Folha>
{/if}
