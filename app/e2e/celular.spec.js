// Fluxos do dia a dia no iPhone (390×844), com os dados de exemplo do modo demonstração.
import { test, expect, digitarValor, escolherCategoria, aviso, semEspacos } from './base.js'

const lancamento = page => page.getByRole('dialog', { name: 'Lançamento' })
const caixa = async page => semEspacos(page.getByText('Em caixa').locator('..'))
const novoLancamento = page => page.getByRole('navigation').getByRole('button', { name: 'Novo lançamento' }).click()

test.describe('lançamentos', () => {
  test('lançar uma entrada aumenta o caixa e aparece nos últimos', async ({ page }) => {
    const antes = await caixa(page)
    await novoLancamento(page)
    const l = lancamento(page)
    await digitarValor(l, '45,90')
    await escolherCategoria(l, page, 'Vendas Shopee')
    await l.getByPlaceholder(/^Descrição/).fill('Pedido teste 123')
    await l.getByRole('button', { name: 'Lançar entrada' }).click()
    await aviso(page, 'Entrada lançada')
    await expect(l).toBeHidden()
    await expect(page.getByText('Pedido teste 123')).toBeVisible()
    // o saldo anima até o valor novo: espera chegar
    await expect.poll(() => caixa(page)).toContain('R$5.991,40') // 5.945,50 + 45,90
    expect(antes).toContain('R$5.945,50')
  })

  test('lançar uma saída', async ({ page }) => {
    await novoLancamento(page)
    const l = lancamento(page)
    await l.getByRole('radio', { name: 'Saída' }).click()
    await digitarValor(l, '20')
    await escolherCategoria(l, page, 'Filamento')
    await l.getByPlaceholder(/^Descrição/).fill('Rolo PLA teste')
    await l.getByRole('button', { name: 'Lançar saída' }).click()
    await aviso(page, 'Saída lançada')
    await expect(page.getByText('Rolo PLA teste')).toBeVisible()
    await expect.poll(() => caixa(page)).toContain('R$5.925,50')
  })

  test('não deixa lançar sem valor, categoria ou descrição', async ({ page }) => {
    await novoLancamento(page)
    const l = lancamento(page)
    await l.getByRole('button', { name: 'Lançar entrada' }).click()
    await aviso(page, 'Digite o valor.')
    await digitarValor(l, '10')
    await l.getByRole('button', { name: 'Lançar entrada' }).click()
    await aviso(page, 'Escolha a categoria.')
    await escolherCategoria(l, page, 'Vendas Shopee')
    await l.getByRole('button', { name: 'Lançar entrada' }).click()
    await aviso(page, 'Escreva a descrição.')
    await expect(l).toBeVisible()
  })

  test('editar e excluir um lançamento', async ({ page }) => {
    await page.getByText('Assinatura de modelos 3D').first().click()
    const l = lancamento(page)
    await expect(l.getByText('Editando saída')).toBeVisible()
    await l.getByPlaceholder(/^Descrição/).fill('Assinatura editada')
    await l.getByRole('button', { name: 'Salvar alterações' }).click()
    await aviso(page, 'Alterações salvas')
    await page.getByText('Assinatura editada').click()
    await lancamento(page).getByRole('button', { name: 'Excluir lançamento' }).click()
    await page.getByRole('dialog', { name: 'Excluir lançamento?' }).getByRole('button', { name: 'Excluir' }).click()
    await aviso(page, 'Lançamento excluído')
    await expect(page.getByText('Assinatura editada')).toBeHidden()
  })
})

