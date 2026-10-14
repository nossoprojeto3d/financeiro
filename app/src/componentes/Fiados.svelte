<script>
  // Fiados no Início: o cartão "A receber", o painel com a lista completa e o "Recebeu"
  import { ChevronRight, Plus } from '@lucide/svelte'
  import Folha from './Folha.svelte'
  import Dinheiro from './Dinheiro.svelte'
  import { S, abrirFiado, receberFiado, avisar, tratarErro } from '../lib/estado.svelte.js'
  import { pessoas, haQuanto } from '../lib/fiados.js'
  import { soma, fmt, hoje, ontem } from '../lib/formato.js'
  import { PAGAMENTOS } from '../lib/dados.js'

  const total = $derived(soma(S.fiados))
  const n = $derived(pessoas(S.fiados))

  // no cartão, os 3 que devem há mais tempo (a lista já vem do mais antigo para o mais novo)
  const primeiros = $derived(S.fiados.slice(0, 3))

  let folha = $state(null) // 'lista' | 'receber'
  let veioDaLista = false // o "Recebeu" volta para onde foi aberto
  let rc = $state(null) // fiado sendo recebido
  let forma = $state('')
  let data = $state(hoje())
  let enviando = $state(false)

  function anotar() { folha = null; abrirFiado() }
  function editar(fz) { folha = null; abrirFiado(fz) }
  function pedirReceber(fz) { veioDaLista = folha === 'lista'; rc = fz; forma = ''; data = hoje(); folha = 'receber' }
  // recebido ou excluído em outro celular: quando a lista recarrega sem ele, o painel fecha
  $effect(() => { if (folha === 'receber' && rc && !S.fiados.some(x => x.id === rc.id)) folha = null })

  async function receber() {
    if (enviando) return
    if (!forma) return avisar('Escolha a forma de pagamento.', 'erro')
    // o iPhone deixa apagar o campo de data: confere aqui antes de mandar
    if (!data || data < rc.data || data > hoje()) return avisar('A data do pagamento não pode ser antes da entrega nem no futuro.', 'erro')
    enviando = true
    try {
      await receberFiado(rc, forma, data)
      folha = null
      avisar('Recebido · entrou no caixa')
    } catch (e) {
      tratarErro(e)
    } finally {
      enviando = false
    }
  }
</script>

{#snippet item(fz)}
  <div class="flex items-center gap-3 py-2.5 not-last:border-b not-last:border-linha/60">
    <button class="min-w-0 flex-1 py-1 text-left" onclick={() => editar(fz)}>
      <span class="block truncate text-[15px] text-txt">{fz.nome}</span>
      <span class="block truncate text-[13px] text-txt-3">{haQuanto(fz.data, hoje())} · {fz.descricao}</span>
    </button>
    <Dinheiro valor={fz.valor} moeda={false} class="text-[16px] font-semibold" />
    <button class="h-10 shrink-0 rounded-full bg-ent-fundo px-3.5 text-[14px] font-semibold text-ent" onclick={() => pedirReceber(fz)}>Recebeu</button>
  </div>
{/snippet}

{#if S.fiados.length}
  <section class="rounded-[28px] border border-linha bg-sup px-5 pt-5 pb-3" aria-label="A receber">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-[13px] text-txt-2">A receber</p>
        <p class="text-[13px] text-txt-3">{n} {n === 1 ? 'pessoa te deve' : 'pessoas te devem'}</p>
      </div>
      <Dinheiro valor={total} class="text-[22px] font-semibold" />
    </div>
    <div class="mt-2">
      {#each primeiros as fz (fz.id)}{@render item(fz)}{/each}
    </div>
    <div class="-mx-2 mt-1 flex items-center justify-between">
      <button class="flex h-10 items-center gap-1.5 rounded-full px-2 text-[14px] text-txt-2" onclick={anotar}><Plus size={16} /> Anotar fiado</button>
      {#if S.fiados.length > 3}
        <button class="flex h-10 items-center rounded-full px-2 text-[14px] text-txt-2" onclick={() => (folha = 'lista')}>Ver todos ({S.fiados.length})<ChevronRight size={16} /></button>
      {/if}
    </div>
  </section>
{:else}
  <section class="flex items-center justify-between gap-3 rounded-[22px] border border-linha bg-sup py-2 pr-2 pl-5" aria-label="A receber">
    <p class="text-[14px] text-txt-3">Ninguém te deve 🎉</p>
    <button class="flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] text-txt-2" onclick={anotar}><Plus size={16} /> Anotar fiado</button>
  </section>
{/if}

{#if folha === 'lista'}
  <Folha titulo="A receber" aoFechar={() => (folha = null)}>
    <button class="mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-sup-3 text-[15px] text-txt-2" onclick={anotar}>
      <Plus size={17} /> Anotar fiado
    </button>
    {#each S.fiados as fz (fz.id)}{@render item(fz)}{/each}
  </Folha>
{/if}

{#if folha === 'receber' && rc}
  <Folha titulo="{rc.nome} pagou {fmt(rc.valor)}" aoFechar={() => (folha = veioDaLista ? 'lista' : null)}>
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
