-- =====================================================================
--  Caixa · Nosso Projeto 3D — ordem manual das categorias
--  Rode este arquivo inteiro no SQL Editor depois do setup.sql e do v2.sql.
--  Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- Posição de cada categoria na lista (1 = primeira). Entradas e saídas têm
-- cada uma a sua ordem.
alter table public.categorias add column if not exists ordem int;

-- Ordem inicial: as mais usadas primeiro, depois em ordem alfabética.
-- Só preenche quem ainda não tem ordem (não desfaz o que vocês arrumaram).
update public.categorias c
set ordem = o.n
from (
  select cat.id,
         row_number() over (partition by cat.tipo order by count(l.id) desc, cat.nome) as n
  from public.categorias cat
  left join public.lancamentos l on l.categoria_id = cat.id
  group by cat.id, cat.tipo, cat.nome
) o
where c.id = o.id and c.ordem is null;

-- Confere: deve listar as categorias na nova ordem
select tipo, ordem, nome from public.categorias order by tipo, ordem;
