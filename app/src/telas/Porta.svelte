<script>
  // Login (só a senha: a pessoa escolhe quem é), trava com Face ID e carregamento
  import { Eye, EyeOff, LockKeyhole, ScanFace, ArrowRight } from '@lucide/svelte'
  import { CONFIG } from '../lib/config.js'
  import { S, login, desbloquear, trocarParaSenha } from '../lib/estado.svelte.js'

  const usuarios = CONFIG.USUARIOS || []
  const CORES = ['#F5B83D', '#8FB5FF']
  const ultimo = localStorage.getItem('caixa_email') || usuarios[0]?.email || ''
  let escolhido = $state(Math.max(0, usuarios.findIndex(u => u.email === ultimo)))
  let senha = $state('')
  let mostrar = $state(false)
  let entrando = $state(false)
  let campo = $state()

  async function enviar(e) {
    e.preventDefault()
    if (entrando) return
    const u = usuarios[escolhido]
    if (!senha) { S.erroLogin = 'Digite a senha.'; campo?.focus(); return }
    entrando = true
    try { await login(u.email, senha, u.nome) }
    catch (err) { S.erroLogin = err.message }
    finally { entrando = false }
  }

  // Trava: não pede o Face ID sozinho ao abrir (sem um toque, o iPhone mostra antes
  // a tela "Usar chave-senha"). Qualquer toque na tela chama o Face ID direto.
  let tentando = false
  let erroTrava = $state('')
  async function tentar() {
    if (tentando) return
    tentando = true
    erroTrava = ''
    try { await desbloquear() }
    catch (_) { erroTrava = 'Não foi possível confirmar. Toque para tentar de novo.' }
    finally { tentando = false }
  }
  const nome = localStorage.getItem('caixa_nome') || ''
</script>

{#snippet marca()}
  <div class="flex flex-col items-center">
    <svg viewBox="0 0 64 64" class="size-16" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="var(--color-sup)" />
      <g fill="var(--color-ambar)">
        <rect x="14" y="40" width="36" height="5" rx="2.5" /><rect x="18" y="32" width="28" height="5" rx="2.5" opacity=".75" />
        <rect x="22" y="24" width="20" height="5" rx="2.5" opacity=".5" /><rect x="26" y="16" width="12" height="5" rx="2.5" opacity=".3" />
      </g>
    </svg>
    <h1 class="num mt-4 text-[30px] font-semibold">Financeiro</h1>
    <p class="text-[13px] text-txt-3">Nosso Projeto 3D</p>
  </div>
{/snippet}

<div class="flex min-h-dvh flex-col items-center justify-center px-6 pt-seguro pb-seguro">
  {#if S.fase === 'carregando'}
    <span class="size-8 animate-spin rounded-full border-2 border-ambar/25 border-t-ambar" aria-label="Carregando"></span>
  {:else if S.fase === 'trava'}
    <button class="flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-10" onclick={tentar}>
      {@render marca()}
      <span class="flex flex-col items-center gap-3">
        <span class="grid size-20 place-items-center rounded-[26px] bg-sup text-ambar"><ScanFace size={40} strokeWidth={1.6} /></span>
        <span class="text-[15px] text-txt-2">{nome ? `Oi, ${nome}. ` : ''}Toque para desbloquear</span>
        {#if erroTrava}<span class="text-center text-[13px] text-sai">{erroTrava}</span>{/if}
      </span>
    </button>
    <button class="mb-6 h-11 px-4 text-[14px] text-txt-2" onclick={trocarParaSenha}>Entrar com senha</button>
  {:else}
    <form class="w-full max-w-sm" onsubmit={enviar} autocomplete="on">
      {@render marca()}
      <div class="mt-10 grid grid-cols-2 gap-2 rounded-[22px] bg-sup p-1.5" role="radiogroup" aria-label="Quem está entrando">
        {#each usuarios as u, i}
          <button type="button" role="radio" aria-checked={escolhido === i}
            class="flex h-12 items-center justify-center gap-2.5 rounded-[17px] text-[15px] font-medium transition-colors {escolhido === i ? 'bg-sup-3 text-txt' : 'text-txt-3'}"
            onclick={() => { escolhido = i; campo?.focus() }}>
            <span class="grid size-7 place-items-center rounded-full text-[13px] font-semibold text-fundo" style="background:{CORES[i % 2]}">{u.nome[0]}</span>{u.nome}
          </button>
        {/each}
      </div>
      <!-- e-mail escondido: o iPhone usa para preencher a senha guardada -->
      <input class="sr-only" type="email" name="username" autocomplete="username" value={usuarios[escolhido]?.email || ''} tabindex="-1" readonly />
      <label class="relative mt-3 block">
        <LockKeyhole size={18} class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-txt-3" />
        <input bind:this={campo} bind:value={senha} type={mostrar ? 'text' : 'password'} name="password" autocomplete="current-password" placeholder="Senha"
          class="h-14 w-full rounded-[20px] border border-linha bg-sup pr-14 pl-12 text-[16px] placeholder:text-txt-3 focus:border-sup-3 focus:outline-none" />
        <button type="button" class="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-txt-3"
          aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'} onclick={() => (mostrar = !mostrar)}>
          {#if mostrar}<EyeOff size={19} />{:else}<Eye size={19} />{/if}
        </button>
      </label>
      {#if S.erroLogin}<p class="mt-3 text-center text-[13px] text-sai">{S.erroLogin}</p>{/if}
      <button type="submit" disabled={entrando}
        class="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-ambar text-[16px] font-semibold text-fundo active:scale-[0.98] disabled:opacity-60">
        {#if entrando}<span class="size-5 animate-spin rounded-full border-2 border-fundo/30 border-t-fundo"></span>{:else}Entrar<ArrowRight size={18} />{/if}
      </button>
    </form>
  {/if}
</div>
