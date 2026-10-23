-- =====================================================================
--  Financeiro NP3D — agenda dos avisos: todo dia às 8h (Brasília) chama a função "avisos"
--  ANTES DE RODAR: troque COLE_A_SENHA_AQUI pelo valor de AVISOS_SEGREDO do arquivo
--  ~/Claude/financeiro-chaves-avisos.txt (o mesmo que foi guardado como segredo da função).
--  NUNCA salve este arquivo com a senha no repositório: ele é público.
--  Pode rodar mais de uma vez (troca o agendamento antigo pelo novo).
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('avisos-contas') where exists (select 1 from cron.job where jobname = 'avisos-contas');

-- 11h UTC = 8h em Brasília
select cron.schedule('avisos-contas', '0 11 * * *', $$
  select net.http_post(
    url := 'https://sruvkpqzpjqeqkesqffq.supabase.co/functions/v1/avisos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-avisos-segredo', 'COLE_A_SENHA_AQUI'),
    body := '{}'::jsonb
  )
$$);

-- Conferência: deve mostrar a linha com ok = true
select 'agenda avisos-contas' as criado, exists (select 1 from cron.job where jobname = 'avisos-contas' and schedule = '0 11 * * *') as ok;
