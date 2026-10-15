#!/bin/bash
# Confere se o backup automático do banco rodou nas últimas 36 horas.
# Roda antes de toda publicação (npm run conferir-backup, em app/).
# O backup fica no repositório privado nossoprojeto3d/financeiro-backup; aqui só se olha a data do último.
DIR="$HOME/Claude/financeiro-backup"
REPO=https://github.com/nossoprojeto3d/financeiro-backup
SEGREDO="$REPO/settings/secrets/actions"

if [ ! -d "$DIR/.git" ]; then
  git clone -q "$REPO.git" "$DIR" || { echo "⚠️  Não deu para baixar o repositório de backup ($REPO)."; exit 1; }
fi
git -C "$DIR" fetch -q origin 2>/dev/null || { echo "⚠️  Não deu para consultar o backup (sem internet ou sem acesso ao GitHub)."; exit 1; }

# só conta commit do próprio backup (não os de quem mexeu no repositório)
ultima=$(git -C "$DIR" log -1 --author="Backup automático" --format=%ct origin/main)
if [ -z "$ultima" ]; then echo "⚠️  O backup do banco ainda não rodou nenhuma vez."; exit 1; fi
horas=$(( ( $(date +%s) - ultima ) / 3600 ))

if [ "$horas" -gt "${LIMITE_HORAS:-36}" ]; then
  echo "⚠️  O BACKUP DO BANCO ESTÁ PARADO HÁ $horas HORAS."
  echo "    Causa mais provável: a senha do banco foi trocada no Supabase."
  echo "    Atualize o segredo SUPABASE_DB_URL (Session pooler, porta 5432, com a senha nova): $SEGREDO"
  echo "    Veja também se há um aviso aberto em $REPO/issues"
  exit 1
fi
echo "✅ Backup do banco em dia (última cópia há $horas h)."
