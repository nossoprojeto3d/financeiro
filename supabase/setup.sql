-- =====================================================================
--  Caixa · Nosso Projeto 3D — setup do banco (Supabase)
--  PASSO 1: cole tudo deste arquivo até o "PASSO 2" no SQL Editor e rode.
-- =====================================================================

-- Perfis: um por usuário do Supabase Auth (Junior e Thai)
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  cor text not null default '#C9A227',
  criado_em timestamptz not null default now()
);

-- Categorias flexíveis (dá pra criar novas direto pelo app)
-- natureza de entrada: venda | aporte | outra
-- natureza de saída:   variavel | fixa | investimento
create table if not exists public.categorias (
  id bigint generated always as identity primary key,
  nome text not null,
  tipo text not null check (tipo in ('entrada','saida')),
  natureza text not null check (natureza in ('venda','aporte','outra','variavel','fixa','investimento')),
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (nome, tipo)
);

-- Lançamentos
create table if not exists public.lancamentos (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('entrada','saida')),
  valor numeric(12,2) not null check (valor > 0),
  categoria_id bigint not null references public.categorias(id),
  descricao text,
  forma_pagamento text,
  data date not null default current_date,
  usuario_id uuid not null default auth.uid() references public.perfis(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists lancamentos_data_idx on public.lancamentos (data desc);

-- Atualiza "atualizado_em" automaticamente
create or replace function public.tocar_atualizado()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;

drop trigger if exists lancamentos_tocar on public.lancamentos;
create trigger lancamentos_tocar before update on public.lancamentos
for each row execute function public.tocar_atualizado();

-- Só quem tem perfil (vocês dois) acessa qualquer dado
create or replace function public.is_membro()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis where id = auth.uid());
$$;

alter table public.perfis      enable row level security;
alter table public.categorias  enable row level security;
alter table public.lancamentos enable row level security;

drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated
  using ((select public.is_membro()));

drop policy if exists perfis_editar_proprio on public.perfis;
create policy perfis_editar_proprio on public.perfis for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists categorias_membros on public.categorias;
create policy categorias_membros on public.categorias for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));

drop policy if exists lancamentos_membros on public.lancamentos;
create policy lancamentos_membros on public.lancamentos for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));

revoke all on public.perfis, public.categorias, public.lancamentos from anon;
grant select, update on public.perfis to authenticated;
grant select, insert, update, delete on public.categorias, public.lancamentos to authenticated;

-- Categorias iniciais pensadas pra impressão 3D (edite à vontade depois)
insert into public.categorias (nome, tipo, natureza) values
  ('Vendas Shopee',              'entrada', 'venda'),
  ('Vendas diretas / WhatsApp',  'entrada', 'venda'),
  ('Encomendas personalizadas',  'entrada', 'venda'),
  ('Aporte de investidor',       'entrada', 'aporte'),
  ('Saldo inicial / ajuste',     'entrada', 'outra'),
  ('Filamento',                  'saida',   'variavel'),
  ('Embalagens',                 'saida',   'variavel'),
  ('Frete / envio',              'saida',   'variavel'),
  ('Taxas Shopee',               'saida',   'variavel'),
  ('Energia elétrica',           'saida',   'variavel'),
  ('Manutenção e peças',         'saida',   'fixa'),
  ('Anúncios / marketing',       'saida',   'fixa'),
  ('Software e assinaturas',     'saida',   'fixa'),
  ('Outras despesas',            'saida',   'fixa'),
  ('Impressoras e equipamentos', 'saida',   'investimento'),
  ('Ferramentas e acessórios',   'saida',   'investimento')
on conflict (nome, tipo) do nothing;


-- =====================================================================
--  PASSO 2: depois de criar os dois usuários em Authentication > Users,
--  troque os e-mails abaixo e rode só este bloco.
-- =====================================================================
insert into public.perfis (id, nome, cor)
select id, 'Junior', '#C9A227' from auth.users where email = 'EMAIL_DO_JUNIOR'
on conflict (id) do update set nome = excluded.nome, cor = excluded.cor;

insert into public.perfis (id, nome, cor)
select id, 'Thai', '#8FB5C9' from auth.users where email = 'EMAIL_DA_THAI'
on conflict (id) do update set nome = excluded.nome, cor = excluded.cor;

-- Conferir: deve listar os dois
select p.nome, u.email from public.perfis p join auth.users u on u.id = p.id;
