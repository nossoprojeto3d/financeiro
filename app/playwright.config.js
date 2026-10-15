// Testes de tela (npm run test:e2e): o app roda no modo demonstração, com o banco de mentira
// (src/demo/bancoFalso.js). Nunca toca no Supabase de verdade: e2e/base.js derruba o teste
// se alguma chamada tentar sair para lá.
import { defineConfig, devices } from '@playwright/test'

const PORTA = 5199 // outra porta, para não brigar com o `npm run demo` aberto

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list', { printSteps: false }]],
  timeout: 20_000,
  expect: { timeout: 4_000 },
  use: {
    baseURL: `http://localhost:${PORTA}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // iPhone 12/13/14 (390×844): é como eles usam no dia a dia
    { name: 'celular', testMatch: /celular|comum/, use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    // janela do computador do Junior (1359×729) e uma maior
    { name: 'computador', testMatch: /computador|comum/, use: { viewport: { width: 1359, height: 729 } } },
  ],
  webServer: {
    command: `npx vite --mode demo --port ${PORTA} --strictPort`,
    url: `http://localhost:${PORTA}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
