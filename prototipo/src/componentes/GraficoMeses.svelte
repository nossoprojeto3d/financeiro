<script>
  // Entradas e saídas mês a mês, com o resultado do mês por cima
  import { MESES, MESES_LONGO, fmtCurto } from '../lib/formato.js'
  let { meses, altura = 150 } = $props()
  let escolhido = $state(null)
  const ativo = $derived(escolhido ?? meses.length - 1)

  const max = $derived(Math.max(1, ...meses.flatMap(m => [m.ent, m.sai])))
  const h = v => Math.max(2, (v / max) * (altura - 28))
  const m = $derived(meses[ativo])
</script>

<div>
  <div class="mb-3 flex items-baseline justify-between">
    <p class="text-[13px] text-txt-2 first-letter:uppercase">{MESES_LONGO[m.mes]}</p>
    <p class="num text-[15px] font-semibold {m.res >= 0 ? 'text-ent' : 'text-sai'}">{m.res >= 0 ? 'Sobrou' : 'Faltou'} {fmtCurto(Math.abs(m.res))}</p>
  </div>
  <div class="flex items-end gap-2" style="height:{altura}px">
    {#each meses as mm, i}
      <button class="group flex h-full flex-1 flex-col items-center justify-end gap-2" onclick={() => (escolhido = i)} aria-label="{MESES[mm.mes]}: entradas {fmtCurto(mm.ent)}, saídas {fmtCurto(mm.sai)}">
        <span class="flex items-end gap-[3px]">
          <span class="w-[clamp(8px,2.6vw,14px)] rounded-t-[5px] rounded-b-[2px] bg-ent transition-opacity {i === ativo ? '' : 'opacity-35 group-hover:opacity-60'}" style="height:{h(mm.ent)}px"></span>
          <span class="w-[clamp(8px,2.6vw,14px)] rounded-t-[5px] rounded-b-[2px] bg-sai transition-opacity {i === ativo ? '' : 'opacity-35 group-hover:opacity-60'}" style="height:{h(mm.sai)}px"></span>
        </span>
        <span class="text-[12px] {i === ativo ? 'text-txt' : 'text-txt-3'}">{MESES[mm.mes]}</span>
      </button>
    {/each}
  </div>
  <div class="mt-3 flex gap-4 text-[12px] text-txt-3">
    <span class="flex items-center gap-1.5"><i class="size-2 rounded-full bg-ent"></i>Entrou {fmtCurto(m.ent)}</span>
    <span class="flex items-center gap-1.5"><i class="size-2 rounded-full bg-sai"></i>Saiu {fmtCurto(m.sai)}</span>
  </div>
</div>
