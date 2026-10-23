-- =====================================================================
--  Financeiro NP3D — contas a pagar (versão 5.0)
--  Rode este arquivo inteiro no SQL Editor. Pode rodar mais de uma vez.
--  O app antigo continua funcionando depois dele.
-- =====================================================================

-- Contas que voltam todo mês (energia, internet...): a regra gera a conta do mês.
create table if not exists public.contas_regras (
  id bigint generated always as identity primary key,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 200),
  valor numeric(12,2) not null check (valor > 0),
  categoria_id bigint not null references public.categorias(id),
  dia int not null check (dia between 1 and 31),
  gerado_ate date, -- último vencimento já gerado
  usuario_id uuid not null default auth.uid() references public.perfis(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Cada conta a pagar. Não entra em nenhuma conta do app até ser paga (pagar_conta vira saída).
create table if not exists public.contas (
  id bigint generated always as identity primary key,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 200),
  valor numeric(12,2) not null check (valor > 0),
  categoria_id bigint not null references public.categorias(id),
  vencimento date not null check (vencimento between date '2000-01-01' and date '2100-12-31'),
  regra_id bigint references public.contas_regras(id) on delete set null,
  usuario_id uuid not null default auth.uid() references public.perfis(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
do $$ begin
  alter table public.contas add constraint contas_regra_vencimento_uk unique (regra_id, vencimento);
exception when duplicate_object or duplicate_table then null; end $$;

drop trigger if exists contas_atualizado on public.contas;
create trigger contas_atualizado before update on public.contas
  for each row execute function public.tocar_atualizado();
drop trigger if exists contas_regras_atualizado on public.contas_regras;
create trigger contas_regras_atualizado before update on public.contas_regras
  for each row execute function public.tocar_atualizado();

alter table public.contas enable row level security;
alter table public.contas_regras enable row level security;
drop policy if exists contas_membros on public.contas;
create policy contas_membros on public.contas for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));
drop policy if exists contas_regras_membros on public.contas_regras;
create policy contas_regras_membros on public.contas_regras for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));
revoke all on public.contas, public.contas_regras from anon;
grant select, insert, update, delete on public.contas, public.contas_regras to authenticated;

create index if not exists contas_categoria_idx on public.contas (categoria_id);
create index if not exists contas_vencimento_idx on public.contas (vencimento);
create index if not exists contas_regras_categoria_idx on public.contas_regras (categoria_id);

-- Gera a conta de cada mês das regras, até o mês atual (o app chama ao abrir).
-- Conta gerada que for excluída não volta: a regra lembra até onde já gerou.
create or replace function public.gerar_contas()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  mes date; alvo date; ultimo date;
  total int := 0; qtd int;
begin
  if not public.is_membro() then raise exception 'sem permissão'; end if;
  for r in select * from public.contas_regras for update loop
    ultimo := r.gerado_ate;
    mes := case when r.gerado_ate is null then date_trunc('month', hoje)::date
                else (date_trunc('month', r.gerado_ate) + interval '1 month')::date end;
    while mes <= date_trunc('month', hoje)::date loop
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
create or replace function public.pagar_conta(
  p_id bigint, p_forma text, p_data date, p_valor numeric, p_valor_esperado numeric default null)
returns public.lancamentos language plpgsql security definer set search_path = '' as $$
declare
  c public.contas;
  novo public.lancamentos;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
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

  insert into public.lancamentos (tipo, valor, categoria_id, descricao, forma_pagamento, data, usuario_id)
  values ('saida', p_valor, c.categoria_id,
          left(btrim(c.descricao), 180) || ' · vencimento ' || to_char(c.vencimento, 'DD/MM'),
          btrim(p_forma), p_data, auth.uid())
  returning * into novo;
  delete from public.contas where id = p_id;
  return novo;
end $$;
revoke all on function public.pagar_conta(bigint, text, date, numeric, numeric) from public, anon;
grant execute on function public.pagar_conta(bigint, text, date, numeric, numeric) to authenticated;

-- Conferência: deve mostrar as três linhas com ok = true
select 'tabelas contas e contas_regras' as criado,
  to_regclass('public.contas') is not null and to_regclass('public.contas_regras') is not null as ok
union all select 'gerar_contas', exists (select 1 from pg_proc where proname = 'gerar_contas')
union all select 'pagar_conta', exists (select 1 from pg_proc where proname = 'pagar_conta');
