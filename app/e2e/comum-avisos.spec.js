// Avisos de vencimento: o link da notificação abre a tela certa e a linha de Ajustes aparece.
// (o envio de verdade é testado na função "avisos"; aqui não há service worker, porque o demo roda em http)
import { test, expect } from './base.js'

test('o link da notificação (./?tela=pagar) abre o app direto na tela A pagar', async ({ page }) => {
  await page.goto('/?zerar&tela=pagar')
  await expect(page.getByRole('heading', { name: 'A pagar' })).toBeVisible()
  expect(new URL(page.url()).search).toBe('') // limpa o endereço depois de usar
})

test('notificações bloqueadas no aparelho: a linha diz onde liberar', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByRole('button', { name: /Avisar vencimentos neste iPhone/ })).toContainText('Bloqueado: libere em Ajustes do iPhone')
})

test('Ajustes mostra "Avisar vencimentos" e explica quando não dá para ligar', async ({ page }) => {
  // o Chromium de teste deixa as notificações sempre bloqueadas: simula um aparelho que ainda não respondeu e aceita
  await page.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', { get: () => 'default' })
    Notification.requestPermission = async () => 'granted'
  })
  await page.reload()
  await page.getByRole('navigation').getByRole('button', { name: 'Ajustes' }).click()
  const linha = page.getByRole('button', { name: /Avisar vencimentos neste iPhone/ })
  await expect(linha).toContainText('Todo dia às 8h, se houver conta vencendo ou atrasada')
  await linha.click()
  // sem o app instalado (sem service worker) não liga, e diz o que fazer
  await expect(page.getByText('Abra o app instalado (pela tela de início) para ligar os avisos.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Mandar notificação de teste/ })).toHaveCount(0)
})

// O toque na notificação anota a tela no cache "caixa-aviso" (é o que o service worker faz no iPhone)
const anotar = (page, em) => page.evaluate(async em => {
  const c = await caches.open('caixa-aviso')
  await c.put('./tela-pedida', new Response(JSON.stringify({ tela: 'pagar', em })))
}, em)
const voltarParaFrente = page => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

test('tocar na notificação com o app em segundo plano: ao voltar para a frente, abre em A pagar', async ({ page }) => {
  await anotar(page, Date.now())
  await voltarParaFrente(page)
  await expect(page.getByRole('heading', { name: 'A pagar' })).toBeVisible()
  // a anotação é usada uma vez só
  await page.getByRole('button', { name: 'Voltar ao Início' }).click()
  await voltarParaFrente(page)
  await expect(page.getByText('Em caixa')).toBeVisible()
})

test('tocar na notificação com o app fechado: ao abrir, vai para A pagar', async ({ page }) => {
  await anotar(page, Date.now())
  await page.reload()
  await expect(page.getByRole('heading', { name: 'A pagar' })).toBeVisible()
})

test('anotação de mais de 10 minutos atrás é ignorada', async ({ page }) => {
  await anotar(page, Date.now() - 11 * 60e3)
  await voltarParaFrente(page)
  await page.waitForTimeout(300)
  await expect(page.getByText('Em caixa')).toBeVisible()
})
