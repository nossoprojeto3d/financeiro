// Service worker: app funciona instalado e abre mesmo sem internet.
// Ao publicar uma versão nova, mude o número abaixo (e VERSAO em src/lib/estado.svelte.js).
const CACHE = 'caixa-v4.0.0';
const ARQUIVOS = ['./', './index.html', './manifest.json', './favicon.svg',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  // cache: 'reload' busca direto no GitHub (sem a cópia de 10 min do navegador)
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

// Apaga os caches de versões antigas (inclusive o das fontes do Google da versão 3)
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro (pega atualizações), cache se estiver offline.
// 'no-cache' pergunta ao GitHub se o arquivo mudou (resposta pequena quando não mudou).
// Requisições ao Supabase (outro domínio) nunca passam pelo cache.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  let pedido = req;
  try { pedido = new Request(req, { cache: 'no-cache' }); } catch (_) {}
  e.respondWith(
    fetch(pedido)
      .then(res => {
        if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
