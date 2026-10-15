# Contexto do projeto: Caixa · Nosso Projeto 3D

## O que é
**Nome do app: Financeiro NP3D** (use sempre esse nome: título, ícone na tela de início, manifest).
PWA de controle de caixa e gestão financeira da Nosso Projeto 3D, uma pequena empresa de impressão 3D (vendas pela Shopee, pelo WhatsApp e encomendas personalizadas). Só dois usuários: Junior e Thai (sócios, casal). Uso principal no iPhone, instalado pela tela de início. Versão atual: 4.2.0.

## Regras que não mudam
- **Custo zero:** nada de serviço pago ou plano mensal. Hospedagem no GitHub Pages, banco no Supabase (plano grátis), IA pelo Gemini (camada grátis).
- **Stack (desde a 4.0):** Vite + Svelte 5 + Tailwind 4, ícones Lucide, fontes guardadas no próprio app (Fontsource). Gráficos em SVG feitos à mão e o Supabase acessado com `fetch` direto (REST e Auth), sem a biblioteca do Supabase. Libs e frameworks gratuitos podem entrar; pago só com autorização.
- **Caminhos relativos** (o repositório é `nossoprojeto3d/financeiro`, publicado pelo GitHub Pages numa subpasta).
- **Tudo em português do Brasil**, inclusive nomes de funções e variáveis.
- **Linguagem para leigos:** os donos estão começando e não conhecem termos de finanças. Nada de "margem de contribuição", "ponto de equilíbrio" ou "custo variável" na interface; use "gastos para produzir e entregar", "contas fixas", "lucro", "meta mínima de vendas".
- **Visual limpo:** eles reclamam de tela poluída. Pouco texto, fontes pequenas para informação secundária, só um destaque por tela. Antes de adicionar texto, rótulo ou resumo, pergunte se é mesmo necessário.

## Identidade visual "Camadas" (própria do financeiro desde a 4.0)
Banco digital escuro com alma de impressão 3D. Fundo grafite `#101218`, superfícies `#181B23` / `#20242E` / `#2A2F3B`, bordas `#2B303C`, texto `#ECEEF3` / `#9AA1B1` / `#646B7B`. Um só destaque: âmbar `#F5B83D`. Entradas em menta `#4FE0A5`, saídas em coral `#FF7B8B`. Números e títulos em Bricolage Grotesque, texto em Instrument Sans. Tokens em `@theme` no `app/src/app.css` (classes `bg-sup`, `text-ambar`, `text-ent`...). O destaque do Início é o vaso sendo impresso camada por camada até a meta mínima (`Vaso.svelte`). Categorias ganham uma cor de filamento pela posição (ordem de id), sem coluna no banco.

