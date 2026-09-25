# Contexto do projeto: Caixa · Nosso Projeto 3D

## O que é
**Nome do app: Financeiro NP3D** (use sempre esse nome: título, ícone na tela de início, manifest).
PWA de controle de caixa e gestão financeira da Nosso Projeto 3D, uma pequena empresa de impressão 3D (vendas pela Shopee, pelo WhatsApp e encomendas personalizadas). Só dois usuários: Junior e Thai (sócios, casal). Uso principal no iPhone, instalado pela tela de início. Versão atual: 2.19.3.

## Regras que não mudam
- **Custo zero:** nada de serviço pago ou plano mensal. Hospedagem no GitHub Pages, banco no Supabase (plano grátis), IA pelo Gemini (camada grátis).
- **HTML, CSS e JS puros:** sem frameworks, sem build, sem npm, sem bibliotecas. Gráficos em SVG feitos à mão. O Supabase é acessado com `fetch` direto (REST e Auth), sem o SDK.
- **Caminhos relativos** (o repositório é `nossoprojeto3d/financeiro`, publicado pelo GitHub Pages numa subpasta).
- **Tudo em português do Brasil**, inclusive nomes de funções e variáveis.
- **Linguagem para leigos:** os donos estão começando e não conhecem termos de finanças. Nada de "margem de contribuição", "ponto de equilíbrio" ou "custo variável" na interface; use "gastos para produzir e entregar", "contas fixas", "lucro", "meta mínima de vendas".
- **Visual limpo:** eles reclamam de tela poluída. Pouco texto, fontes pequenas para informação secundária, só um destaque por tela. Antes de adicionar texto, rótulo ou resumo, pergunte se é mesmo necessário.

## Identidade visual (igual ao site, catálogo e calculadora)
Fundo `#120E09`, cards `#17130D`, bordas `#241C12` / `#3A3226`, dourado `#C9A227` (variações `#E7C873`, `#B08D2B`, `#8A6F1F`), texto `#F4EFE3`, `#C9C1B0`, `#A69C87`, `#786F5C`. Entradas em verde `#8FBF7F`, saídas em `#D98B6E`. Títulos em Fraunces, texto em Work Sans (Google Fonts). As cores estão como variáveis em `:root` no `css/style.css`.

## Estrutura
- `index.html`: casca do app, navegação inferior (Início, Histórico, Gestão, Ajustes).
- `css/style.css`: todos os estilos.
- `js/config.js`: URL e chave pública do Supabase e e-mails dos dois usuários. A chave pública pode ficar no repositório; a `service_role` / `secret` nunca.
- `js/api.js`: login, renovação de sessão e chamadas ao banco (objeto `Api`).
- `js/lock.js`: trava com Face ID via WebAuthn (objeto `Lock`). É trava local do aparelho; a segurança real é o login + RLS.
- `js/charts.js`: gráficos em SVG (objeto `Charts`).
- `js/app.js`: estado (`S`), telas, formulários, gestão, recorrentes, sincronização e IA.
- `sw.js`: service worker (rede primeiro, cache offline). **Ao publicar mudanças, suba o número em `CACHE`** e em `VERSAO` no `app.js`.
- `supabase/setup.sql`: tabelas, segurança (RLS) e categorias iniciais.
- `supabase/v2.sql`: lançamentos que se repetem (tabela `recorrentes` e função `gerar_recorrentes`).
- `supabase/v2-ordem.sql`: coluna `ordem` nas categorias (ordem manual, arrastando em Ajustes). Sem ela, o app ordena pelas mais usadas.
- `supabase/functions/analise/index.ts`: Edge Function que chama o Gemini. A chave fica no segredo `GEMINI_API_KEY` do Supabase.

## Banco (Supabase)
- `perfis` (id = usuário do Auth, nome, cor). Só quem tem perfil acessa algo (função `is_membro()`).
- `categorias` (nome, tipo `entrada`/`saida`, natureza, ativa). Naturezas: entrada = `venda`, `aporte`, `outra`; saída = `variavel`, `fixa`, `investimento`. Na interface aparecem como Venda, Dinheiro colocado, Outra entrada, Gasto de produção, Conta fixa, Equipamento.
- `lancamentos` (tipo, valor, categoria_id, descricao, forma_pagamento, data, usuario_id, recorrente_id).
- `recorrentes` (valor, dia_mes, inicio, gerado_ate, ativa...). O app chama `rpc/gerar_recorrentes` ao abrir; lançamento gerado que for apagado não volta.
- Cadastro de novos usuários fica desligado no Supabase.

## Comportamentos importantes
- O app atualiza sozinho a cada 30 s com o app aberto e na hora em que volta para a tela, sem interromper um formulário aberto.
- **O Início é a tela de lançar:** entrada/saída, valor num teclado numérico do próprio app (não usa o teclado do iPhone, que cobria o botão), categoria, descrição, "Mais detalhes" (popup com data, repetir, pagamento e quem fez) e o botão Lançar. Editar um lançamento (tocando no Histórico) abre nessa mesma tela. Os recentes ficam só no Histórico.
- A Gestão analisa a empresa inteira no período escolhido; os filtros por pessoa, tipo e categoria ficam só em "Explorar lançamentos".
- A análise com IA envia só totais agregados, nunca descrições dos lançamentos.
- **Face ID só depois de um toque.** Chamar `Lock.verificar()` sem um toque do usuário faz o iPhone mostrar antes a tela "Iniciar sessão… Usar chave-senha". Na trava, qualquer toque na tela chama o Face ID direto.
- **Não usar `confirm()`, `alert()` nem `prompt()`.** No iPhone com o app instalado, a chamada ao banco feita logo depois de um `confirm()` falha como "Load failed" (o app mostra "Sem conexão com a internet"). Para confirmar ações, use `await confirmar(texto, { ok })` no `app.js`, que abre uma janelinha própria do app.

## Decisões já tomadas (não refazer)
- Sem importação de planilha: eles começam do zero com uma entrada "Saldo inicial / ajuste".
- Sem resumo nem saldo do dia no Histórico: foi testado e rejeitado por poluir a tela.
- IA continua no Gemini grátis (não trocar por API paga).
- Categorias não têm "arquivar": só criar, editar e excluir. Excluir uma categoria com lançamentos pede outra categoria para recebê-los (e os recorrentes). A coluna `ativa` ficou no banco, mas o app não usa mais.
- A natureza da categoria fica (aparece como "Conta como"): é ela que alimenta as contas da Gestão (lucro, meta mínima, equipamentos).

## Próximos passos planejados (V3)
Metas de gasto por categoria, foto do comprovante no lançamento (Supabase Storage) e lançar sem internet com envio depois.
