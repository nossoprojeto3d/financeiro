// Base dos testes de tela: abre o app no modo demonstração com os dados de exemplo zerados,
// derruba o teste se alguma chamada tentar ir ao Supabase de verdade e se aparecer erro no console.
import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, usar) => {
    const vazou = [], erros = []
    // o banco de mentira responde antes da rede; se algo passar, é falha grave
    await page.route(/supabase\.co/, rota => { vazou.push(rota.request().url()); rota.abort() })
    page.on('console', m => { if (m.type() === 'error') erros.push(m.text()) })
    page.on('pageerror', e => erros.push(e.message))

    await page.goto('/?zerar')
    await expect(page.getByText('DEMONSTRAÇÃO')).toBeVisible()
    await expect(page.getByText('Em caixa')).toBeVisible()
    await usar(page)

    expect(vazou, 'chamada ao Supabase de verdade').toEqual([])
    expect(erros, 'erro no console').toEqual([])
  },
})
export { expect }

/* ---------- Atalhos para as ações que se repetem ---------- */

// digita um valor no teclado do app (ex.: '45,90' ou '300')
export async function digitarValor(escopo, valor) {
  const digitos = valor.includes(',') ? valor.replace(',', '') : valor + '00'
  for (const d of digitos) await escopo.getByRole('button', { name: d, exact: true }).click()
}

export async function escolherCategoria(escopo, page, nome) {
  await escopo.getByRole('button', { name: /^(Escolher categoria|Categoria:)/ }).click()
  await page.getByRole('dialog', { name: 'Categoria' }).getByRole('button', { name: nome, exact: true }).click()
}

// texto de um elemento sem espaços (o Dinheiro mostra "R$" e os centavos em pedaços separados)
export const semEspacos = async loc => (await loc.innerText()).replace(/\s+/g, '')

export const aviso = (page, texto) => expect(page.getByText(texto)).toBeVisible()

// valor em reais como aparece na tela (o componente Dinheiro separa "R$" e os centavos)
export const reais = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