test.describe('fiados', () => {
  const abrirAReceber = async page => {
    await page.getByRole('button', { name: /^A receber/ }).click()
    await expect(page.getByRole('heading', { name: 'A receber' })).toBeVisible()
  }
  const linha = (page, nome) => page.getByRole('list', { name: 'Quem deve' }).getByRole('listitem').filter({ hasText: nome })
  const total = page => semEspacos(page.getByRole('main').locator('section').first())

  test('o cartão do Início mostra o total e leva para a lista', async ({ page }) => {
    const cartao = page.getByRole('button', { name: /^A receber/ })
    expect(await semEspacos(cartao)).toContain('R$1.030,50')
    expect(await semEspacos(cartao)).toContain('7pessoas')
    await abrirAReceber(page)
    await expect(linha(page, 'Seu Zé (oficina)')).toBeVisible()
    await expect(linha(page, 'Dona Lúcia')).toContainText('pagou R$ 120,00 de R$ 200,00')
    await page.getByRole('button', { name: 'Voltar ao Início' }).click()
    await expect(page.getByText('Em caixa')).toBeVisible()
  })

  test('anotar um fiado pela tela A receber (o nome é obrigatório)', async ({ page }) => {
    await abrirAReceber(page)
    await page.getByRole('main').getByRole('button', { name: 'Anotar fiado' }).click()
    const l = lancamento(page)
    await expect(l.getByText('Novo fiado')).toBeVisible()
    await expect(l.getByRole('button', { name: /^Categoria: Vendas Shopee/ })).toBeVisible() // já vem marcada
    await digitarValor(l, '45')
    await l.getByRole('button', { name: 'Anotar fiado' }).click()
    await aviso(page, 'Escreva quem deve.')
    await l.getByLabel('Quem deve').fill('Cliente Teste')
    await l.getByPlaceholder(/^O que levou/).fill('Chaveiro')
    await l.getByRole('button', { name: 'Anotar fiado' }).click()
    await aviso(page, 'Fiado anotado')
    await expect(linha(page, 'Cliente Teste')).toContainText('45,00')
    expect(await total(page)).toContain('R$1.075,50')
  })

  test('anotar fiado pelo lançamento comum (Detalhes › Ainda não recebi)', async ({ page }) => {
    await novoLancamento(page)
    const l = lancamento(page)
    await l.getByRole('button', { name: /Detalhes/ }).click()
    const det = page.getByRole('dialog', { name: 'Detalhes' })
    await expect(det.getByText('Forma de pagamento')).toBeVisible()
    await det.getByRole('button', { name: /Ainda não recebi/ }).click()
    await expect(det.getByText('Forma de pagamento')).toBeHidden()
    await expect(det.getByText('Repetir todo mês')).toBeHidden()
    await det.getByRole('button', { name: 'Pronto' }).click()
    await expect(l.getByLabel('Quem deve')).toBeVisible()
    await expect(l.getByRole('button', { name: 'Anotar fiado' })).toBeVisible()
  })

  test('receber tudo: vira venda e sai da lista', async ({ page }) => {
    await abrirAReceber(page)
    await linha(page, 'João').getByRole('button', { name: 'Recebeu' }).click()
    const r = page.getByRole('dialog', { name: 'Recebeu de João' })
    await r.getByRole('button', { name: 'Confirmar R$ 150,00' }).click()
    await aviso(page, 'Escolha a forma de pagamento.')
    await r.getByRole('button', { name: 'Pix' }).click()
    await r.getByRole('button', { name: 'Confirmar R$ 150,00' }).click()
    await aviso(page, 'Recebido · entrou no caixa')
    await expect(linha(page, 'João')).toHaveCount(0)
    await page.getByRole('navigation').getByRole('button', { name: 'Histórico' }).click()
    await expect(page.getByText('João · Luminária lua').filter({ visible: true })).toHaveCount(1)
  })

  test('receber só uma parte: fica o que falta, e não aceita mais que o devido', async ({ page }) => {
    await abrirAReceber(page)
    await linha(page, 'Seu Zé').getByRole('button', { name: 'Recebeu' }).click()
    const r = page.getByRole('dialog', { name: /^Recebeu de Seu Zé/ })
    await expect(r.getByRole('button', { name: 'Tudo · R$ 600,00' })).toBeVisible()
    await r.getByRole('button', { name: 'Só uma parte' }).click()
    await digitarValor(r, '700')
    await expect(r.getByText('Mais do que falta (R$ 600,00)')).toBeVisible()
    await r.getByRole('button', { name: 'Pix' }).click()
    await r.getByRole('button', { name: 'Confirmar R$ 700,00' }).click()
    await aviso(page, 'O que falta é R$ 600,00.')
    for (let i = 0; i < 6; i++) await r.getByRole('button', { name: /^Apagar/ }).click()
    await digitarValor(r, '300')
    await expect(r.getByText('Vai faltar R$ 300,00')).toBeVisible()
    await r.getByRole('button', { name: 'Confirmar R$ 300,00' }).click()
    await aviso(page, 'Recebido R$ 300,00 · faltam R$ 300,00')
    await expect(linha(page, 'Seu Zé')).toContainText('pagou R$ 300,00 de R$ 600,00')
    await expect(linha(page, 'Seu Zé')).toContainText('300,00')
    // no próximo, "Tudo" quita o resto
    await linha(page, 'Seu Zé').getByRole('button', { name: 'Recebeu' }).click()
    await r.getByRole('button', { name: 'Dinheiro' }).click()
    await r.getByRole('button', { name: 'Confirmar R$ 300,00' }).click()
    await expect(linha(page, 'Seu Zé')).toHaveCount(0)
  })

  test('editar fiado já pago em parte não deixa o total ficar menor que o pago', async ({ page }) => {
    await abrirAReceber(page)
    await linha(page, 'Dona Lúcia').getByRole('button', { name: /^Dona Lúcia/ }).click()
    const l = lancamento(page)
    await expect(l.getByText('Já pagou R$ 120,00 · falta R$ 80,00')).toBeVisible()
    for (let i = 0; i < 8; i++) await l.getByRole('button', { name: /^Apagar/ }).click()
    await digitarValor(l, '100')
    await l.getByRole('button', { name: 'Salvar alterações' }).click()
    await aviso(page, 'O valor tem que ser maior que o já pago (R$ 120,00).')
  })

  test('excluir um fiado', async ({ page }) => {
    await abrirAReceber(page)
    await linha(page, 'Bia').getByRole('button', { name: /^Bia/ }).click()
    await lancamento(page).getByRole('button', { name: 'Excluir fiado' }).click()
    const conf = page.getByRole('dialog', { name: 'Excluir fiado?' })
    await expect(conf).toContainText('O fiado de Bia (R$ 25,00)')
    await conf.getByRole('button', { name: 'Excluir' }).click()
    await aviso(page, 'Fiado excluído')
    await expect(linha(page, 'Bia')).toHaveCount(0)
  })

  test('o Recebeu mostra o que já foi pago, com data e forma', async ({ page }) => {
    await abrirAReceber(page)
    await linha(page, 'Dona Lúcia').getByRole('button', { name: 'Recebeu' }).click()
    const r = page.getByRole('dialog', { name: 'Recebeu de Dona Lúcia' })
    await expect(r.getByText('Já pagou')).toBeVisible()
    await expect(r.getByText(/ · Pix$/)).toBeVisible()
    expect(await semEspacos(r)).toContain('120,00')
    await expect(r.getByRole('button', { name: 'Tudo · R$ 80,00' })).toBeVisible()
  })

  test('se o outro celular registrar um pagamento antes, recusa e mostra a lista atualizada', async ({ page }) => {
    await abrirAReceber(page)
    await linha(page, 'Seu Zé').getByRole('button', { name: 'Recebeu' }).click()
    const r = page.getByRole('dialog', { name: /^Recebeu de Seu Zé/ })
    await r.getByRole('button', { name: 'Só uma parte' }).click()
    await digitarValor(r, '300')
    await r.getByRole('button', { name: 'Pix' }).click()
    // enquanto isso, a Thai registra R$ 100 do Seu Zé no celular dela
    await page.evaluate(() => {
      const b = window.__bancoFalso, ze = b.db().fiados.find(f => f.id === 6)
      ze.pago = 100; ze.atualizado_em = 'outro-celular'; b.salvar()
    })
    await r.getByRole('button', { name: 'Confirmar R$ 300,00' }).click()
    await aviso(page, 'Esse fiado mudou agora há pouco (outro pagamento ou edição). Confira a lista e tente de novo.')
    await expect(r).toBeHidden()
    await expect(linha(page, 'Seu Zé')).toContainText('pagou R$ 100,00 de R$ 600,00')
    const vendasDoZe = await page.evaluate(() => window.__bancoFalso.db().lancamentos.filter(l => l.fiado_id === 6).length)
    expect(vendasDoZe).toBe(0) // não lançou em cima do valor velho
  })

  test('excluir categoria com fiados diz quantos lançamentos e quantos fiados vão ser movidos', async ({ page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Ajustes' }).click()
    await page.getByRole('button', { name: 'Entradas' }).click()
    await page.getByRole('button', { name: /^Encomendas personalizadas/ }).click()
    await page.getByRole('button', { name: 'Excluir categoria' }).click()
    await expect(page.getByText(/^Mover \d+ lançamentos e 4 fiados para$/)).toBeVisible()
  })

  test('com o banco ainda sem o SQL do histórico, receber continua funcionando', async ({ page }) => {
    await page.evaluate(() => { window.__semHistoricoFiado = true })
    await abrirAReceber(page)
    await linha(page, 'João').getByRole('button', { name: 'Recebeu' }).click()
    const r = page.getByRole('dialog', { name: 'Recebeu de João' })
    await r.getByRole('button', { name: 'Pix' }).click()
    await r.getByRole('button', { name: 'Confirmar R$ 150,00' }).click()
    await aviso(page, 'Recebido · entrou no caixa')
    await expect(linha(page, 'João')).toHaveCount(0)
  })
})
