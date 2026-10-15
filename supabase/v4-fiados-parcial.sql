-- =====================================================================
--  Financeiro NP3D — fiado pago em partes (versão 4.2)
--  Rode este arquivo inteiro no SQL Editor depois do v4-fiados.sql.
--  Pode rodar mais de uma vez sem problema. O app antigo continua
--  funcionando depois dele (sem informar valor, recebe tudo, como antes).
-- =====================================================================

-- Quanto já foi pago do fiado. O que falta é valor - pago.
alter table public.fiados add column if not exists pago numeric(12,2) not null default 0;
alter table public.fiados drop constraint if exists fiados_pago_valido;
alter table public.fiados add constraint fiados_pago_valido check (pago >= 0 and pago < valor);

-- A função antiga (3 parâmetros) dá lugar à nova, que aceita o valor pago.
-- Sem p_valor (ou nulo), recebe tudo o que falta.
drop function if exists public.receber_fiado(bigint, text, date);
create or replace function public.receber_fiado(p_id bigint, p_forma text, p_data date, p_valor numeric default null)
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
  if p_data is null or p_data > hoje or p_data < f.data then
    raise exception 'A data do pagamento não pode ser antes da entrega nem no futuro.';
  end if;
  falta := f.valor - f.pago;
  v := coalesce(p_valor, falta);
  if v <= 0 or v > falta then
    raise exception 'O valor pago tem que ser maior que zero e no máximo o que falta.';
  end if;

  insert into public.lancamentos (tipo, valor, categoria_id, descricao, forma_pagamento, data, usuario_id)
  values ('entrada', v, f.categoria_id,
          left(btrim(f.nome) || ' · ' || btrim(f.descricao), 192) || case when v < falta then ' (parte)' else '' end,
          btrim(p_forma), p_data, auth.uid())
  returning * into novo;

  if v = falta then
    delete from public.fiados where id = p_id;
  else
    update public.fiados set pago = pago + v where id = p_id;
  end if;
  return novo;
end $$;

revoke all on function public.receber_fiado(bigint, text, date, numeric) from public, anon;
grant execute on function public.receber_fiado(bigint, text, date, numeric) to authenticated;

-- Conferência: deve mostrar as duas linhas com ok = true
select 'coluna pago' as criado, exists (select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'fiados' and column_name = 'pago') as ok
union all
select 'receber_fiado com valor', exists (select 1 from pg_proc where proname = 'receber_fiado' and pronargs = 4);
