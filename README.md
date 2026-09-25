# Caixa · Nosso Projeto 3D — V2

Controle de caixa e gestão financeira da empresa, em PWA. HTML/CSS/JS puro, sem bibliotecas, banco no Supabase (plano grátis) e hospedagem no GitHub Pages. Custo mensal: zero.

## O que tem na V1 (base)

- Login simples com os dois usuários (escolhe quem é e digita a senha).
- Face ID ao abrir o app e ao voltar depois de 1 minuto em segundo plano.
- Início com saldo em caixa, resumo do mês e botões grandes de Entrada e Saída.
- Lançamento rápido: valor, categoria, descrição, data, forma de pagamento e quem fez.
- Categorias flexíveis: cria na hora do lançamento, edita e arquiva em Ajustes. Cada uma tem uma natureza (venda, aporte, custo variável, despesa fixa, investimento), que alimenta a análise.
- Histórico com busca, filtro por tipo e edição/exclusão ao tocar.
- Gestão com filtros (período, pessoa, tipo, categoria), comparação com o período anterior, saúde financeira com nota e dicas, evolução de 6 meses, distribuição por categoria e natureza, divisão por pessoa, maiores saídas e exportação CSV.
- Atualiza sozinho a cada 30 segundos com o app aberto (e na hora em que o app volta para a tela), então o que um lança aparece para o outro.
- Abre offline mostrando os últimos dados carregados.

## O que a V2 adicionou

- **Lançamentos que se repetem:** ao lançar, ligue "Repetir todo mês". O banco lança sozinho no dia certo (horário de Brasília). Pausar, mudar valor e dia ou excluir fica em Ajustes. Lançamento gerado que vocês apagarem não volta.
- **Análise com IA (Gestão):** o botão "Analisar com IA" manda só os totais do período para o Google Gemini e mostra o que está indo bem, o que preocupa e o que fazer. A última análise de cada período fica guardada no aparelho.

## Configuração (uma vez só, ~15 min)

### 1. Supabase
1. Crie uma conta em supabase.com com o e-mail nossoprojeto3d@gmail.com e um projeto novo (região São Paulo). Guarde a senha do banco.
2. Vá em **SQL Editor**, cole o **PASSO 1** do arquivo `supabase/setup.sql` e clique em **Run**.
3. Vá em **Authentication › Users › Add user › Create new user**. Crie o seu e o da Thai com e-mail e senha, marcando **Auto Confirm User**.
4. Volte ao **SQL Editor**, troque os e-mails no **PASSO 2** do `setup.sql` e rode só esse bloco. O resultado final deve listar os dois nomes.
5. Em **Authentication › Sign In / Providers**, desligue **Allow new users to sign up**. Assim ninguém consegue criar conta.
6. Em **Project Settings › API** (ou botão **Connect**), copie a **Project URL** e a chave pública (**anon** ou **publishable**). Nunca use a chave `service_role` / `secret` no app.

### 2. App
1. Abra `js/config.js` e preencha `SUPABASE_URL`, `SUPABASE_KEY` e os dois e-mails.
2. Crie o repositório `nossoprojeto3d/caixa` no GitHub e suba todos os arquivos.
3. Em **Settings › Pages**, publique a branch `main`, pasta raiz. O endereço fica `https://nossoprojeto3d.github.io/caixa/`.

### 3. iPhone
1. Abra o endereço no **Safari**, toque em **Compartilhar › Adicionar à Tela de Início**.
2. Abra pelo ícone, entre com a senha e toque em **Ativar Face ID**.
3. Dica: se já existe dinheiro em conta, lance uma entrada em "Saldo inicial / ajuste" para o saldo em caixa bater.

### 4. Ativar a V2 (~10 min)
1. **Banco:** no SQL Editor do Supabase, cole o arquivo `supabase/v2.sql` inteiro e clique em **Run**.
2. **Chave do Gemini (grátis, sem cartão):** entre em aistudio.google.com com a conta nossoprojeto3d@gmail.com, clique em **Get API key › Create API key** e copie a chave.
3. **Guardar a chave no Supabase:** em **Edge Functions › Secrets**, crie `GEMINI_API_KEY` com a chave copiada.
4. **Criar a função da IA:** em **Edge Functions › Deploy a new function › Via Editor**, dê o nome `analise`, apague o código de exemplo, cole o conteúdo de `supabase/functions/analise/index.ts` e clique em **Deploy**. Deixe ligada a opção de exigir login (Verify JWT).
5. Suba os arquivos novos no GitHub. O app atualiza sozinho nos celulares.

Sem os passos 2 a 4, o app funciona normalmente e só o botão de IA avisa que falta instalar. Sem o passo 1, os lançamentos que se repetem não funcionam.

### 5. Ordem das categorias (~1 min)
No SQL Editor do Supabase, cole o arquivo `supabase/v2-ordem.sql` inteiro e clique em **Run**. Depois disso, em Ajustes, segure a alça (≡) de uma categoria e arraste para mudar a ordem. A lista na hora de lançar segue essa ordem.

### 6. Reforço de segurança (versão 3.0, ~3 min)
1. **Banco:** no SQL Editor do Supabase, cole o arquivo `supabase/v3-seguranca.sql` inteiro e clique em **Run**. A última parte lista as regras novas.
2. **Função da IA:** em **Edge Functions › analise**, apague o código, cole de novo o conteúdo de `supabase/functions/analise/index.ts` e clique em **Deploy**. A função passa a atender só o Junior e a Thai.

## Observações

- **IA e privacidade:** só vão para o Gemini os totais (vendas, gastos por categoria, canais, meses). Descrições dos lançamentos e nomes de clientes não são enviados. No plano grátis, o Google pode usar o que recebe para melhorar os produtos dele. Se um dia o modelo padrão mudar de nome, crie o segredo `GEMINI_MODEL` com o nome novo que aparece no AI Studio.

- O Face ID funciona só em https (GitHub Pages). Abrindo o `index.html` direto no computador, o app pede só a senha.
- O Face ID é uma trava do aparelho. Quem protege os dados de verdade é o login e as regras de segurança do banco (RLS): sem um dos dois usuários, nada é lido nem gravado.
- O plano grátis do Supabase pausa projetos parados por 7 dias. Com uso normal isso não acontece; se acontecer, é só entrar no painel e clicar em **Restore**.
- Ao publicar uma versão nova, mude o número em `CACHE` no `sw.js` para os celulares baixarem a atualização.

## Estrutura

```
index.html          telas e navegação
css/style.css       identidade visual (paleta e fontes da marca)
js/config.js        dados do Supabase e usuários
js/api.js           login e banco (fetch puro)
js/lock.js          Face ID (WebAuthn)
js/charts.js        gráficos em SVG
js/app.js           telas, lançamentos, gestão, recorrentes e IA
sw.js               funcionamento offline / instalação
supabase/setup.sql  tabelas, segurança e categorias iniciais
supabase/v2.sql     lançamentos que se repetem (rodar depois do setup)
supabase/v2-ordem.sql  ordem manual das categorias (rodar depois do v2)
supabase/functions/analise/index.ts   função da IA (guarda a chave do Gemini)
```
