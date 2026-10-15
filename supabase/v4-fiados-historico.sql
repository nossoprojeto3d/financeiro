-- =====================================================================
--  Financeiro NP3D — histórico e proteção dos fiados (versão 4.3)
--  Rode este arquivo inteiro no SQL Editor depois do v4-fiados-parcial.sql.
--  Pode rodar mais de uma vez sem problema. O app antigo continua
--  funcionando depois dele.
-- =====================================================================

-- Cada venda que veio de um fiado lembra de qual fiado veio (para mostrar
-- "já pagou" com data e forma). Sem chave estrangeira: o fiado some quando
-- é quitado, e a venda continua com o número dele.
alter table public.lancamentos add column if not exists fiado_id bigint;
create index if not exists lancamentos_fiado_idx on public.lancamentos (fiado_id) where fiado_id is not null;

-- receber_fiado ganha a conferência "o fiado ainda está como eu vi?":
-- p_pago_esperado / p_valor_esperado são o que a tela mostrava. Se outro celular
-- registrou um pagamento ou editou o valor nesse meio-tempo, recusa em vez de
-- lançar em cima de dado velho. Sem eles (app antigo), funciona como antes.
drop function if exists public.receber_fiado(bigint, text, date, numeric);
create or replace function public.receber_fiado(
  p_id bigint, p_forma text, p_data date, p_valor numeric default null,
  p_pago_esperado numeric default null, p_valor_esperado numeric default null)
returns public.lancamentos language plpgsql security definer set search_path = '' as $$
declare
  f public.fiados;
  novo public.lancamentos;
  falta numeric(12,2);
  v numeric(12,2);
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.is_membro() then raise exception 'sem permissão'; end if;
  if char_length(coalesce(btrim(p_forma), '')) not between 1 and 40 then
    raise exception 'Escolha a forma de pagamento.';
  end if;
  -- trava a linha: dois pedidos ao mesmo tempo esperam um pelo outro
  select * into f from public.fiados where id = p_id for update;
  if not found then raise exception 'Esse fiado já foi recebido ou excluído.'; end if;
  if (p_pago_esperado is not null and f.pago <> p_pago_esperado)
     or (p_valor_esperado is not null and f.valor <> p_valor_esperado) then
    raise exception 'Esse fiado mudou agora há pouco (outro pagamento ou edição). Confira a lista e tente de novo.';
  end if;
  if p_data is null or p_data > hoje or p_data < f.data then
    raise exception 'A data do pagamento não pode ser antes da entrega nem no futuro.';
  end if;
  falta := f.valor - f.pago;
  v := coalesce(p_valor, falta);
  if v <= 0 or v > falta then
    raise exception 'O valor pago tem que ser maior que zero e no máximo o que falta.';
  end if;

  insert into public.lancamentos (tipo, valor, categoria_id, descricao, forma_pagamento, data, usuario_id, fiado_id)
  values ('entrada', v, f.categoria_id,
          left(btrim(f.nome) || ' · ' || btrim(f.descricao), 192) || case when v < falta then ' (parte)' else '' end,
          btrim(p_forma), p_data, auth.uid(), f.id)
  returning * into novo;

  if v = falta then
    delete from public.fiados where id = p_id;
  else
    update public.fiados set pago = pago + v where id = p_id;
  end if;
  return novo;
end $$;

revoke all on function public.receber_fiado(bigint, text, date, numeric, numeric, numeric) from public, anon;
grant execute on function public.receber_fiado(bigint, text, date, numeric, numeric, numeric) to authenticated;

-- Conferência: deve mostrar as duas linhas com ok = true
select 'coluna fiado_id' as criado, exists (select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'lancamentos' and column_name = 'fiado_id') as ok
union all
select 'receber_fiado conferindo mudanças', exists (select 1 from pg_proc where proname = 'receber_fiado' and pronargs = 6)
  and not exists (select 1 from pg_proc where proname = 'receber_fiado' and pronargs <> 6);
