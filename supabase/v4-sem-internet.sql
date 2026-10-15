-- =====================================================================
--  Financeiro NP3D — lançar sem internet (versão 4.4)
--  Rode este arquivo inteiro no SQL Editor. Pode rodar mais de uma vez.
--  O app antigo continua funcionando depois dele.
-- =====================================================================

-- Etiqueta que o celular cria para cada lançamento novo. Se o mesmo lançamento
-- chegar duas vezes (sinal caiu no meio do envio e o app mandou de novo), o
-- banco reconhece a etiqueta e não cria outro.
alter table public.lancamentos add column if not exists id_cliente uuid;
create unique index if not exists lancamentos_id_cliente_uk on public.lancamentos (id_cliente);

-- Conferência: deve mostrar a linha com ok = true
select 'etiqueta id_cliente' as criado, exists (select 1 from pg_indexes
  where schemaname = 'public' and indexname = 'lancamentos_id_cliente_uk') as ok;
