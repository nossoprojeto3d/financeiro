<script>
  // A meta do mês desenhada como uma peça sendo impressa: cada camada é 1/N da meta mínima
  import { onMount } from 'svelte'
  let { progresso = 0, camadas = 18, largura = 120, altura = 132 } = $props()

  const passo = $derived(altura / camadas)
  // perfil de vaso: base, barriga, pescoço e boca (pontos interpolados suavemente)
  const pontos = [[0, 0.56], [0.3, 0.96], [0.72, 0.42], [0.88, 0.4], [1, 0.62]]
  function perfil(t) {
    let i = 0
    while (i < pontos.length - 2 && t > pontos[i + 1][0]) i++
    const [t0, w0] = pontos[i], [t1, w1] = pontos[i + 1]
    const k = (1 - Math.cos(((t - t0) / (t1 - t0)) * Math.PI)) / 2
    return w0 + (w1 - w0) * k
  }
  const linhas = $derived(Array.from({ length: camadas }, (_, i) => {
    const t = i / (camadas - 1)
    const w = largura * perfil(t)
    return { x: (largura - w) / 2, y: altura - (i + 1) * passo, w }
  }))
  const cheias = $derived(Math.round(Math.min(1, Math.max(0, progresso)) * camadas))
  const batida = $derived(progresso >= 1)

  // a peça "imprime" uma vez ao abrir a tela
  let mostradas = $state(0)
  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { mostradas = cheias; return }
    let i = 0
    const t = setInterval(() => { mostradas = Math.min(cheias, ++i); if (i >= cheias) clearInterval(t) }, 55)
    return () => clearInterval(t)
  })
  $effect(() => { if (mostradas > cheias) mostradas = cheias })
  const topo = $derived(linhas[Math.max(0, mostradas - 1)])
</script>

<svg viewBox="0 0 {largura} {altura + 14}" width={largura} height={altura + 14} aria-hidden="true" class="overflow-visible">
  <!-- mesa -->
  <rect x="-6" y={altura + 6} width={largura + 12} height="3" rx="1.5" fill="var(--color-sup-3)" />
  {#each linhas as l, i}
    <rect
      x={l.x} y={l.y + 1} width={l.w} height={passo - 2.2} rx={(passo - 2.2) / 2}
      fill={i < mostradas ? (batida ? 'var(--color-ent)' : 'var(--color-ambar)') : 'none'}
      stroke={i < mostradas ? 'none' : 'var(--color-sup-3)'}
      stroke-width="1"
      stroke-dasharray={i < mostradas ? '' : '2 3'}
      opacity={i < mostradas ? 0.55 + 0.45 * (i / camadas) : 0.9}
    />
  {/each}
  {#if mostradas > 0 && !batida}
    <!-- bico: fica em cima da última camada pronta -->
    <g transform="translate({largura / 2} {topo.y - 3})" class="transition-transform">
      <path d="M-5 -12 h10 l-3 7 h-4 z" fill="var(--color-txt-2)" />
      <circle r="1.8" cy="-2" fill="var(--color-ambar-forte)" class="animate-pulse" />
    </g>
  {/if}
</svg>
