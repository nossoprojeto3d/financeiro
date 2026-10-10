import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// base relativa: o GitHub Pages publica numa subpasta
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), svelte()],
  server: { host: true },
})
