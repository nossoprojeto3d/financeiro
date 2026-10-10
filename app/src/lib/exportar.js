// Exporta lançamentos em CSV (abre no Excel e no Numbers). No iPhone abre o compartilhar.
import { nomeNatureza } from './dados.js'

export function exportarCSV(lista, cat, perfil, nomeArquivo) {
  // Texto começando com = + - @ viraria fórmula no Excel: o apóstrofo força texto
  const campo = v => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"` }
  const linhas = [['Data', 'Tipo', 'Categoria', 'Natureza', 'Valor', 'Descrição', 'Pagamento', 'Quem'].map(campo).join(';')]
  lista.forEach(l => {
    const c = cat(l.categoria_id)
    linhas.push([
      l.data.split('-').reverse().join('/'), l.tipo === 'entrada' ? 'Entrada' : 'Saída', c?.nome, nomeNatureza(c?.natureza),
      l.valor.toFixed(2).replace('.', ','), l.descricao, l.forma_pagamento, perfil(l.usuario_id)?.nome,
    ].map(campo).join(';'))
  })
  const arquivo = new File(['﻿' + linhas.join('\r\n')], nomeArquivo, { type: 'text/csv' })
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    navigator.share({ files: [arquivo], title: nomeArquivo }).catch(() => {})
  } else {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(arquivo)
    a.download = nomeArquivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
}
