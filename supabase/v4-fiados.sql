-- =====================================================================
--  Financeiro NP3D — fiados (versão 4.1)
--  Quem levou e ainda não pagou. Rode este arquivo inteiro no SQL Editor
--  depois dos outros (setup, v2, v2-ordem, v3-seguranca).
--  Pode rodar mais de uma vez sem problema.
-- =====================================================================

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

drop trigger if exists fiados_atualizado on public.fiados;
create trigger fiados_atualizado before update on public.fiados
  for each row execute function public.tocar_atualizado();

alter table public.fiados enable row level security;
drop policy if exists fiados_membros on public.fiados;
create policy fiados_membros on public.fiados for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));
revoke all on public.fiados from anon;
grant select, insert, update, delete on public.fiados to authenticated;

create index if not exists fiados_categoria_idx on public.fiados (categoria_id);

-- Recebeu: apaga o fiado e lança a venda juntos. Se dois pedidos chegarem
-- ao mesmo tempo (toque duplo, os dois celulares), o segundo não acha mais
-- o fiado e não lança nada.
create or replace function public.receber_fiado(p_id bigint, p_forma text, p_data date)
returns public.lancamentos language plpgsql security definer set search_path = '' as $$
declare
  f public.fiados;
  novo public.lancamentos;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.is_membro() then raise exception 'sem permissão'; end if;
  if char_length(coalesce(btrim(p_forma), '')) not between 1 and 40 then
    raise exception 'Escolha a forma de pagamento.';
  end if;
  delete from public.fiados where id = p_id returning * into f;
  if not found then raise exception 'Esse fiado já foi recebido ou excluído.'; end if;
  if p_data is null or p_data > hoje or p_data < f.data then
    raise exception 'A data do pagamento não pode ser antes da entrega nem no futuro.';
  end if;
  insert into public.lancamentos (tipo, valor, categoria_id, descricao, forma_pagamento, data, usuario_id)
  values ('entrada', f.valor, f.categoria_id, left(btrim(f.nome) || ' · ' || btrim(f.descricao), 200),
          btrim(p_forma), p_data, auth.uid())
  returning * into novo;
  return novo;
end $$;

revoke all on function public.receber_fiado(bigint, text, date) from public, anon;
grant execute on function public.receber_fiado(bigint, text, date) to authenticated;

-- Conferência: deve mostrar a tabela e a função
select 'fiados' as criado, to_regclass('public.fiados') is not null as ok
union all
select 'receber_fiado', exists (select 1 from pg_proc where proname = 'receber_fiado');
