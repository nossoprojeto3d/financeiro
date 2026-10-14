<script>
  // Tela "A receber": todos os fiados, do mais antigo para o mais novo, com o "Recebeu"
  import { ChevronLeft, Plus } from '@lucide/svelte'
  import Folha from '../componentes/Folha.svelte'
  import Dinheiro from '../componentes/Dinheiro.svelte'
  import { S, irPara, abrirFiado, receberFiado, avisar, tratarErro } from '../lib/estado.svelte.js'
  import { pessoas, haQuanto } from '../lib/fiados.js'
  import { soma, fmt, hoje, ontem } from '../lib/formato.js'
  import { PAGAMENTOS } from '../lib/dados.js'

  const total = $derived(soma(S.fiados))
  const n = $derived(pessoas(S.fiados))

  let rc = $state(null) // fiado sendo recebido (painel aberto)
  let forma = $state('')
  let data = $state(hoje())
  let enviando = $state(false)

  function pedirReceber(fz) { rc = fz; forma = ''; data = hoje() }
  // recebido ou excluído em outro celular: quando a lista recarrega sem ele, o painel fecha
  $effect(() => { if (rc && !S.fiados.some(x => x.id === rc.id)) rc = null })

  async function receber() {
    if (enviando) return
    if (!forma) return avisar('Escolha a forma de pagamento.', 'erro')
    // o iPhone deixa apagar o campo de data: confere aqui antes de mandar
    if (!data || data < rc.data || data > hoje()) return avisar('A data do pagamento não pode ser antes da entrega nem no futuro.', 'erro')
    enviando = true
    try {
      await receberFiado(rc, forma, data)
      rc = null
      avisar('Recebido · entrou no caixa')
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
          </button>
          <Dinheiro valor={fz.valor} moeda={false} class="text-[16px] font-semibold" />
          <button class="h-10 shrink-0 rounded-full bg-ent-fundo px-3.5 text-[14px] font-semibold text-ent" onclick={() => pedirReceber(fz)}>Recebeu</button>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if rc}
  <Folha titulo="{rc.nome} pagou {fmt(rc.valor)}" aoFechar={() => (rc = null)}>
    <p class="mb-2 text-[13px] text-txt-3">Forma de pagamento</p>
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

    <button class="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-ent text-[17px] font-semibold text-fundo active:scale-[0.98] disabled:opacity-60" disabled={enviando} onclick={receber}>
      {#if enviando}<span class="size-5 animate-spin rounded-full border-2 border-fundo/30 border-t-fundo"></span>{:else}Confirmar recebimento{/if}
    </button>
  </Folha>
{/if}
