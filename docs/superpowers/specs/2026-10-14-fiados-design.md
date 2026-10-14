# Fiados (quem levou e ainda não pagou)

Data: 14/10/2026 · Versão alvo: 4.1.0

## Objetivo

Anotar quem levou uma peça e ainda está devendo e, quando a pessoa pagar, registrar a entrada no caixa num toque, escolhendo a forma de pagamento.

## Decisões tomadas com o Junior

1. **A venda só conta quando a pessoa paga.** O fiado é uma anotação e não entra no saldo, na meta mínima, na Gestão, na IA nem na exportação. Ao receber, vira uma Venda normal com a data do pagamento.
2. **O pagamento é sempre do valor todo.** Não existe pagamento parcial. Se a pessoa pagar só uma parte, o valor do fiado é corrigido na mão (editar).
3. **Campos:** nome de quem deve, valor, categoria, o que levou e a data da entrega (o app grava sozinho). Não tem data combinada nem telefone. A lista mostra "há X dias".
4. **Onde fica:** uma linha discreta no Início, abaixo do cartão do mês, que abre um painel com a lista. Nenhuma aba nova.
5. **Anotar:** pelo formulário de lançamento (Entrada → Detalhes → "Ainda não recebi") **e** pelo atalho "+ Anotar fiado" no painel, que abre o mesmo formulário já no modo fiado.
6. **Guardar em tabela própria** (`fiados`) e receber por uma função do banco que cria a Venda e apaga o fiado na mesma transação.

## Telas

### Anotar um fiado

- **No formulário de lançamento** (`Lancar.svelte`), só em Entrada e só em lançamento novo: a folha Detalhes ganha o interruptor **"Ainda não recebi"**. Ligado, ativa o modo fiado e esconde "Repetir todo mês" e "Forma de pagamento". A data continua valendo (é a data da entrega).
- **Pelo atalho "+ Anotar fiado"**, o formulário abre já em Entrada e no modo fiado, com a categoria de venda que aparece primeiro na lista já marcada.
- **No modo fiado** (pelos dois caminhos), o campo **"Quem deve"** fica no formulário principal, logo abaixo do valor e antes da categoria. No lugar do seletor Entrada/Saída aparece o título "Novo fiado", com o X para cancelar (também no painel fixo do computador). Para voltar a um lançamento comum, basta desligar o interruptor em Detalhes.
- **Campo "Quem deve":** texto com fonte de 16px, até 60 caracteres, e sugestões dos nomes já usados em fiados abertos (`<datalist>`). O nome é guardado do jeito que foi digitado, sem espaços nas pontas.
- A linha de detalhes do formulário mostra **"Fiado · Ana"** no lugar da forma de pagamento.
- **Obrigatórios:** valor, categoria, o que levou (descrição) e quem deve. Se faltar o nome, o campo treme, como acontece com a descrição.
- O botão verde diz **"Anotar fiado"** e o aviso depois de salvar é "Fiado anotado".

### Linha no Início (`Fiados.svelte`)

- Fica abaixo do `CartaoMes`, no celular e no computador.
- **Com fiados:** "A receber · R$ 230,00 · 3 pessoas ›", em texto pequeno, com o valor em destaque discreto (sem âmbar, porque o destaque da tela é o vaso). "Pessoas" conta nomes diferentes; com um só, fica "1 pessoa".
- **Sem fiados:** "Anotar fiado ›", em `text-txt-3`, pequeno, e abre direto o formulário no modo fiado.
- **Sem a tabela no banco** (SQL não rodado): a linha não aparece.
- Alvo de toque com pelo menos 40px de altura.

### Painel "A receber" (`Folha`)

- No topo, o botão **"+ Anotar fiado"**. Abaixo, a lista ordenada do mais antigo para o mais novo (data da entrega; empate pelo id).
- Cada item mostra **nome**, o que levou (pequeno, cortado com reticências), **valor** e "hoje", "ontem" ou "há N dias", além do botão **"Recebeu"**.
- **Tocar no item** abre o formulário de edição do fiado (valor, categoria, o que levou, quem deve, data), com a lixeira para excluir. Excluir usa a mesma folha de confirmação do formulário ("Excluir fiado?", "O fiado de Ana (R$ 80,00) sai da lista e não dá para desfazer.") e mostra o aviso "Fiado excluído".

