#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
umask 077

if [[ -e .env.misto ]]; then
  echo ".env.misto já existe: credenciais preservadas. Não foram alteradas."
  exit 0
fi

if ! command -v tailscale >/dev/null 2>&1; then
  echo "Tailscale não encontrado no servidor: não criar instalação exposta na rede." >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "É necessário openssl para gerar segredos." >&2
  exit 1
fi

MISTO_IP="$(tailscale ip -4 | head -n 1)"
if [[ ! "$MISTO_IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
  echo "Sem IP IPv4 válido do Tailscale; verifica a ligação." >&2
  exit 1
fi

if command -v ss >/dev/null 2>&1 && ss -H -ltn '( sport = :4002 )' | grep -q .; then
  echo "A porta 4002 já está ocupada; não substituir serviços existentes." >&2
  exit 1
fi

(
  set -o noclobber
  cat > .env.misto <<EOF
# Gerado no servidor, nunca enviar para chat/GitHub.
MISTO_BIND_IP=${MISTO_IP}
MISTO_DB_PASSWORD=$(openssl rand -hex 32)
NODE_ENV=production
HOST=0.0.0.0
PORT=4000
APP_URL=http://${MISTO_IP}:4002
BETTER_AUTH_SECRET=$(openssl rand -hex 40)
AI_ENCRYPTION_KEY=$(openssl rand -hex 40)
COOKIE_SECRET=$(openssl rand -hex 40)
SETUP_TOKEN=$(openssl rand -hex 24)
TZ=Europe/Lisbon
TRUST_PROXY=false
OFICINAOS_SANDBOX=true
EOF
)
chmod 600 .env.misto

echo "Configuração isolada criada: .env.misto (permissões 600)."
echo "Acesso de testes: http://${MISTO_IP}:4002"
echo "Não apresentar o conteúdo de .env.misto: contém palavras-passe."
echo "Ainda não iniciou contentores nem alterou bases de dados."