## Estrutura
O código fica em `app/`. O GitHub Pages publica pelo GitHub Actions (`.github/workflows/publicar.yml`, a cada push na `main`), que copia os arquivos do site da raiz. Então **o site publicado é o build commitado**: `index.html`, `assets/`, `sw.js`, `manifest.json`, `icons/`, `favicon.svg` e `og-image.jpg` na raiz são gerados. Não edite esses arquivos na raiz; edite em `app/` e rode o build.
- **Publicar:** `cd app && npm install && npm run build` (apaga `../assets` e gera tudo na raiz), depois commit e push da `main`. **Antes, suba o número em `CACHE` no `app/public/sw.js` e em `VERSAO` no `app/src/lib/estado.svelte.js`, e rode `npm run conferir-backup` em `app/`.** Se ele avisar que o backup está parado, pare e diga ao Junior, antes de publicar, que a causa mais provável é a senha do banco ter sido trocada no Supabase e que ele precisa atualizar o segredo `SUPABASE_DB_URL` no repositório `financeiro-backup`.
- **Testes:** `npm test` em `app/` roda as contas (Vitest, `src/**/*.test.js`, poucos segundos). `npm run test:e2e` roda os testes de tela (Playwright, `app/e2e/`): sobe o modo demonstração numa porta própria (5199) e testa lançar, editar, excluir, fiados (anotar, receber tudo e só uma parte), as telas e o painel do computador, no celular (390×844) e no computador (1359×729). Nunca toca no Supabase: o teste falha se alguma chamada tentar sair para lá. **Rode os dois depois de qualquer mudança e antes de publicar.** Mudou uma tela de propósito? Atualize o teste correspondente. Falha mostra print e trace em `app/test-results/`.
- **Modo demonstração:** `cd app && npm run demo` abre o app em `http://localhost:5173/` com dados de exemplo e um banco de mentira (`app/src/demo/bancoFalso.js`), sem tocar no Supabase. Os dados ficam no navegador; `?zerar` no endereço recomeça. Só existe no `vite --mode demo`: o build publicado não inclui.
- `app/index.html`: casca da página e a regra de segurança (CSP).
- `app/src/App.svelte`: navegação (barra inferior com o + no celular, menu lateral no computador), lançamento por cima, confirmação, avisos.
- `app/src/telas/`: `Porta` (login, trava, carregando), `Inicio`, `Historico`, `Gestao`, `Ajustes`, `AReceber` (lista de fiados com o "Recebeu", aberta pelo cartão do Início).
- `app/src/componentes/`: `Lancar` (formulário com teclado numérico; tela cheia no celular, fixo ao lado no Início do computador), `Teclado`, `Folha` (painel que sobe de baixo), `CartaoMes` + `Vaso`, `GraficoMeses`, `ItemLanc`, `Dinheiro`, `Fiados` (cartão "A receber" do Início, só com o total).
- `app/src/lib/config.js`: URL e chave pública do Supabase e e-mails dos dois usuários. A chave pública pode ficar no repositório; a `service_role` / `secret` nunca.
- `app/src/lib/api.js`: login, renovação de sessão e chamadas ao banco (objeto `Api`).
- `app/src/lib/lock.js`: trava com Face ID via WebAuthn (objeto `Lock`). É trava local do aparelho; a segurança real é o login + RLS.
- `app/src/lib/estado.svelte.js`: estado (`S`), carregar, sincronizar, trava, salvar/excluir lançamentos, categorias, recorrentes e fiados.
- `app/src/lib/analise.js`: contas da Gestão (lucro, meta mínima, canais). `ia.js`: dados enviados à IA e cache do dia. `exportar.js`: CSV. `fiados.js`: contas dos fiados (testes com `npm test` em `app/`).
- `app/public/sw.js`: service worker (rede primeiro, cache offline).
- `supabase/setup.sql`: tabelas, segurança (RLS) e categorias iniciais.
- `supabase/v2.sql`: lançamentos que se repetem (tabela `recorrentes` e função `gerar_recorrentes`).
- `supabase/v3-seguranca.sql`: reforços de segurança (cor válida, tamanhos, data não futura, função com caminho fixo, índices).
- `supabase/v2-ordem.sql`: coluna `ordem` nas categorias (ordem manual, arrastando em Ajustes). Sem ela, o app ordena pelas mais usadas.
- `supabase/v4-fiados.sql`: fiados (tabela `fiados` e função `receber_fiado`, que apaga o fiado e lança a venda juntos).
- `supabase/v4-fiados-parcial.sql`: pagar só uma parte do fiado (coluna `pago` e `receber_fiado` com `p_valor`). Depois dele, não rode o `v4-fiados.sql` de novo.
- `supabase/functions/analise/index.ts`: Edge Function que chama o Gemini. A chave fica no segredo `GEMINI_API_KEY` do Supabase.