### Receber (`Folha` "Recebeu")

- Título "Ana pagou R$ 80,00".
- **Forma de pagamento:** os botões de `PAGAMENTOS`, obrigatório escolher um, sem nenhum marcado de início.
- **Data:** "Hoje" (padrão), "Ontem" ou outra data, igual a Detalhes, sem permitir data futura.
- Botão verde **"Confirmar recebimento"**. Ao confirmar: a Venda entra em `S.lancs`, o fiado sai da lista e aparece o aviso "Recebido · entrou no caixa". O saldo do Início anima como depois de um lançamento.
- **A Venda criada:** tipo entrada, valor, categoria e quem fez = quem tocou em Recebeu. Descrição: `"Ana · 2 vasos geométricos"`, cortada em 200 caracteres. Forma e data são as escolhidas.

## Banco: `supabase/v4-fiados.sql`

O arquivo pode rodar mais de uma vez sem problema, como os outros.

```sql
create table if not exists public.fiados (
  id bigint generated always as identity primary key,
  nome text not null check (char_length(btrim(nome)) between 1 and 60),
  valor numeric(12,2) not null check (valor > 0),
  categoria_id bigint not null references public.categorias(id),
  descricao text not null check (char_length(btrim(descricao)) between 1 and 200),
  data date not null default current_date
    check (data between date '2000-01-01' and (current_date + 1)),
  usuario_id uuid not null default auth.uid() references public.perfis(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
-- gatilho tocar_atualizado (já existe) em update
-- RLS: is_membro() para tudo, igual a recorrentes; revoke de anon; grant para authenticated
-- índice em categoria_id
```

**Função `receber_fiado(p_id bigint, p_forma text, p_data date) returns lancamentos`**, `security definer`, `search_path = ''`:

1. Se não for membro, gera erro "sem permissão".
2. Apaga o fiado com `delete ... where id = p_id returning *`. Se não voltar nenhuma linha, gera erro "Esse fiado já foi recebido ou excluído.". Assim o toque duplo e os dois celulares não duplicam a Venda.
3. Valida `p_forma` (de 1 a 40 caracteres) e `p_data` (não pode ser futura no horário de Brasília nem anterior à data da entrega). Se falhar, gera erro com mensagem em português e a transação desfaz o delete.
4. Insere em `lancamentos` com tipo `'entrada'`, o valor e a categoria do fiado, a descrição `left(nome || ' · ' || descricao, 200)`, a forma e a data escolhidas, e `usuario_id = auth.uid()`. Devolve a linha criada.

`revoke` de public/anon e `grant execute` para authenticated. No fim do arquivo, um `select` de conferência.

## App

### `api.js`

```js
fiados: () => todos('fiados?select=*&order=data.asc,id.asc'),
criarFiado: d => rest('fiados', { method: 'POST', body: d, ...volta }).then(r => r[0]),
editarFiado: (id, d) => rest(`fiados?id=eq.${id}`, { method: 'PATCH', body: d, ...volta }).then(r => r[0]),
excluirFiado: id => rest(`fiados?id=eq.${id}`, { method: 'DELETE' }),
receberFiado: (id, forma, data) => rest('rpc/receber_fiado', { method: 'POST', body: { p_id: id, p_forma: forma, p_data: data } }),
```

`moverCategoria(de, para)` passa a mover também os fiados (`PATCH fiados?categoria_id=eq.de`), ignorando o erro de tabela inexistente.

`traduzir()` passa a reconhecer as mensagens da função (já recebido, data inválida) e devolve o texto como está.

### `lib/fiados.js` (funções puras, testáveis)

- Total a receber: `soma()` do `formato.js`, que já soma em centavos.
- `categoriaPadraoFiado(cats)`: primeira categoria de natureza venda da lista (ou a primeira da lista, ou `null`).
- `ordenarFiados(lista)`: da entrega mais antiga para a mais nova (empate pelo id).
- `pessoas(lista)`: quantidade de nomes diferentes, comparando sem maiúsculas e sem acentos.
- `haQuanto(dataISO, hojeISO)`: "hoje", "ontem" ou "há N dias".
- `nomesUsados(lista)`: nomes únicos para as sugestões.

