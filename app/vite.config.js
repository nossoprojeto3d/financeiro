import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Modo demonstração (npm run demo): carrega o banco de mentira antes do app,
// para ver e testar sem tocar no Supabase. Só existe no `vite --mode demo`.
const demo = {
  name: 'demo',
  // no começo do <head>: roda antes do app (que fica no fim da página)
  transformIndexHtml: () => [{ tag: 'script', attrs: { type: 'module', src: '/src/demo/bancoFalso.js' }, injectTo: 'head-prepend' }],
}

// O GitHub Pages publica a main direto da raiz: o build vai para a pasta de cima
// (index.html, assets/, sw.js, manifest, ícones). Caminhos relativos: o site fica numa subpasta.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [tailwindcss(), svelte(), ...(mode === 'demo' ? [demo] : [])],
  server: { host: true },
  build: { outDir: '..', emptyOutDir: false },
}))
