// Configuração do Caixa · Nosso Projeto 3D
// Pegue esses dados no Supabase: Project Settings > API (ou botão "Connect").
// A chave pública (anon / publishable) pode ficar no GitHub: quem protege os
// dados são as regras de segurança do banco (RLS) criadas no setup.sql.
window.CAIXA_CONFIG = {
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  SUPABASE_KEY: 'SUA_CHAVE_PUBLICA',
  // Aparecem como botões na tela de login (só digita a senha)
  USUARIOS: [
    { nome: 'Junior', email: 'EMAIL_DO_JUNIOR' },
    { nome: 'Thai',   email: 'EMAIL_DA_THAI' }
  ]
};