## Banco (Supabase)
- `perfis` (id = usuário do Auth, nome, cor). Só quem tem perfil acessa algo (função `is_membro()`).
- `categorias` (nome, tipo `entrada`/`saida`, natureza, ativa). Naturezas: entrada = `venda`, `aporte`, `outra`; saída = `variavel`, `fixa`, `investimento`. Na interface aparecem como Venda, Dinheiro colocado, Outra entrada, Gasto de produção, Conta fixa, Equipamento.
- `lancamentos` (tipo, valor, categoria_id, descricao, forma_pagamento, data, usuario_id, recorrente_id).
- `recorrentes` (valor, dia_mes, inicio, gerado_ate, ativa...). O app chama `rpc/gerar_recorrentes` ao abrir; lançamento gerado que for apagado não volta.
- `fiados` (nome, valor = total da compra, pago = quanto já pagou, categoria_id, descricao, data da entrega, usuario_id). Não entram em nenhuma conta; o `rpc/receber_fiado` vira Venda na data do pagamento (com `p_valor`, só uma parte: a venda leva "(parte)" e o fiado fica com o que falta). Sem a tabela, o app segue sem fiados.
- Cadastro de novos usuários fica desligado no Supabase.
- **Backup:** toda madrugada (3h) o GitHub Actions do repositório **privado** `nossoprojeto3d/financeiro-backup` (cópia local em `~/Claude/financeiro-backup`) copia o banco inteiro com `supabase db dump` para `banco/` (papeis, estrutura, dados). Cada dia que muda vira um commit, então o histórico guarda todas as versões. O endereço do banco com a senha fica no segredo `SUPABASE_DB_URL` (Session pooler, porta 5432); trocou a senha do banco, atualize o segredo. Nunca ponha o backup neste repositório, que é público. Como restaurar: README de lá.

## Comportamentos importantes
- O app abre na hora com os últimos dados guardados no celular (`caixa_cache`) e atualiza por trás; só busca antes de mostrar logo depois de entrar com a senha. Atualiza sozinho a cada 30 s com o app aberto e na hora em que volta para a tela, sem interromper um formulário aberto.
- **Lançar (desde a 4.0):** o Início é um painel (saldo, vendas do mês contra a meta mínima, atalhos de Entrada/Saída e últimos lançamentos). O lançamento abre pelo + da barra inferior (tela cheia) ou pelos atalhos; no computador fica fixo à direita do Início e aceita os números do teclado físico. O valor é sempre digitado no teclado numérico do próprio app (o do iPhone cobria o botão). Valor, categoria e descrição são obrigatórios; data, repetir, pagamento e quem fez ficam em "Detalhes". Tocar num lançamento abre a edição.
- **Fiados (desde a 4.1):** anotar por Detalhes → "Ainda não recebi" ou por "+ Anotar fiado" na tela "A receber" (o cartão do Início leva até ela). No "Recebeu" dá para receber tudo ou só uma parte (desde a 4.2); o que falta = valor − pago, sempre em centavos (`falta()` e `totalFalta()` em `fiados.js`). A Venda criada leva "Nome · o que levou" na descrição, com "(parte)" quando não quita.
- **Meta mínima:** sempre pela média dos últimos 3 meses, igual no Início e na Gestão.
- A Gestão analisa a empresa inteira no período escolhido; os filtros por pessoa, tipo e categoria ficam só em "Explorar lançamentos".
- A análise com IA envia só totais agregados, nunca descrições dos lançamentos.
- **Regra de segurança da página (CSP) no `app/index.html`:** só roda código do próprio app, só carrega fontes do próprio app e só conversa com o Supabase do projeto. Se trocar o projeto do Supabase, troque o endereço também no `connect-src` dessa regra. Não use `<script>` inline nem código de outro site.
- **Valores em dinheiro:** some sempre em centavos (`cent()` e `soma()` em `app/src/lib/formato.js`), nunca somando decimais direto.
- **Cor de perfil vinda do banco:** passe por `corSegura()` (`app/src/lib/dados.js`) antes de pôr num `style`.
- **Chaves guardadas no celular** (`caixa_sessao`, `caixa_faceid`, `caixa_cache`, `caixa_email`, `caixa_nome`, `caixa_ultimo_uso`, `caixa_ia`): são as mesmas desde a 3.0. Não renomeie, senão todo mundo precisa entrar de novo.
- **Toque duplo:** toda ação que grava começa checando se já está enviando (`if (enviando) return`); o botão só desativa na próxima atualização da tela.
- **iPhone:** campos de texto com fonte de pelo menos 16px (abaixo disso o Safari dá zoom) e alvos de toque de pelo menos 40px.
- **Função da IA (`analise`):** só atende quem tem perfil no banco e só o endereço do app. Mudou o arquivo? Republique no Supabase (Edge Functions).
- **Versões marcadas no git:** `v4.0.0` (layout novo) e `v3.0.0`. A última versão 3 (3.0.4) está no backup `backup-oficial-20261009`.
- **Face ID só depois de um toque.** Chamar `Lock.verificar()` sem um toque do usuário faz o iPhone mostrar antes a tela "Iniciar sessão… Usar chave-senha". Na trava, qualquer toque na tela chama o Face ID direto.
- **Não usar `confirm()`, `alert()` nem `prompt()`.** No iPhone com o app instalado, a chamada ao banco feita logo depois de um `confirm()` falha como "Load failed" (o app mostra "Sem conexão com a internet"). Para confirmar ações, use `await confirmar(texto, { ok })` do `estado.svelte.js`, que abre uma janelinha própria do app.

