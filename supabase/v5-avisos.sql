-- =====================================================================
--  Financeiro NP3D — avisos de vencimento no iPhone (versão 5.1)
--  Rode este arquivo inteiro no SQL Editor. Pode rodar mais de uma vez.
--  Depois, rode o v5-avisos-agenda.sql (com a senha do agendamento).
-- =====================================================================

-- Cada aparelho que ligou os avisos (Ajustes › Avisar vencimentos neste iPhone).
-- endpoint/p256dh/auth são o "endereço" que o próprio navegador cria para receber notificações.
create table if not exists public.push_inscricoes (
  id bigint generated always as identity primary key,
  usuario_id uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 10 and 1000),
  p256dh text not null check (char_length(p256dh) between 10 and 200),
  auth text not null check (char_length(auth) between 5 and 100),
  criado_em timestamptz not null default now()
);

-- cada um só vê e mexe nos próprios aparelhos (o envio diário usa a chave de serviço, na função)
alter table public.push_inscricoes enable row level security;
drop policy if exists push_inscricoes_proprias on public.push_inscricoes;
create policy push_inscricoes_proprias on public.push_inscricoes for all to authenticated
  using (usuario_id = (select auth.uid()) and (select public.is_membro()))
  with check (usuario_id = (select auth.uid()) and (select public.is_membro()));
revoke all on public.push_inscricoes from anon;
grant select, insert, update, delete on public.push_inscricoes to authenticated;

-- Conferência: deve mostrar a linha com ok = true
select 'tabela push_inscricoes' as criado, to_regclass('public.push_inscricoes') is not null as ok;
