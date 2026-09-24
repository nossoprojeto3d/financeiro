-- =====================================================================
--  Caixa · Nosso Projeto 3D — atualização V2 (recorrentes)
--  Rode este arquivo inteiro no SQL Editor depois do setup.sql.
--  Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- Lançamentos que se repetem todo mês (assinaturas, contas fixas...)
create table if not exists public.recorrentes (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('entrada','saida')),
  valor numeric(12,2) not null check (valor > 0),
  categoria_id bigint not null references public.categorias(id),
  descricao text,
  forma_pagamento text,
  dia_mes int not null check (dia_mes between 1 and 31),
  inicio date not null default current_date,
  gerado_ate date,
  ativa boolean not null default true,
  usuario_id uuid not null default auth.uid() references public.perfis(id),
  criado_em timestamptz not null default now()
);

-- Nova coluna nos lançamentos: de qual lançamento recorrente ele veio
alter table public.lancamentos add column if not exists recorrente_id bigint;

do $$ begin
  alter table public.lancamentos add constraint lancamentos_recorrente_fk
    foreign key (recorrente_id) references public.recorrentes(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.lancamentos add constraint lancamentos_recorrente_data_uk unique (recorrente_id, data);
exception when duplicate_object or duplicate_table then null; end $$;

alter table public.recorrentes enable row level security;
drop policy if exists recorrentes_membros on public.recorrentes;
create policy recorrentes_membros on public.recorrentes for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));
revoke all on public.recorrentes from anon;
grant select, insert, update, delete on public.recorrentes to authenticated;

-- Gera os lançamentos recorrentes que já venceram (o app chama ao abrir).
-- Usa o horário de Brasília. Se vocês excluírem um lançamento gerado,
-- ele não volta, porque cada recorrente lembra até onde já gerou.
create or replace function public.gerar_recorrentes()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  mes date; dia int; alvo date; ultimo date;
  total int := 0; qtd int;
begin
  if not public.is_membro() then raise exception 'sem permissão'; end if;
  for r in select * from public.recorrentes where ativa for update loop
    ultimo := r.gerado_ate;
    mes := date_trunc('month', greatest(r.inicio, coalesce(r.gerado_ate + 1, r.inicio)))::date;
    while mes <= date_trunc('month', hoje)::date loop
      dia := least(r.dia_mes, extract(day from (mes + interval '1 month' - interval '1 day'))::int);
      alvo := mes + (dia - 1);
      if alvo >= r.inicio and alvo <= hoje and (r.gerado_ate is null or alvo > r.gerado_ate) then
        insert into public.lancamentos (tipo, valor, categoria_id, descricao, forma_pagamento, data, usuario_id, recorrente_id)
        values (r.tipo, r.valor, r.categoria_id, r.descricao, r.forma_pagamento, alvo, r.usuario_id, r.id)
        on conflict (recorrente_id, data) do nothing;
        get diagnostics qtd = row_count;
        total := total + qtd;
        ultimo := alvo;
      end if;
      mes := (mes + interval '1 month')::date;
    end loop;
    if ultimo is distinct from r.gerado_ate then
      update public.recorrentes set gerado_ate = ultimo where id = r.id;
    end if;
  end loop;
  return total;
end $$;

revoke all on function public.gerar_recorrentes() from public, anon;
grant execute on function public.gerar_recorrentes() to authenticated;
