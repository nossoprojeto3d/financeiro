// Computador: painel de lançamento fixo à direita do Início (janela de 1359×729 e uma mais alta).
import { test, expect, escolherCategoria, aviso, semEspacos } from './base.js'

const painel = page => page.getByRole('complementary', { name: 'Lançamento' })

// o botão principal e a última fileira do teclado têm que caber no painel, sem cortar
async function cabeTudo(page) {
  const p = await painel(page).boundingBox()
  const botao = await painel(page).getByRole('button', { name: /^(Lançar entrada|Lançar saída|Anotar fiado)$/ }).boundingBox()
  const zero = await painel(page).getByRole('button', { name: '0', exact: true }).boundingBox()
  expect(botao.y + botao.height, 'botão dentro do painel').toBeLessThanOrEqual(p.y + p.height + 1)
  expect(zero.y + zero.height, 'teclado acima do botão').toBeLessThanOrEqual(botao.y + 1)
  expect(zero.height, 'tecla com altura para clicar').toBeGreaterThanOrEqual(34)
}

for (const altura of [729, 900]) {
  test(`janela de ${altura}px: botão e teclado cabem no painel, no lançamento e no fiado`, async ({ page }) => {
    await page.setViewportSize({ width: 1359, height: altura })
    await cabeTudo(page)
    await painel(page).getByRole('button', { name: /Detalhes/ }).click()
    await page.getByRole('dialog', { name: 'Detalhes' }).getByRole('button', { name: /Ainda não recebi/ }).click()
    await page.getByRole('dialog', { name: 'Detalhes' }).getByRole('button', { name: 'Pronto' }).click()
    await expect(painel(page).getByText('Novo fiado')).toBeVisible()
    await cabeTudo(page)
  })
}

test('os números do teclado do computador digitam o valor, e Enter lança', async ({ page }) => {
  const p = painel(page)
  await escolherCategoria(p, page, 'Vendas Shopee')
  await p.getByPlaceholder(/^Descrição/).fill('Teclado físico')
  await p.getByPlaceholder(/^Descrição/).blur()
  await page.keyboard.type('1250')
  await expect.poll(() => semEspacos(p)).toContain('R$12,50')
  await page.keyboard.press('Enter')
  await aviso(page, 'Entrada lançada')
  await expect(page.getByText('Teclado físico')).toBeVisible()
})

test('"Novo lançamento" com o painel em modo fiado volta ao lançamento comum', async ({ page }) => {
  await painel(page).getByRole('button', { name: /Detalhes/ }).click()
  await page.getByRole('dialog', { name: 'Detalhes' }).getByRole('button', { name: /Ainda não recebi/ }).click()
  await page.getByRole('dialog', { name: 'Detalhes' }).getByRole('button', { name: 'Pronto' }).click()
  await expect(painel(page).getByText('Novo fiado')).toBeVisible()
  await page.getByRole('navigation').getByRole('button', { name: 'Novo lançamento' }).click()
  await expect(painel(page).getByRole('radio', { name: 'Entrada' })).toBeFocused()
})

test('fora do Início, o lançamento abre numa gaveta que não corta o botão', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'Histórico' }).click()
  await page.getByRole('navigation').getByRole('button', { name: 'Novo lançamento' }).click()
  const gaveta = page.getByRole('dialog', { name: 'Lançamento' })
  await expect(gaveta).toBeVisible()
  const g = await gaveta.boundingBox()
  const b = await gaveta.getByRole('button', { name: 'Lançar entrada' }).boundingBox()
  expect(b.y + b.height).toBeLessThanOrEqual(g.y + g.height + 1)
})
