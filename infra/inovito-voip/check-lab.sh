#!/usr/bin/env bash
# Read-only health checks for the isolated Inovito SIP lab.
# This does NOT establish an audio call, enable ARI, or forward a SIM call.
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

die() { printf 'FALHA: %s\n' "$*" >&2; exit 1; }
ok() { printf 'OK: %s\n' "$*"; }

command -v docker >/dev/null 2>&1 || die "Docker indisponível"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 indisponível"
docker compose -f compose.yml config -q || die "Configuração Compose inválida"
ok "Configuração Compose válida"

docker compose -f compose.yml exec -T asterisk asterisk -rx 'core show version' >/dev/null 2>&1 ||
  die "Contentor Asterisk indisponível"
ok "Asterisk está a responder"

SIP_BIND="$(docker port inovito-asterisk-lab 5060/udp 2>/dev/null || true)"
[[ "$SIP_BIND" == "127.0.0.1:15060" ]] ||
  die "SIP não está isolado como esperado (127.0.0.1:15060); configuração observada: ${SIP_BIND:-nenhuma}"
ok "Porta SIP publicada apenas na loopback do servidor"

docker compose -f compose.yml exec -T -u asterisk asterisk test -r /etc/asterisk/pjsip-peer.conf ||
  die "O utilizador Asterisk não consegue ler a configuração SIP privada"
ok "Asterisk pode ler as credenciais SIP sem acesso público"

ENDPOINTS="$(docker compose -f compose.yml exec -T asterisk asterisk -rx 'pjsip show endpoints')"
grep -Eq 'Endpoint:[[:space:]]+inovito-lab([[:space:]]|$)' <<< "$ENDPOINTS" ||
  die "A extensão SIP inovito-lab não foi carregada"
ok "Extensão de testes inovito-lab carregada"

TRANSPORTS="$(docker compose -f compose.yml exec -T asterisk asterisk -rx 'pjsip show transports')"
grep -Eq 'Transport:[[:space:]]+transport-udp([[:space:]]|$)' <<< "$TRANSPORTS" ||
  die "Transporte SIP UDP não foi carregado"
ok "Transporte SIP UDP carregado"

DIALPLAN="$(docker compose -f compose.yml exec -T asterisk asterisk -rx 'dialplan show 999@inovito-lab')"
grep -q 'Echo()' <<< "$DIALPLAN" ||
  die "A extensão 999 não tem Echo()"
ok "Extensão 999 preparada para eco"

if ! grep -Eq '^[[:space:]]*enabled=no' asterisk/http.conf ||
   ! grep -Eq '^[[:space:]]*enabled=no' asterisk/ari.conf; then
  die "ARI/HTTP deixaram de estar desativados neste laboratório"
fi
ok "ARI/HTTP desativados neste laboratório"

printf '\nConfiguração SIP validada.\n'
printf 'AINDA FALTA: telefonema RTP/áudio de teste, gateway FXO, serviço de IA e integração de eventos com OficinaOS.\n'
printf 'Não altere o desvio do número principal e não exponha SIP/ARI na Internet.\n'
