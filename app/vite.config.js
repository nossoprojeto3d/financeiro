import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// O GitHub Pages publica a main direto da raiz: o build vai para a pasta de cima
// (index.html, assets/, sw.js, manifest, ícones). Caminhos relativos: o site fica numa subpasta.
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), svelte()],
  server: { host: true },
  build: { outDir: '..', emptyOutDir: false },
})
