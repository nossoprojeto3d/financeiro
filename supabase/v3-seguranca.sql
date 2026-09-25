-- =====================================================================
--  Financeiro NP3D — reforço de segurança (versão de lançamento 3.0)
--  Rode este arquivo inteiro no SQL Editor depois do setup.sql, v2.sql
--  e v2-ordem.sql. Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- A função que marca "atualizado_em" passa a ter caminho de busca fixo
-- (o Supabase aponta isso como alerta de segurança quando fica aberto).
create or replace function public.tocar_atualizado()
returns trigger language plpgsql set search_path = '' as $$
begin new.atualizado_em = now(); return new; end $$;

-- Cor do perfil: só código de cor (#RGB até #RRGGBBAA). Ela vai para o
-- estilo da página, então não pode aceitar texto qualquer.
update public.perfis set cor = '#C9A227' where cor !~ '^#[0-9A-Fa-f]{3,8}$';
alter table public.perfis drop constraint if exists perfis_cor_valida;
alter table public.perfis add constraint perfis_cor_valida check (cor ~ '^#[0-9A-Fa-f]{3,8}$');

-- Tamanhos máximos (o app já limita; aqui é a garantia no banco)
alter table public.perfis drop constraint if exists perfis_nome_tamanho;
alter table public.perfis add constraint perfis_nome_tamanho check (char_length(nome) between 1 and 40);

alter table public.categorias drop constraint if exists categorias_nome_tamanho;
alter table public.categorias add constraint categorias_nome_tamanho check (char_length(nome) between 1 and 60);

alter table public.lancamentos drop constraint if exists lancamentos_textos_tamanho;
alter table public.lancamentos add constraint lancamentos_textos_tamanho
  check (char_length(coalesce(descricao, '')) <= 200 and char_length(coalesce(forma_pagamento, '')) <= 40);

-- Sem lançamento com data no futuro (o app não deixa; o banco confirma).
-- Margem de 1 dia por causa do fuso horário.
alter table public.lancamentos drop constraint if exists lancamentos_data_valida;
alter table public.lancamentos add constraint lancamentos_data_valida
  check (data between date '2000-01-01' and (current_date + 1)) not valid;

alter table public.recorrentes drop constraint if exists recorrentes_textos_tamanho;
alter table public.recorrentes add constraint recorrentes_textos_tamanho
  check (char_length(coalesce(descricao, '')) <= 200 and char_length(coalesce(forma_pagamento, '')) <= 40);

-- Funções internas não ficam abertas para quem não entrou
revoke all on function public.is_membro() from public, anon;
grant execute on function public.is_membro() to authenticated;

-- Índices para as buscas que o app mais faz
create index if not exists lancamentos_categoria_idx on public.lancamentos (categoria_id);
create index if not exists recorrentes_categoria_idx on public.recorrentes (categoria_id);

-- Conferência: deve listar as restrições novas
select conname from pg_constraint
where conname in ('perfis_cor_valida', 'perfis_nome_tamanho', 'categorias_nome_tamanho',
  'lancamentos_textos_tamanho', 'lancamentos_data_valida', 'recorrentes_textos_tamanho')
order by conname;
