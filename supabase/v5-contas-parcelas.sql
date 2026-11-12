-- =====================================================================
--  Financeiro NP3D — contas que repetem até um mês (parcelas) — versão 5.2
--  Rode este arquivo inteiro no SQL Editor, depois do v5-contas.sql.
--  Pode rodar mais de uma vez. O app antigo continua funcionando depois dele.
-- =====================================================================

-- inicio = vencimento da 1ª parcela; ate = mês da última (dia 1). ate vazio = repete sempre.
alter table public.contas_regras add column if not exists inicio date;
alter table public.contas_regras add column if not exists ate date;
do $$ begin
  alter table public.contas_regras add constraint contas_regras_ate_ck
    check (ate is null or (inicio is not null and ate >= date_trunc('month', inicio)::date));
exception when duplicate_object then null; end $$;

-- Gera a conta de cada mês das regras, até o mês atual e sem passar do "ate".
-- Conta gerada que for excluída não volta: a regra lembra até onde já gerou.
create or replace function public.gerar_contas()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  mes date; alvo date; ultimo date; limite date;
  total int := 0; qtd int;
begin
  if not public.is_membro() then raise exception 'sem permissão'; end if;
  for r in select * from public.contas_regras for update loop
    ultimo := r.gerado_ate;
    limite := least(date_trunc('month', hoje)::date, coalesce(date_trunc('month', r.ate)::date, date '2100-12-01'));
    mes := case when r.gerado_ate is null then date_trunc('month', hoje)::date
                else (date_trunc('month', r.gerado_ate) + interval '1 month')::date end;
    while mes <= limite loop
      alvo := mes + (least(r.dia, extract(day from (mes + interval '1 month' - interval '1 day'))::int) - 1);
      insert into public.contas (descricao, valor, categoria_id, vencimento, regra_id, usuario_id)
      values (r.descricao, r.valor, r.categoria_id, alvo, r.id, r.usuario_id)
      on conflict (regra_id, vencimento) do nothing;
      get diagnostics qtd = row_count;
      total := total + qtd;
      ultimo := alvo;
      mes := (mes + interval '1 month')::date;
    end loop;
    if ultimo is distinct from r.gerado_ate then
      update public.contas_regras set gerado_ate = ultimo where id = r.id;
    end if;
  end loop;
  return total;
end $$;
revoke all on function public.gerar_contas() from public, anon;
grant execute on function public.gerar_contas() to authenticated;

-- Paguei: lança a saída e tira a conta da lista no mesmo passo. p_valor_esperado é o que a
-- tela mostrava: se outro celular pagou ou mudou a conta nesse meio-tempo, recusa.
-- p_adiantar: paga também a próxima parcela (só nas que têm fim), com o valor da regra; o
-- mês dela fica vazio. Devolve as saídas criadas (uma ou duas).
-- Parcela: a descrição leva "Máquina · 3/10"; as que repetem sempre seguem com "· vencimento 10/10".
drop function if exists public.pagar_conta(bigint, text, date, numeric, numeric);
create or replace function public.pagar_conta(
  p_id bigint, p_forma text, p_data date, p_valor numeric, p_valor_esperado numeric default null,
  p_adiantar boolean default false)
returns setof public.lancamentos language plpgsql security definer set search_path = '' as $$
declare
  c public.contas;
  rg public.contas_regras;
  novo public.lancamentos;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  total int; n int; prox date; alvo date;
begin
  if not public.is_membro() then raise exception 'sem permissão'; end if;
  if char_length(coalesce(btrim(p_forma), '')) not between 1 and 40 then
    raise exception 'Escolha a forma de pagamento.';
  end if;
  select * into c from public.contas where id = p_id for update;
  if not found then raise exception 'Essa conta já foi paga ou excluída.'; end if;
  if p_valor_esperado is not null and c.valor <> p_valor_esperado then
    raise exception 'Essa conta mudou agora há pouco (outro celular). Confira a lista e tente de novo.';
  end if;
  if p_data is null or p_data > hoje or p_data < date '2000-01-01' then
    raise exception 'A data do pagamento não pode ser no futuro.';
  end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Digite quanto pagou.'; end if;

  if c.regra_id is not null then
    select * into rg from public.contas_regras where id = c.regra_id for update;
  end if;
  if rg.ate is not null then
    -- meses entre a 1ª parcela e a última (total) e entre a 1ª e esta (n), contando as duas pontas
    total := (extract(year from rg.ate)::int * 12 + extract(month from rg.ate)::int)
           - (extract(year from rg.inicio)::int * 12 + extract(month from rg.inicio)::int) + 1;
    n := (extract(year from c.vencimento)::int * 12 + extract(month from c.vencimento)::int)
       - (extract(year from rg.inicio)::int * 12 + extract(month from rg.inicio)::int) + 1;
  end if;

  insert into public.lancamentos (tipo, valor, categoria_id, descricao, forma_pagamento, data, usuario_id)
  values ('saida', p_valor, c.categoria_id,
          left(btrim(c.descricao), 180) || case when total is not null and n between 1 and total
            then ' · ' || n || '/' || total else ' · vencimento ' || to_char(c.vencimento, 'DD/MM') end,
          btrim(p_forma), p_data, auth.uid())
  returning * into novo;
  return next novo;
  delete from public.contas where id = p_id;

  if p_adiantar then
    if rg.ate is null then raise exception 'Essa conta não tem parcelas para adiantar.'; end if;
    prox := (date_trunc('month', c.vencimento) + interval '1 month')::date;
    if prox > rg.ate then raise exception 'Essa já era a última parcela.'; end if;
    if rg.gerado_ate is not null and date_trunc('month', rg.gerado_ate)::date >= prox then
      raise exception 'A próxima parcela já está na lista. Pague por ela.';
    end if;
    alvo := prox + (least(rg.dia, extract(day from (prox + interval '1 month' - interval '1 day'))::int) - 1);
    insert into public.lancamentos (tipo, valor, categoria_id, descricao, forma_pagamento, data, usuario_id)
    values ('saida', rg.valor, rg.categoria_id,
            left(btrim(rg.descricao), 180) || ' · ' || (n + 1) || '/' || total,
            btrim(p_forma), p_data, auth.uid())
    returning * into novo;
    return next novo;
    update public.contas_regras set gerado_ate = alvo where id = rg.id;
  end if;
  return;
end $$;
revoke all on function public.pagar_conta(bigint, text, date, numeric, numeric, boolean) from public, anon;
grant execute on function public.pagar_conta(bigint, text, date, numeric, numeric, boolean) to authenticated;

-- Conferência: deve mostrar as duas linhas com ok = true
select 'colunas inicio e ate' as criado,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'contas_regras' and column_name = 'ate') as ok
union all select 'pagar_conta com adiantar',
  exists (select 1 from pg_proc where proname = 'pagar_conta' and 'p_adiantar' = any(proargnames));
