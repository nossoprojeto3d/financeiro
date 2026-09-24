// Gráficos em SVG puro, sem bibliotecas.
const Charts = (() => {
  const PALETA = ['#C9A227', '#8FB5C9', '#D98B6E', '#8FBF7F', '#E7C873', '#B58FC9',
    '#C9C1B0', '#6FA89B', '#B08D2B', '#D9A5B3', '#A69C87', '#7F8FBF'];
  const cor = i => PALETA[i % PALETA.length];

  // meses: [{ rotulo, ent, sai }]
  function barrasMensais(meses) {
    const W = 340, H = 186, topo = 18, base = 30;
    const alt = H - topo - base;
    const max = Math.max(1, ...meses.flatMap(m => [m.ent, m.sai]));
    const gw = W / meses.length;
    const bw = Math.min(15, gw * 0.28);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="grafico" role="img" aria-label="Entradas e saídas por mês">`;
    for (let i = 1; i <= 3; i++) {
      const y = topo + alt * (1 - i / 3);
      s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="g-grade"/>`;
    }
    s += `<text x="0" y="11" class="g-eixo">${esc(fmtCurto(max))}</text>`;
    meses.forEach((m, i) => {
      const cx = gw * i + gw / 2;
      const h1 = m.ent ? Math.max(2, alt * m.ent / max) : 0;
      const h2 = m.sai ? Math.max(2, alt * m.sai / max) : 0;
      s += `<rect x="${cx - bw - 1.5}" y="${topo + alt - h1}" width="${bw}" height="${h1}" rx="3" fill="var(--ent)"><title>${esc(m.rotulo)} · entradas ${esc(fmt(m.ent))}</title></rect>`;
      s += `<rect x="${cx + 1.5}" y="${topo + alt - h2}" width="${bw}" height="${h2}" rx="3" fill="var(--sai)"><title>${esc(m.rotulo)} · saídas ${esc(fmt(m.sai))}</title></rect>`;
      const res = m.ent - m.sai;
      if (m.ent || m.sai) {
        s += `<circle cx="${cx}" cy="${H - base + 9}" r="2.2" fill="${res >= 0 ? 'var(--ent)' : 'var(--sai)'}"/>`;
      }
      s += `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="g-eixo">${esc(m.rotulo)}</text>`;
    });
    s += `<line x1="0" x2="${W}" y1="${topo + alt}" y2="${topo + alt}" class="g-base"/>`;
    return s + '</svg>';
  }

  // itens: [{ rotulo, valor, cor }]
  function rosca(itens, rotuloCentro) {
    const total = itens.reduce((a, b) => a + b.valor, 0) || 1;
    const r = 46, c = 2 * Math.PI * r;
    let off = 0;
    let s = `<svg viewBox="0 0 120 120" class="rosca" role="img" aria-label="Distribuição por categoria">`;
    s += `<circle r="${r}" cx="60" cy="60" fill="none" stroke="var(--borda)" stroke-width="13"/>`;
    itens.forEach(it => {
      const len = c * it.valor / total;
      const vis = itens.length > 1 ? Math.max(0.5, len - 1.6) : len;
      s += `<circle r="${r}" cx="60" cy="60" fill="none" stroke="${it.cor}" stroke-width="13" stroke-dasharray="${vis} ${c - vis}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"><title>${esc(it.rotulo)}</title></circle>`;
      off += len;
    });
    s += `<text x="60" y="57" text-anchor="middle" class="rosca-rot">${esc(rotuloCentro)}</text>`;
    s += `<text x="60" y="73" text-anchor="middle" class="rosca-val">${esc(fmtCurto(itens.reduce((a, b) => a + b.valor, 0)))}</text>`;
    return s + '</svg>';
  }

  // Anel da saúde financeira (0–100)
  function anel(nota, corNota) {
    const r = 40, c = 2 * Math.PI * r, len = c * Math.max(0, Math.min(100, nota)) / 100;
    return `<svg viewBox="0 0 100 100" class="anel" role="img" aria-label="Nota ${nota} de 100">
      <circle r="${r}" cx="50" cy="50" fill="none" stroke="var(--borda)" stroke-width="8"/>
      <circle r="${r}" cx="50" cy="50" fill="none" stroke="${corNota}" stroke-width="8" stroke-linecap="round"
        stroke-dasharray="${len} ${c}" transform="rotate(-90 50 50)"/>
      <text x="50" y="57" text-anchor="middle" class="anel-num">${nota}</text></svg>`;
  }

  return { barrasMensais, rosca, anel, cor };
})();
