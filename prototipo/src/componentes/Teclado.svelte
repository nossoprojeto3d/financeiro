<script>
  // Teclado numérico do próprio app: não abre o teclado do iPhone
  import { Delete } from '@lucide/svelte'
  let { aoTocar, compacto = false } = $props()
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'apagar']

  let segurar
  function inicio(t) {
    if (t !== 'apagar') return
    segurar = setTimeout(() => { aoTocar('limpar'); navigator.vibrate?.(15) }, 500)
  }
  const fim = () => clearTimeout(segurar)
</script>

<div class="grid grid-cols-3 gap-1.5">
  {#each teclas as t}
    <button
      type="button"
      class="num flex items-center justify-center rounded-2xl bg-sup-2/60 text-[26px] font-medium text-txt transition-[background-color,transform] duration-100 active:scale-[0.96] active:bg-sup-3 {compacto ? 'h-12' : 'h-[clamp(48px,7.2vh,62px)]'}"
      aria-label={t === 'apagar' ? 'Apagar (segure para limpar)' : t}
      onpointerdown={() => inicio(t)}
      onpointerup={fim}
      onpointerleave={fim}
      onclick={() => aoTocar(t)}
    >
      {#if t === 'apagar'}<Delete size={24} strokeWidth={1.8} class="text-txt-2" />{:else}{t}{/if}
    </button>
  {/each}
</div>
