#!/usr/bin/env bash
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não está instalado neste computador." >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 não está disponível." >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "Instale openssl antes de criar o utilizador SIP de testes." >&2
  exit 1
fi

mkdir -p runtime
chmod 700 runtime
if [[ ! -f runtime/pjsip-peer.conf ]]; then
  PASSWORD="$(openssl rand -hex 24)"
  umask 077
  cat >runtime/pjsip-peer.conf <<EOC
[inovito-lab]
type=endpoint
context=inovito-lab
disallow=all
allow=alaw,ulaw
aors=inovito-lab
auth=inovito-lab-auth
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes

[inovito-lab-auth]
type=auth
auth_type=userpass
username=inovito-lab
password=${PASSWORD}

[inovito-lab]
type=aor
max_contacts=1
remove_existing=yes
qualify_frequency=60
EOC
  chmod 600 runtime/pjsip-peer.conf
  echo "Credencial SIP de testes criada em runtime/pjsip-peer.conf (não a partilhe)."
fi

docker compose -f compose.yml config -q
docker compose -f compose.yml up -d

ready=0
for attempt in {1..15}; do
  if docker compose -f compose.yml exec -T asterisk asterisk -rx 'core show version' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" -ne 1 ]]; then
  echo "Asterisk não iniciou corretamente; últimos registos:" >&2
  docker compose -f compose.yml logs --tail=40 asterisk >&2
  exit 1
fi

echo
echo "Central Asterisk de TESTES iniciada, sem desvio do número Amigo."
echo "SIP somente no próprio servidor: 127.0.0.1:15060/udp."
echo "Verificar: docker compose -f compose.yml ps"
echo "Versão:   docker compose -f compose.yml exec -T asterisk asterisk -rx 'core show version'"
echo "Parar:    docker compose -f compose.yml down"
