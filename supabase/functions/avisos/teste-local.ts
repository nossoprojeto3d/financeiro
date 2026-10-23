// Teste de ponta a ponta da função "avisos", com um Supabase e um serviço de push de mentira (nada real).
// Rodar a partir desta pasta (gera um certificado de teste e usa o contas.js local no lugar do jsDelivr):
//   openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout /tmp/chave.pem -out /tmp/cert.pem -days 2 -subj /CN=localhost -addext subjectAltName=DNS:localhost
//   NODE_TLS_REJECT_UNAUTHORIZED=0 npx -y deno@2 run --quiet --node-modules-dir=none --unsafely-ignore-certificate-errors=localhost \
//     --import-map=teste-mapa.json --allow-net --allow-env --allow-read --allow-sys teste-local.ts
// Mudou o commit fixado no import do index.ts? Troque também em teste-mapa.json.
const ok = (nome: string, cond: boolean, extra = '') => console.log(cond ? 'OK  ' : 'FALHOU', nome, extra)
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

// "aparelho": par de chaves igual ao que o iPhone cria
const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
const p256dh = b64u(new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey)))
const authK = b64u(crypto.getRandomValues(new Uint8Array(16)))

const estado = {
  contas: [{ descricao: 'Energia', valor: '180.00', vencimento: hoje }, { descricao: 'Boleto', valor: '20.50', vencimento: '2000-01-01' }],
  inscricoes: [
    { id: 1, usuario_id: 'U1', endpoint: 'https://localhost:54400/push/vivo', p256dh, auth: authK },
    { id: 2, usuario_id: 'U2', endpoint: 'https://localhost:54400/push/morto', p256dh, auth: authK },
  ],
  pushes: [] as { onde: string; tamanho: number; vapid: boolean }[],
  apagados: [] as string[],
  filtroContas: '',
}
Deno.serve({ port: 54400, onListen() {}, cert: Deno.readTextFileSync('/tmp/cert.pem'), key: Deno.readTextFileSync('/tmp/chave.pem') }, async req => {
  const u = new URL(req.url)
  if (u.pathname.startsWith('/push/')) {
    const corpo = new Uint8Array(await req.arrayBuffer())
    estado.pushes.push({ onde: u.pathname, tamanho: corpo.length, vapid: (req.headers.get('authorization') || '').startsWith('vapid ') })
    return new Response(null, { status: u.pathname.endsWith('morto') ? 410 : 201 })
  }
  if (u.pathname === '/auth/v1/user') return req.headers.get('authorization') === 'Bearer token-junior' ? Response.json({ id: 'U1' }) : new Response('{}', { status: 401 })
  if (u.pathname === '/rest/v1/perfis') return Response.json(u.searchParams.get('id') === 'eq.U1' ? [{ id: 'U1' }] : [])
  if (u.pathname === '/rest/v1/contas') { estado.filtroContas = u.search; return Response.json(estado.contas) }
  if (u.pathname === '/rest/v1/push_inscricoes') {
    if (req.method === 'DELETE') { estado.apagados.push(u.searchParams.get('id')!); return new Response(null, { status: 204 }) }
    const dono = u.searchParams.get('usuario_id')
    return Response.json(estado.inscricoes.filter(i => !dono || dono === `eq.${i.usuario_id}`))
  }
  return new Response('?', { status: 404 })
})

// chaves de teste (não são as de verdade)
const v = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
const jwk = await crypto.subtle.exportKey('jwk', v.privateKey)
Deno.env.set('VAPID_PUBLICA', b64u(new Uint8Array(await crypto.subtle.exportKey('raw', v.publicKey))))
Deno.env.set('VAPID_PRIVADA', jwk.d!)
Deno.env.set('AVISOS_SEGREDO', 'senha-de-teste-123')
Deno.env.set('SUPABASE_URL', 'https://localhost:54400')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'chave-servico-teste')
Deno.env.set('SUPABASE_ANON_KEY', 'chave-publica-teste')

await import(new URL('./index.ts', import.meta.url).href)
const F = 'http://localhost:8000/'
const post = (h: Record<string, string>) => fetch(F, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: '{}' })

let r = await post({ 'x-avisos-segredo': 'errada' })
ok('agenda com senha errada: 401', r.status === 401); await r.body?.cancel()
r = await post({})
ok('sem senha e sem login: 401', r.status === 401); await r.body?.cancel()
r = await post({ Authorization: 'Bearer token-de-outro', apikey: 'x' })
ok('login de quem não é membro: 401', r.status === 401); await r.body?.cancel()

r = await post({ 'x-avisos-segredo': 'senha-de-teste-123' })
let j = await r.json()
ok('agenda: busca só contas vencidas até hoje', estado.filtroContas.includes(`vencimento=lte.${hoje}`), estado.filtroContas)
ok('agenda: monta o texto certo', j.msg?.titulo === '2 contas para pagar' && j.msg?.corpo === '1 vence hoje e 1 está atrasada · R$ 200,50', JSON.stringify(j.msg))
ok('agenda: manda para os dois aparelhos, criptografado e assinado', estado.pushes.length === 2 && estado.pushes.every(p => p.tamanho > 100 && p.vapid), JSON.stringify(estado.pushes))
ok('agenda: aparelho que não existe mais (410) é removido', j.enviados === 1 && j.removidos === 1 && estado.apagados[0] === 'eq.2', JSON.stringify(j))

estado.contas = [{ descricao: 'Aluguel', valor: '900', vencimento: '2999-01-01' }].filter(c => c.vencimento <= hoje)
estado.pushes = []
r = await post({ 'x-avisos-segredo': 'senha-de-teste-123' }); j = await r.json()
ok('agenda sem nada vencendo: não manda nada', j.enviados === 0 && estado.pushes.length === 0, JSON.stringify(j))

r = await post({ Authorization: 'Bearer token-junior', apikey: 'chave-publica-teste' }); j = await r.json()
ok('teste: manda só para os aparelhos de quem pediu', r.status === 200 && j.enviados === 1 && estado.pushes.length === 1 && estado.pushes[0].onde === '/push/vivo', JSON.stringify(j))
r = await fetch(F, { method: 'OPTIONS' })
ok('CORS: só o endereço do app', r.headers.get('access-control-allow-origin') === 'https://nossoprojeto3d.github.io'); await r.body?.cancel()
Deno.exit(0)
