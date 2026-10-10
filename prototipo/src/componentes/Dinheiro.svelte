<script>
  // Valor com os centavos menores, para o olho ler os reais primeiro
  import { partes } from '../lib/formato.js'
  let { valor = 0, sinal = false, class: cls = '', moeda = true } = $props()
  const p = $derived(partes(valor))
</script>

<span class="num whitespace-nowrap {cls}"
  >{#if sinal}{valor < 0 ? '−' : '+'}{:else}{p.sinal}{/if}{#if moeda}<span class="mr-[0.12em] text-[0.55em] font-medium opacity-60">R$</span>{/if}{p.reais}<span class="text-[0.6em] opacity-60">,{p.cents}</span></span
>
