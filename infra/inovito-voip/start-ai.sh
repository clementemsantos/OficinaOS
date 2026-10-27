#!/usr/bin/env bash
# Safe, optional voice AI test on 997. Existing 998/999 and SIP/RTP untouched.
set -Eeuo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Executar: sudo bash start-ai.sh" >&2
  exit 1
fi
for item in compose.yml compose.ai.yml asterisk/extensions.conf sounds/en/custom/inovito-boas-vindas.wav; do
  [[ -s "$item" ]] || { echo "Falta o ficheiro: $item" >&2; exit 1; }
done
command -v docker >/dev/null || { echo "Falta Docker" >&2; exit 1; }
docker compose version >/dev/null || { echo "Falta Docker Compose" >&2; exit 1; }
docker inspect inovito-asterisk-lab >/dev/null 2>&1 || {
  echo "Inicia primeiro o laboratório Asterisk existente." >&2
  exit 1
}

# Keep credentials strictly local and never print their contents.
if [[ ! -s .env.ai ]]; then
  read -r -s -p "Chave Gemini API (não será mostrada): " API_KEY
  printf "\n"
  [[ -n "$API_KEY" ]] || { echo "Chave vazia; cancelado." >&2; exit 1; }
  umask 077
  printf 'GEMINI_API_KEY=%s\n' "$API_KEY" > .env.ai
  unset API_KEY
fi
chmod 600 .env.ai

mkdir -p runtime/recordings sounds/en/custom
chmod 700 runtime/recordings
chmod 755 sounds/en/custom

# Verify the original lab has a volume for persistent sounds (as established by 998).
if ! docker inspect inovito-asterisk-lab --format '{{range .Mounts}}{{println .Destination}}{{end}}' |
  grep -Fxq /var/lib/asterisk/sounds/en; then
  echo "A pasta de sons não está montada em /var/lib/asterisk/sounds/en." >&2
  exit 1
fi

if ! grep -qE '^[[:space:]]*exten[[:space:]]*=>[[:space:]]*997,' asterisk/extensions.conf; then
  grep -qF '[inovito-lab]' asterisk/extensions.conf ||
    { echo "Falta o contexto inovito-lab; não alterei o dialplan." >&2; exit 1; }
  grep -qE '^[[:space:]]*exten[[:space:]]*=>[[:space:]]*999,' asterisk/extensions.conf ||
    { echo "Falta a extensão 999; não alterei o dialplan." >&2; exit 1; }
  cp -p asterisk/extensions.conf "asterisk/extensions.conf.pre-ai.$(date +%Y%m%d-%H%M%S).bak"
  cat >> asterisk/extensions.conf <<'EOF'

; Inovito IA de TESTES. Não ligar a trunks nem a chamadas externas.
exten => 997,1,NoOp(Inovito Gemini IA - apenas laboratório)
 same => n,Answer()
 same => n,Wait(1)
 same => n,AGI(agi://voice-gateway:4573/inovito)
 same => n,Hangup()
EOF
fi

docker compose -f compose.yml -f compose.ai.yml config -q
echo "A criar gateway de IA (pode demorar no primeiro arranque)."
docker compose -f compose.yml -f compose.ai.yml up -d --no-deps --build --force-recreate asterisk voice-gateway

# Ensure the Asterisk user can write the temporary call recordings.
docker compose -f compose.yml -f compose.ai.yml exec -T -u root asterisk \
  chown asterisk:asterisk /var/spool/asterisk/recording
docker compose -f compose.yml -f compose.ai.yml exec -T -u root asterisk \
  chmod 700 /var/spool/asterisk/recording

docker exec inovito-asterisk-lab asterisk -rx 'dialplan reload'
echo
echo "Verificar extensão 997:"
docker exec inovito-asterisk-lab asterisk -rx 'dialplan show 997@inovito-lab'
echo
echo "Estado dos contentores:"
docker compose -f compose.yml -f compose.ai.yml ps
echo
echo "A 998 (saudação) e a 999 (eco) continuam inalteradas."
echo "Fazer uma chamada de teste para 997. Sem qualquer desvio do número principal."
