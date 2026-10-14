<script>
  // Fiados no Início: a linha "A receber", o painel com a lista e o "Recebeu"
  import { ChevronRight, Plus } from '@lucide/svelte'
  import Folha from './Folha.svelte'
  import Dinheiro from './Dinheiro.svelte'
  import { S, abrirFiado, receberFiado, avisar, tratarErro } from '../lib/estado.svelte.js'
  import { pessoas, haQuanto } from '../lib/fiados.js'
  import { soma, fmt, hoje, ontem } from '../lib/formato.js'
  import { PAGAMENTOS } from '../lib/dados.js'

  const total = $derived(soma(S.fiados))
  const n = $derived(pessoas(S.fiados))

  let folha = $state(null) // 'lista' | 'receber'
  let rc = $state(null) // fiado sendo recebido
  let forma = $state('')
  let data = $state(hoje())
  let enviando = $state(false)

  function linha() {
    if (S.fiados.length) folha = 'lista'
    else abrirFiado()
  }
  function anotar() { folha = null; abrirFiado() }
  function editar(fz) { folha = null; abrirFiado(fz) }
  function pedirReceber(fz) { rc = fz; forma = ''; data = hoje(); folha = 'receber' }
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

<button class="-my-2 flex min-h-11 w-full items-center gap-1.5 rounded-2xl px-1 text-left text-[13px]" onclick={linha}>
  {#if S.fiados.length}
    <span class="text-txt-2">A receber</span>
    <span class="text-txt-3">·</span>
    <Dinheiro valor={total} class="text-[15px] font-semibold text-txt" />
    <span class="text-txt-3">· {n} {n === 1 ? 'pessoa' : 'pessoas'}</span>
  {:else}
    <span class="text-txt-3">Anotar fiado</span>
  {/if}
  <ChevronRight size={16} class="ml-auto text-txt-3" />
</button>

{#if folha === 'lista'}
  <Folha titulo="A receber" aoFechar={() => (folha = null)}>
    <button class="mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-sup-3 text-[15px] text-txt-2" onclick={anotar}>
      <Plus size={17} /> Anotar fiado
    </button>
    {#each S.fiados as fz (fz.id)}
      <div class="flex items-center gap-3 py-2.5 not-last:border-b not-last:border-linha/60">
        <button class="min-w-0 flex-1 py-1 text-left" onclick={() => editar(fz)}>
          <span class="block truncate text-[15px] text-txt">{fz.nome}</span>
          <span class="block truncate text-[13px] text-txt-3">{fz.descricao} · {haQuanto(fz.data, hoje())}</span>
        </button>
        <Dinheiro valor={fz.valor} moeda={false} class="text-[16px] font-semibold" />
        <button class="h-10 shrink-0 rounded-full bg-ent-fundo px-3.5 text-[14px] font-semibold text-ent" onclick={() => pedirReceber(fz)}>Recebeu</button>
      </div>
    {/each}
  </Folha>
{/if}

{#if folha === 'receber' && rc}
  <Folha titulo="{rc.nome} pagou {fmt(rc.valor)}" aoFechar={() => (folha = 'lista')}>
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
