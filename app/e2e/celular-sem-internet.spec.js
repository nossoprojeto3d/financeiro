// Lançar sem internet (iPhone): o lançamento fica guardado no celular e vai sozinho quando a conexão volta.
import { test, expect, digitarValor, escolherCategoria, aviso, semEspacos } from './base.js'

const lancamento = page => page.getByRole('dialog', { name: 'Lançamento' })
const caixa = page => semEspacos(page.getByText('Em caixa').locator('..'))
const noBanco = (page, desc) => page.evaluate(d => window.__bancoFalso.db().lancamentos.filter(l => l.descricao === d).length, desc)

async function lancar(page, desc, valor = '30') {
  await page.getByRole('navigation').getByRole('button', { name: 'Novo lançamento' }).click()
  const l = lancamento(page)
  await digitarValor(l, valor)
  await escolherCategoria(l, page, 'Vendas Shopee')
  await l.getByPlaceholder(/^Descrição/).fill(desc)
  await l.getByRole('button', { name: 'Lançar entrada' }).click()
}

test('sem internet: lança, mostra "esperando internet" e envia sozinho quando a conexão volta', async ({ page, context }) => {
  await context.setOffline(true)
  await lancar(page, 'Feira sem sinal')
  await aviso(page, 'Sem internet: ficou guardado aqui e vai sozinho quando a conexão voltar')
  const item = page.getByRole('button', { name: /Feira sem sinal/ })
  await expect(item).toContainText('Esperando internet')
  await expect.poll(() => caixa(page)).toContain('R$5.975,50') // já conta no saldo
  expect(await noBanco(page, 'Feira sem sinal')).toBe(0)

  await context.setOffline(false)
  await aviso(page, 'O lançamento feito sem internet foi enviado')
  await expect(item).not.toContainText('Esperando internet')
  expect(await noBanco(page, 'Feira sem sinal')).toBe(1)
})

test('dá para corrigir e apagar um lançamento que ainda espera internet', async ({ page, context }) => {
  await context.setOffline(true)
  await lancar(page, 'Pedido errado')
  await page.getByRole('button', { name: /Pedido errado/ }).click()
  await lancamento(page).getByPlaceholder(/^Descrição/).fill('Pedido certo')
  await lancamento(page).getByRole('button', { name: 'Salvar alterações' }).click()
  await aviso(page, 'Alterações salvas')
  await expect(page.getByRole('button', { name: /Pedido certo/ })).toContainText('Esperando internet')

  await page.getByRole('button', { name: /Pedido certo/ }).click()
  await lancamento(page).getByRole('button', { name: 'Excluir lançamento' }).click()
  await page.getByRole('dialog', { name: 'Excluir lançamento?' }).getByRole('button', { name: 'Excluir' }).click()
  await expect(page.getByRole('button', { name: /Pedido certo/ })).toHaveCount(0)

  await context.setOffline(false)
  await page.evaluate(() => dispatchEvent(new Event('online')))
  await page.waitForTimeout(800)
  expect(await noBanco(page, 'Pedido certo') + await noBanco(page, 'Pedido errado')).toBe(0)
})

test('fechar e abrir o app com lançamento esperando: ele continua guardado e é enviado', async ({ page, context }) => {
  await context.setOffline(true)
  await lancar(page, 'Guardado no celular')
  await expect(page.getByRole('button', { name: /Guardado no celular/ })).toContainText('Esperando internet')
  await context.setOffline(false)
  await page.evaluate(() => { window.__perderResposta = false })
  await page.reload()
  await aviso(page, 'O lançamento feito sem internet foi enviado')
  expect(await noBanco(page, 'Guardado no celular')).toBe(1)
})

test('o sinal cai depois que o lançamento chegou: ao reenviar, não duplica', async ({ page }) => {
  await page.evaluate(() => { window.__perderResposta = true })
  await lancar(page, 'Sinal caiu no meio')
  await aviso(page, 'Sem internet: ficou guardado aqui e vai sozinho quando a conexão voltar')
  expect(await noBanco(page, 'Sinal caiu no meio')).toBe(1) // tinha chegado
  await page.evaluate(() => dispatchEvent(new Event('online')))
  await aviso(page, 'O lançamento feito sem internet foi enviado')
  expect(await noBanco(page, 'Sinal caiu no meio')).toBe(1) // continua um só
  await expect(page.getByRole('button', { name: /Sinal caiu no meio/ })).toHaveCount(1)
})

test('com o banco ainda sem o SQL da etiqueta, lançar e enviar a fila continuam funcionando', async ({ page, context }) => {
  await page.evaluate(() => { window.__semEtiqueta = true })
  await lancar(page, 'Sem etiqueta online')
  await aviso(page, 'Entrada lançada')
  await context.setOffline(true)
  await lancar(page, 'Sem etiqueta offline')
  await context.setOffline(false)
  await aviso(page, 'O lançamento feito sem internet foi enviado')
  expect(await noBanco(page, 'Sem etiqueta online')).toBe(1)
  expect(await noBanco(page, 'Sem etiqueta offline')).toBe(1)
})
