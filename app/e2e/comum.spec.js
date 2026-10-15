// Vale para o celular e para o computador: todas as telas abrem sem erro.
import { test, expect } from './base.js'

const ir = (page, nome) => page.getByRole('navigation').getByRole('button', { name: nome }).click()

test('Início mostra caixa, vendas do mês, A receber e últimos lançamentos', async ({ page }) => {
  await expect(page.getByText(/^Vendas de /)).toBeVisible()
  await expect(page.getByRole('button', { name: /^A receber/ })).toBeVisible()
  await expect(page.getByText('Últimos lançamentos')).toBeVisible()
})

test('Histórico, Gestão e Ajustes abrem, e a Gestão desenha os gráficos', async ({ page }) => {
  await ir(page, 'Histórico')
  await expect(page.getByRole('heading', { name: 'Histórico' })).toBeVisible()

  await ir(page, 'Gestão')
  await expect(page.getByRole('heading', { name: 'Gestão' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Últimos 6 meses' })).toBeVisible()
  expect(await page.getByRole('main').locator('svg rect, svg path').count()).toBeGreaterThan(5)

  await ir(page, 'Ajustes')
  await expect(page.getByRole('heading', { name: 'Junior' })).toBeVisible()
  await expect(page.getByText(/versão \d+\.\d+\.\d+/)).toBeVisible()
})

test('nada vaza para os lados da tela', async ({ page }) => {
  for (const tela of ['Início', 'Histórico', 'Gestão', 'Ajustes']) {
    await ir(page, tela)
    const largura = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
    expect(largura[0], `tela ${tela}`).toBeLessThanOrEqual(largura[1])
  }
})

test('a Gestão mostra quanto há a receber e leva para a lista', async ({ page }) => {
  await ir(page, 'Gestão')
  const linha = page.getByRole('button', { name: /^A receber agora/ })
  expect((await linha.innerText()).replace(/\s+/g, '')).toContain('R$1.030,50')
  await linha.click()
  await expect(page.getByRole('heading', { name: 'A receber' })).toBeVisible()
})