## Decisões já tomadas (não refazer)
- Sem importação de planilha: eles começam do zero com uma entrada "Saldo inicial / ajuste".
- Sem resumo nem saldo do dia no Histórico: foi testado e rejeitado por poluir a tela.
- IA continua no Gemini grátis (não trocar por API paga).
- Categorias não têm "arquivar": só criar, editar e excluir. Excluir uma categoria com lançamentos pede outra categoria para recebê-los (e os recorrentes). A coluna `ativa` ficou no banco, mas o app não usa mais.
- A natureza da categoria fica (aparece como "Conta como"): é ela que alimenta as contas da Gestão (lucro, meta mínima, equipamentos).

## Roteiro de teste
Usado pelo `/conferir-site`. **O banco é o de verdade, com o dinheiro real da empresa:** nunca crie, edite ou apague lançamentos, categorias ou recorrentes para testar, e nunca digite senha. Só dá para testar sem login, ou com o usuário logado na própria sessão dele, apenas olhando.
1. A tela de login abre sem erros no console e sem violação de CSP.
2. `manifest.json` e `sw.js` carregam; o nome "Financeiro NP3D" aparece no título e no manifest.
3. Layout do iPhone (390×844): nada vazando, navegação inferior visível.
4. Se o usuário estiver logado: abrir Início, Histórico, Gestão e Ajustes sem tocar em "Lançar", "Excluir" ou "Salvar". Os gráficos aparecem.
5. `npm test` e `npm run test:e2e` em `app/` passando.
6. Antes de publicar: `CACHE` no `app/public/sw.js` e `VERSAO` no `app/src/lib/estado.svelte.js` foram aumentados, e o build foi gerado (`npm run build` em `app/`).
7. Backup do banco em dia: `npm run conferir-backup` em `app/` mostra "✅ Backup do banco em dia". Se mostrar "⚠️ O BACKUP DO BANCO ESTÁ PARADO", avise o Junior com destaque: provavelmente a senha do banco mudou e o segredo `SUPABASE_DB_URL` precisa ser atualizado (o próprio aviso traz o link).

Para testar fluxos que gravam sem tocar no banco real, use primeiro `npm run test:e2e` (automático). Para olhar com os próprios olhos, use o modo demonstração (`npm run demo`), que já traz o banco de mentira; não precisa injetar `fetch` falso à mão.

## Próximos passos planejados (V3)
Metas de gasto por categoria, foto do comprovante no lançamento (Supabase Storage) e lançar sem internet com envio depois.
