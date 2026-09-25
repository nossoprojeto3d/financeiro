// Supabase Edge Function "analise" — Financeiro NP3D
// Recebe o resumo financeiro do período (só números agregados) e pede
// ao Gemini um diagnóstico em linguagem simples.
// A chave do Gemini fica guardada como segredo no Supabase, nunca no app.
//
// Segredos (Edge Functions › Secrets):
//   GEMINI_API_KEY  → chave criada em aistudio.google.com (grátis)
//   GEMINI_MODEL    → opcional; padrão "gemini-flash-latest"

// Só o endereço do app pode chamar esta função pelo navegador
const ORIGEM = 'https://nossoprojeto3d.github.io';
const CORS = {
  'Access-Control-Allow-Origin': ORIGEM,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin'
};
const LIMITE_BYTES = 20000; // os totais de um período cabem folgados nisso

// Confere se quem chama é um dos usuários do app (tem perfil no banco).
// Sem isso, qualquer um com a chave pública gastaria a cota grátis do Gemini.
async function ehMembro(req: Request): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY');
  const auth = req.headers.get('Authorization') || '';
  if (!url || !anon || !auth.startsWith('Bearer ')) return false;
  const h = { apikey: anon, Authorization: auth };
  const u = await fetch(`${url}/auth/v1/user`, { headers: h });
  if (!u.ok) return false;
  const { id } = await u.json();
  if (!id) return false;
  // As regras do banco (RLS) só devolvem perfis para quem é membro
  const p = await fetch(`${url}/rest/v1/perfis?select=id&id=eq.${encodeURIComponent(id)}`, { headers: h });
  return p.ok && (await p.json()).length === 1;
}

const INSTRUCOES = `Você é um consultor financeiro de pequenos negócios no Brasil.
Está ajudando um casal que acabou de abrir uma pequena empresa de impressão 3D
(vendem peças pela Shopee, por WhatsApp e fazem encomendas personalizadas).
Eles são leigos em finanças: escreva em português do Brasil, frases curtas,
sem jargão (não use termos como "margem de contribuição", "EBITDA", "ponto de
equilíbrio" sem explicar). Seja concreto: cite valores e categorias dos dados.
Dê sugestões práticas para o ramo de impressão 3D quando fizer sentido
(preço, filamento, falhas de impressão, taxas de marketplace, frete, embalagem,
venda direta, encomendas). Não invente números que não estão nos dados.
Categorias do tipo "equipamento" são compras que duram anos (impressoras),
não gastos do dia a dia. "Dinheiro colocado" não é venda.

Responda SOMENTE com um JSON válido, sem markdown, neste formato:
{
  "resumo": "2 ou 3 frases dizendo como a empresa está",
  "bom": ["até 3 pontos positivos"],
  "atencao": ["até 3 pontos que preocupam"],
  "acoes": [{"titulo": "ação curta", "detalhe": "como fazer, em 1 ou 2 frases"}]
}
Inclua de 2 a 4 ações, da mais importante para a menos importante.`;

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

  try {
    if (!(await ehMembro(req))) return json({ erro: 'Sem permissão.' }, 401);
    const bruto = await req.text();
    if (bruto.length > LIMITE_BYTES) return json({ erro: 'Dados grandes demais para analisar.' }, 413);

    const chave = Deno.env.get('GEMINI_API_KEY');
    if (!chave) return json({ erro: 'A chave do Gemini não foi configurada no Supabase.' }, 500);
    const modelo = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest';

    const { dados } = JSON.parse(bruto || '{}');
    if (!dados || typeof dados !== 'object') return json({ erro: 'Sem dados para analisar.' }, 400);

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: INSTRUCOES }] },
        contents: [{ role: 'user', parts: [{ text: 'Dados da empresa:\n' + JSON.stringify(dados) }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
      })
    });
    const j = await r.json();
    if (!r.ok) {
      console.error('Gemini', r.status, j?.error?.message);
      return json({ erro: r.status === 429 ? 'Limite grátis do Gemini atingido. Tente de novo mais tarde.' : 'A IA não respondeu agora. Tente de novo.' }, 502);
    }
    const texto = (j.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
    const limpo = texto.replace(/```json|```/g, '').trim();
    return json({ analise: JSON.parse(limpo) });
  } catch (e) {
    console.error('analise', e); // detalhe só nos logs do Supabase, nunca na resposta
    return json({ erro: 'Não foi possível gerar a análise agora. Tente de novo.' }, 500);
  }
});
