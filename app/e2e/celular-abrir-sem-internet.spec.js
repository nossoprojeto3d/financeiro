// Abrir o app pela primeira vez no celular (nada guardado) sem internet: tela "Sem internet", não um giro sem fim.
import { test, expect } from '@playwright/test'

test('sem internet e sem nada guardado: mostra "Sem internet" e entra sozinho quando a conexão volta', async ({ page }) => {
  const vazou = []
  await page.route(/supabase\.co/, rota => { vazou.push(rota.request().url()); rota.abort() })
  // o banco de mentira responde como se não houvesse rede, desde o primeiro instante
  await page.addInitScript(() => { window.__semRede = true })
  await page.goto('/?zerar')
  await expect(page.getByRole('heading', { name: 'Sem internet' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()

  // ainda sem rede: tentar de novo continua na mesma tela
  await page.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(page.getByRole('heading', { name: 'Sem internet' })).toBeVisible()

  // a internet volta: entra sozinho
  await page.evaluate(() => { window.__semRede = false; dispatchEvent(new Event('online')) })
  await expect(page.getByText('Em caixa')).toBeVisible()
  expect(vazou).toEqual([])
})
