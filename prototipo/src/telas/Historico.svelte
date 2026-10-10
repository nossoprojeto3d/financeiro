<script>
  import { Search, ChevronLeft, ChevronRight, X } from '@lucide/svelte'
  import ItemLanc from '../componentes/ItemLanc.svelte'
  import Dinheiro from '../componentes/Dinheiro.svelte'
  import { S, cat, perfil, abrirLancar } from '../lib/estado.svelte.js'
  import { MESES_LONGO, dataBonita, dataCurta, iso } from '../lib/formato.js'

  let busca = $state('')
  let tipo = $state('todos')
  const h = new Date()
  let mes = $state(new Date(h.getFullYear(), h.getMonth(), 1))
  const chave = $derived(iso(mes).slice(0, 7))
  const ehAtual = $derived(mes.getFullYear() === h.getFullYear() && mes.getMonth() === h.getMonth())
  // não deixa voltar antes do primeiro lançamento
  const primeiro = $derived(S.lancs.reduce((m, l) => (l.data < m ? l.data : m), iso(h)).slice(0, 7))
  const ehPrimeiro = $derived(chave <= primeiro)
  const mudarMes = d => { mes = new Date(mes.getFullYear(), mes.getMonth() + d, 1) }

  const norm = s => (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  // Buscando, procura em todos os meses
  const lista = $derived(S.lancs.filter(l => {
    if (tipo !== 'todos' && l.tipo !== tipo) return false
    if (busca.trim()) {
      const q = norm(busca.trim())
      return norm(l.descricao).includes(q) || norm(cat(l.categoria_id)?.nome).includes(q) || String(l.valor).includes(q.replace(',', '.'))
    }
    return l.data.startsWith(chave)
  }))
  const abrir = l => abrirLancar(l.tipo, l)
</script>

<div class="space-y-4">
  <header class="flex items-center justify-between pt-1">
    <h1 class="num text-[26px] font-semibold lg:text-[32px]">Histórico</h1>
    {#if !busca}
      <div class="flex items-center gap-1">
        <button class="grid size-11 place-items-center rounded-full text-txt-2 hover:bg-sup-2 disabled:opacity-25" aria-label="Mês anterior" disabled={ehPrimeiro} onclick={() => mudarMes(-1)}><ChevronLeft size={20} /></button>
        <span class="min-w-[96px] text-center text-[15px] font-medium capitalize">{MESES_LONGO[mes.getMonth()]}{mes.getFullYear() !== h.getFullYear() ? ` ${mes.getFullYear()}` : ''}</span>
        <button class="grid size-11 place-items-center rounded-full text-txt-2 hover:bg-sup-2 disabled:opacity-25" aria-label="Próximo mês" disabled={ehAtual} onclick={() => mudarMes(1)}><ChevronRight size={20} /></button>
      </div>
    {/if}
  </header>

  <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
    <label class="relative block lg:w-80">
      <Search size={17} class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-txt-3" />
      <input bind:value={busca} type="search" enterkeyhint="search" placeholder="Buscar em todos os meses"
        class="h-11 w-full rounded-full border border-linha bg-sup pr-10 pl-10 text-[16px] placeholder:text-txt-3 focus:border-sup-3 focus:outline-none [&::-webkit-search-cancel-button]:hidden" />
      {#if busca}<button class="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-txt-3" aria-label="Limpar busca" onclick={() => (busca = '')}><X size={16} /></button>{/if}
    </label>
    <div class="flex gap-2">
      {#each [['todos', 'Tudo'], ['entrada', 'Entradas'], ['saida', 'Saídas']] as [v, r]}
        <button class="h-10 rounded-full px-4 text-[14px] font-medium transition-colors {tipo === v ? 'bg-txt text-fundo' : 'border border-linha text-txt-2'}" onclick={() => (tipo = v)}>{r}</button>
      {/each}
    </div>
  </div>

  {#if !lista.length}
    <div class="py-16 text-center">
      <p class="text-[15px] text-txt-2">{busca ? `Nada encontrado para “${busca}”.` : 'Nenhum lançamento nesse mês.'}</p>
    </div>
  {:else}
    <!-- Celular: lista por dia -->
    <div class="-mx-2 lg:hidden">
      {#each lista as l, i (l.id)}
        {#if i === 0 || lista[i - 1].data !== l.data}
          <p class="sticky top-[env(safe-area-inset-top)] z-10 bg-fundo/90 px-3 pt-4 pb-1.5 text-[12px] text-txt-3 backdrop-blur first-letter:uppercase">{dataBonita(l.data)}</p>
        {/if}
        <ItemLanc {l} aoAbrir={abrir} />
      {/each}
    </div>

    <!-- Computador: tabela -->
    <div class="hidden overflow-hidden rounded-[24px] border border-linha bg-sup lg:block">
      <table class="w-full text-left text-[14px]">
        <thead class="text-[12px] text-txt-3">
          <tr class="border-b border-linha">
            <th class="py-3 pl-5 font-normal">Data</th>
            <th class="py-3 font-normal">Descrição</th>
            <th class="py-3 font-normal">Categoria</th>
            <th class="py-3 font-normal">Pagamento</th>
            <th class="py-3 font-normal">Quem</th>
            <th class="py-3 pr-5 text-right font-normal">Valor</th>
          </tr>
        </thead>
        <tbody>
          {#each lista as l (l.id)}
            {@const c = cat(l.categoria_id)}
            <tr class="cursor-pointer border-b border-linha/50 transition-colors last:border-0 hover:bg-sup-2/60 {S.lancar?.id === l.id ? 'bg-sup-2' : ''}" onclick={() => abrir(l)}>
              <td class="py-3 pl-5 whitespace-nowrap text-txt-2">{dataCurta(l.data)}</td>
              <td class="max-w-[280px] truncate py-3 pr-4">{l.descricao || '—'}</td>
              <td class="py-3 pr-4 whitespace-nowrap text-txt-2"><span class="mr-2 inline-block size-2 rounded-full align-middle" style="background:{c?.cor}"></span>{c?.nome}</td>
              <td class="py-3 pr-4 text-txt-2">{l.forma_pagamento || '—'}</td>
              <td class="py-3 pr-4 text-txt-2">{perfil(l.usuario_id)?.nome}</td>
              <td class="py-3 pr-5 text-right"><Dinheiro valor={l.tipo === 'entrada' ? l.valor : -l.valor} sinal moeda={false} class="font-semibold {l.tipo === 'entrada' ? 'text-ent' : ''}" /></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
