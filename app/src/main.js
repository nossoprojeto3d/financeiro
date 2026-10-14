import { mount } from 'svelte'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/instrument-sans'
import './app.css'
import App from './App.svelte'

// Modo demonstração sem o banco de mentira carregado: não abre (senão falaria com o Supabase de verdade)
if (import.meta.env.MODE === 'demo' && !window.__bancoFalso) throw new Error('Modo demonstração sem o banco de mentira')

export default mount(App, { target: document.getElementById('app') })
