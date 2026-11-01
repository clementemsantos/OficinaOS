#!/usr/bin/env bash
# Start or update only the dedicated, isolated Inovito staging project.
# The app starts with outbound workers blocked (OFICINAOS_SANDBOX=true).
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
umask 077

if [[ "$(basename "$PWD")" != "OficinaOS-inovito-stage" ]]; then
  echo "Recusado: executar apenas no checkout OficinaOS-inovito-stage." >&2
  exit 1
fi
branch="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ "$branch" != "inove/inovito-staging-4003" ]]; then
  echo "Recusado: branch inesperada ($branch). Não alterar o checkout de produção." >&2
  exit 1
fi
if [[ ! -f .env.inovito-stage ]]; then
  echo "Falta .env.inovito-stage. Executa primeiro setup-inovito-stage-env.sh." >&2
  exit 1
fi
if [[ "$(stat -c %a .env.inovito-stage)" != "600" ]]; then
  echo "Protege .env.inovito-stage com chmod 600." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null; then
  echo "Docker e docker compose são obrigatórios." >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl é necessário para verificar o /health." >&2
  exit 1
fi

# Never use 'down -v' or any command on another Docker Compose project.
dc() {
  docker compose --project-name oficinaos-inovito-stage \
    --env-file .env.inovito-stage -f compose.inovito-stage.yaml "$@"
}
dc config --quiet
echo "Configuração válida. Projeto: oficinaos-inovito-stage (porta loopback 4003)."
dc up -d db

backup_dir="$PWD/backups/inovito-stage"
mkdir -p "$backup_dir"
backup_file="$backup_dir/before-upgrade-$(date -u +%Y%m%dT%H%M%SZ).dump"
if ! dc exec -T db pg_dump -U inovito_stage -d oficinaos_stage -Fc > "$backup_file"; then
  rm -f "$backup_file"
  echo "Backup falhou. Não foi iniciada a aplicação." >&2
  exit 1
fi
if [[ ! -s "$backup_file" ]] ||
   ! dc exec -T db pg_restore --list < "$backup_file" >/dev/null; then
  echo "O backup de staging não passou na validação. Abortado." >&2
  exit 1
fi
echo "Backup local verificado (staging): $(basename "$backup_file")"
echo "A compilar a aplicação exclusivamente para o projeto de staging..."
dc build app
dc up -d --no-deps app

ok=false
for _ in $(seq 1 20); do
  if curl -fsS --max-time 3 http://127.0.0.1:4003/health >/dev/null 2>&1; then
    ok=true
    break
  fi
  sleep 3
done
if [[ "$ok" != "true" ]]; then
  echo "A app não respondeu em 127.0.0.1:4003. Verifica logs de staging." >&2
  echo "Comando: docker compose --project-name oficinaos-inovito-stage --env-file .env.inovito-stage -f compose.inovito-stage.yaml logs --tail=70 app"
  exit 1
fi
echo "SUCESSO: staging /health OK em 127.0.0.1:4003"
echo "Não foi alterada nenhuma instância das portas 4000, 4001 ou 4002."
echo "Antes de usar chaves privadas confirma o acesso HTTPS e cria o OWNER de testes."
echo "A leitura privada Woo está desligada até ativar as duas flags de staging."
