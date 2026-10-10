// Constantes do app (nomes que aparecem na tela)

export const NATUREZAS = {
  entrada: [
    ['venda', 'Venda', 'Dinheiro que entrou vendendo peças ou serviços.'],
    ['aporte', 'Dinheiro colocado', 'Dinheiro que vocês ou um investidor colocaram na empresa.'],
    ['outra', 'Outra entrada', 'Reembolsos, ajustes, saldo inicial.'],
  ],
  saida: [
    ['variavel', 'Gasto de produção', 'Aumenta quanto mais vocês vendem: filamento, embalagem, frete, taxas.'],
    ['fixa', 'Conta fixa', 'Existe mesmo se não venderem nada: assinaturas, anúncios, manutenção.'],
    ['investimento', 'Equipamento', 'Compra que dura anos: impressoras, ferramentas.'],
  ],
}
export const nomeNatureza = n => [...NATUREZAS.entrada, ...NATUREZAS.saida].find(x => x[0] === n)?.[1] || n
export const PAGAMENTOS = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Boleto', 'Transferência']

// Cores de filamento para as categorias (a categoria não guarda cor no banco:
// cada uma pega a cor pela posição na lista ordenada por id, que não muda)
const PALETA = ['#FF8A4C', '#4FE0A5', '#8FB5FF', '#C59BFF', '#FF7B8B', '#E8C07A', '#7FD4E8', '#F2E46B',
  '#B7A6FF', '#FF9ED2', '#A3E07F', '#6FD1B8', '#FFB27A', '#9AA1B1', '#D7A6FF', '#8FE0E8']
export const corDaPosicao = i => PALETA[i % PALETA.length]

// A cor da pessoa vem do banco e vai para o estilo da página: só aceita código de cor
export const corSegura = c => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#F5B83D')