### `estado.svelte.js`

- `S.fiados = []` e `S.temFiados = false` (indica se a tabela existe).
- `buscarFiados()` no molde de `buscarRecorrentes()`: se der erro que não seja de login, devolve `null` (tabela não existe), e aí `temFiados = false`.
- Os fiados entram em `carregarTudo`, `sincronizar`, `abrirComGuardados` e `guardarCache` (campo novo `f` dentro do `caixa_cache`, com a mesma chave). A sincronização compara uma assinatura própria dos fiados (quantidade, maior id e maior `atualizado_em`). A `assinatura()` dos lançamentos não muda, porque a Gestão a usa para avisar "Teve lançamento novo depois dessa análise", e um fiado não é lançamento. Quando outra pessoa anota um fiado, aparece o aviso "Thai anotou um fiado de R$ 80,00".
- `S.lancar` ganha `fiado: false` e `nome: ''`. Editando um fiado, `id` é o id do fiado e `fiado` é `true`. A nova `abrirFiado(fiado = null)` abre o formulário para anotar ou editar; um rascunho com nome preenchido conta como "ocupado" para a sincronização não interromper.
- `salvarLanc(f)`: se `f.fiado`, cria ou edita na tabela `fiados` (nome, valor, categoria, descrição, data) em vez de `lancamentos`.
- `excluirFiado(id)` e `receberFiado(fiado, forma, data)`. O receber começa com `if (enviando) return` no componente; se der certo, põe a Venda em `S.lancs`, tira o fiado de `S.fiados` e salva o cache. Se o erro for "já foi recebido", recarrega os dados.
- `excluirCategoria` e a contagem que decide se precisa pedir outra categoria passam a considerar os fiados da categoria.

### Componentes

- `Lancar.svelte`: modo fiado (campo "Quem deve", interruptor em Detalhes, textos do botão e do topo "Editando fiado", excluir com `confirmar`).
- `Fiados.svelte` (novo): linha do Início, painel "A receber" e painel "Recebeu". Usa `Folha` (que já conta em `S.folhas` para pausar a sincronização).
- `Inicio.svelte`: coloca `<Fiados />` abaixo do `CartaoMes`.
- `Ajustes.svelte`: o diálogo de excluir categoria considera os fiados.

## Erros

- Sem internet ao anotar, editar, excluir ou receber: aviso de erro como hoje, e o botão vira "Tentar de novo" no formulário. Receber é seguro para repetir, porque a função não duplica.
- Fiado recebido ou excluído em outro celular: aviso "Esse fiado já foi recebido ou excluído." e a lista é recarregada.
- Sem a tabela no banco (o Supabase responde que não achou a tabela `fiados`; sem internet é outro erro e não conta): nada de fiados aparece, inclusive o interruptor "Ainda não recebi" (só aparece com `S.temFiados`).

## Testes

- **Vitest** (dependência de desenvolvimento nova, gratuita) para `lib/fiados.js`: pessoas com acento e maiúscula, "há N dias" virando o mês, categoria padrão, ordem da lista e nomes sugeridos.
- **Navegador** com o build (`npx vite preview`), um `fetch` falso para o Supabase e uma sessão falsa (initScript do chrome-devtools), em 390×844 e no computador: anotar pelos dois caminhos, editar, excluir, receber, toque duplo no Recebeu, linha "Anotar fiado" sem fiados, sem a tabela (404) e a sincronização trazendo um fiado de outro usuário. Nada toca no banco de verdade.
- `CHECK` do SQL revisado à mão. O SQL é rodado pelo Junior no Supabase.

## Publicação

1. Junior roda `supabase/v4-fiados.sql` no SQL Editor.
2. Subir `CACHE` em `app/public/sw.js` e `VERSAO` para `4.1.0`, depois `npm run build`.
3. Commit e push da `main`, só com autorização.
4. Atualizar o CLAUDE.md (estrutura, banco e comportamentos).

## Fora do escopo

Pagamento parcial, data combinada, telefone, cobrança por WhatsApp, fiado de saída (quando a empresa é que deve), empréstimo de dinheiro e histórico de fiados pagos (a Venda criada já guarda o nome na descrição).
