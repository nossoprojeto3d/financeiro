// Supabase Edge Function "avisos" — Financeiro NP3D
// Manda a notificação de vencimento das contas a pagar para os iPhones que ligaram os avisos.
//   • Todo dia às 8h, o agendamento do banco (v5-avisos-agenda.sql) chama com o cabeçalho
//     x-avisos-segredo: manda para todos os aparelhos se houver conta vencendo hoje ou atrasada.
//   • O botão "Mandar notificação de teste" (Ajustes) chama com o login do usuário: manda só
//     para os aparelhos dele.
//
// Segredos (Edge Functions › Secrets), valores no arquivo ~/Claude/financeiro-chaves-avisos.txt:
//   VAPID_PUBLICA, VAPID_PRIVADA → par de chaves das notificações (a pública também está no app)
//   AVISOS_SEGREDO               → senha que só o agendamento conhece
// Publicar com "Verify JWT" DESLIGADO: o agendamento não tem login; a função confere sozinha.

import webpush from 'npm:web-push@3.6.7'
// Mesma regra do app (testada em app/src/lib/contas.test.js): o texto da notificação
import { mensagemAviso } from 'https://cdn.jsdelivr.net/gh/nossoprojeto3d/financeiro@ee312b6f47a8f3bda9501cee26357f1334baa04c/app/src/lib/contas.js'

const ORIGEM = 'https://nossoprojeto3d.github.io'
const CORS = {
  'Access-Control-Allow-Origin': ORIGEM,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}
const URL_SB = Deno.env.get('SUPABASE_URL') || ''
const SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// dia de hoje no horário de Brasília (AAAA-MM-DD)
const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

// banco com a chave de serviço (só aqui dentro da função; nunca vai para o app)
async function banco(caminho: string, opcoes: RequestInit = {}) {
  const h: Record<string, string> = { apikey: SERVICO, 'Content-Type': 'application/json' }
  if (!SERVICO.startsWith('sb_secret_')) h.Authorization = `Bearer ${SERVICO}`
  const r = await fetch(`${URL_SB}/rest/v1/${caminho}`, { ...opcoes, headers: { ...h, ...(opcoes.headers || {}) } })
  if (!r.ok) throw new Error(`banco ${r.status}: ${await r.text()}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

// id de quem chama, se for um dos dois usuários (tem perfil no banco); senão null
async function membro(req: Request): Promise<string | null> {
  const anon = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY')
  const auth = req.headers.get('Authorization') || ''
  if (!anon || !auth.startsWith('Bearer ')) return null
  const h = { apikey: anon, Authorization: auth }
  const u = await fetch(`${URL_SB}/auth/v1/user`, { headers: h })
  if (!u.ok) return null
  const { id } = await u.json()
  if (!id) return null
  const p = await fetch(`${URL_SB}/rest/v1/perfis?select=id&id=eq.${encodeURIComponent(id)}`, { headers: h })
  return p.ok && (await p.json()).length === 1 ? id : null
}

// comparação que não entrega a senha pelo tempo de resposta
function igual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

type Inscricao = { id: number; endpoint: string; p256dh: string; auth: string }

// manda para cada aparelho; aparelho que não existe mais (404/410) sai da lista
async function enviar(inscricoes: Inscricao[], msg: { titulo: string; corpo: string }) {
  let enviados = 0, removidos = 0
  const falhas: (number | string)[] = [] // código do serviço de push, ou a mensagem do erro
  const carga = JSON.stringify({ ...msg, url: './?tela=pagar' })
  for (const i of inscricoes) {
    try {
      await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, carga, { TTL: 6 * 3600 })
      enviados++
    } catch (e) {
      const st = (e as { statusCode?: number }).statusCode || 0
      if (st === 404 || st === 410) { await banco(`push_inscricoes?id=eq.${i.id}`, { method: 'DELETE' }); removidos++ }
      else falhas.push(st || String((e as Error).message || e).slice(0, 160))
    }
  }
  return { enviados, removidos, falhas }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405)

  const pub = Deno.env.get('VAPID_PUBLICA'), priv = Deno.env.get('VAPID_PRIVADA')
  if (!pub || !priv || !SERVICO) return json({ erro: 'Faltam os segredos VAPID_PUBLICA e VAPID_PRIVADA na função avisos.' }, 500)
  webpush.setVapidDetails('https://nossoprojeto3d.github.io/financeiro/', pub, priv)

  try {
    // 1) agendamento das 8h
    const segredo = req.headers.get('x-avisos-segredo') || ''
    if (segredo) {
      if (!igual(segredo, Deno.env.get('AVISOS_SEGREDO') || '')) return json({ erro: 'Sem permissão.' }, 401)
      const hoje = hojeBR()
      const contas = (await banco(`contas?select=descricao,valor,vencimento&vencimento=lte.${hoje}`))
        .map((c: { valor: unknown }) => ({ ...c, valor: Number(c.valor) }))
      const msg = mensagemAviso(contas, hoje)
      if (!msg) return json({ enviados: 0, motivo: 'nenhuma conta vencendo hoje nem atrasada' })
      return json({ ...(await enviar(await banco('push_inscricoes?select=id,endpoint,p256dh,auth'), msg)), msg })
    }

    // 2) "Mandar notificação de teste", só para os aparelhos de quem pediu
    const id = await membro(req)
    if (!id) return json({ erro: 'Sem permissão.' }, 401)
    const meus = await banco(`push_inscricoes?select=id,endpoint,p256dh,auth&usuario_id=eq.${encodeURIComponent(id)}`)
    if (!meus.length) return json({ erro: 'Este aparelho ainda não ligou os avisos.' }, 404)
    const r = await enviar(meus, { titulo: 'Avisos ligados', corpo: 'É assim que o Financeiro avisa quando uma conta vence.' })
    if (!r.enviados) return json({ erro: 'Não deu para mandar a notificação. Desligue e ligue os avisos de novo.', ...r }, 502)
    return json(r)
  } catch (e) {
    return json({ erro: String((e as Error).message || e) }, 500)
  }
})
