// Service worker: app funciona instalado e abre mesmo sem internet.
// Ao publicar uma versão nova, mude o número abaixo.
const CACHE = 'caixa-v3.0.1';
const ARQUIVOS = [
  './', './index.html', './css/style.css', './manifest.json',
  './js/config.js', './js/api.js', './js/lock.js', './js/charts.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // cache: 'reload' busca direto no GitHub (sem a cópia de 10 min do navegador)
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'caixa-fontes').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro (pega atualizações), cache se estiver offline.
// 'no-cache' pergunta ao GitHub se o arquivo mudou (resposta pequena quando não mudou).
// Requisições ao Supabase (outro domínio) nunca passam pelo cache.
// Fontes do Google: não mudam, então ficam guardadas no aparelho (abre mais rápido e funciona offline)
const FONTES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const origem = new URL(req.url).origin;
  if (FONTES.includes(origem)) {
    e.respondWith(caches.open('caixa-fontes').then(c => c.match(req).then(salvo => salvo ||
      fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }))));
    return;
  }
  if (origem !== self.location.origin) return;
  let pedido = req;
  try { pedido = new Request(req, { cache: 'no-cache' }); } catch (_) {}
  e.respondWith(
    fetch(pedido)
      .then(res => {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
