#!/usr/bin/env bash
# Configure a new, isolated staging environment. Never read or copy live .env.
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
umask 077

if [[ "$(basename "$PWD")" != "OficinaOS-inovito-stage" ]]; then
  echo "Usa uma pasta independente chamada OficinaOS-inovito-stage." >&2
  exit 1
fi
if [[ -e .env.inovito-stage ]]; then
  echo "As credenciais de staging já existem; não foram alteradas."
  exit 0
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "É necessário openssl para gerar segredos de staging." >&2
  exit 1
fi
url="${1:-}"
# An explicitly configured HTTPS origin is mandatory before any credentials.
if [[ ! "$url" =~ ^https://[a-zA-Z0-9.-]+(:[0-9]{2,5})?$ ]] ||
  [[ "$url" == "https://inove.pt" ]] ||
  [[ "$url" == "https://localhost" ]] ||
  [[ "$url" == *".local"* ]] ||
  [[ "$url" == *"127.0.0.1"* ]]; then
  echo "Indica um endereço HTTPS exclusivo de staging, sem caminho nem query." >&2
  echo "Exemplo: scripts/setup-inovito-stage-env.sh https://inovito-teste.exemplo.pt" >&2
  exit 1
fi

(
  set -o noclobber
  cat > .env.inovito-stage <<EOF
# Gerado no servidor. Nunca partilhar chaves com o chat nem fazer commit.
INOVITO_STAGE_DB_PASSWORD=$(openssl rand -hex 32)
BETTER_AUTH_SECRET=$(openssl rand -hex 40)
COOKIE_SECRET=$(openssl rand -hex 40)
AI_ENCRYPTION_KEY=$(openssl rand -hex 40)
SETUP_TOKEN=$(openssl rand -hex 24)
NODE_ENV=production
HOST=0.0.0.0
PORT=4000
APP_URL=$url
TZ=Europe/Lisbon
TRUST_PROXY=false
OFICINAOS_SANDBOX=true
OFICINAOS_INOVITO_STAGING=true
INOVITO_SITE_ORIGINS=https://inove.pt
# Only after HTTPS, owner login and an explicit read-only opt-in.
INOVITO_WOO_PRIVATE_ENABLED=false
INOVITO_STAGE_PRIVATE_READ=false
EOF
)
chmod 600 .env.inovito-stage
echo "Staging configurada para $url. As chaves não foram mostradas."
echo "Ainda NÃO foram iniciados contentores nem alteradas bases de dados."
echo "Configura o proxy HTTPS de $url para 127.0.0.1:4003 antes de autenticar."
