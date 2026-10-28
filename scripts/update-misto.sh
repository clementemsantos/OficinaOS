#!/usr/bin/env bash
# Run after pulling the validated inove/release-candidate branch.
set -Eeuo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f compose.misto.yaml && -f .env.misto ]] || { echo "Faltam compose.misto.yaml ou .env.misto. Não foi alterado nenhum serviço."; exit 1; }
git merge-base --is-ancestor f5132469e53b17cf3457181ec2f93893698b6325 HEAD || { echo "É necessário obter primeiro a versão Misto que integra a v1.0.21."; exit 1; }
changes=$(git diff --name-only HEAD -- . ':!compose.misto.yaml')
[[ -z "$changes" ]] || { echo "Existem alterações locais ao código. Rever antes de instalar:"; printf '%s\n' "$changes"; exit 1; }
sudo -v
compose=(sudo docker compose -p oficinaos-misto --env-file .env.misto -f compose.misto.yaml)
db=oficinaos-misto-db-1
app=oficinaos-misto-app-1
stamp=$(date +%Y%m%d-%H%M%S)
backup="/var/backups/oficinaos-misto/antes-v1.0.21-$stamp"
sudo docker inspect "$db" "$app" > /dev/null
sudo install -d -m 700 "$backup" "$backup/uploads"
echo "A guardar base de dados, anexos e configuração..."
sudo docker exec "$db" sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | sudo tee "$backup/database.dump" > /dev/null
sudo test -s "$backup/database.dump"
sudo bash -c 'docker exec -i "$1" pg_restore --list < "$2/database.dump" > /dev/null' bash "$db" "$backup"
sudo docker cp "$app:/app/uploads/." "$backup/uploads/"
for file in compose.misto.yaml .env.misto .env Dockerfile.node; do
  if [[ -f "$file" ]]; then sudo cp -- "$file" "$backup/$file"; fi
done
sudo docker inspect "$app" --format '{{.Image}}' | sudo tee "$backup/previous-image.txt" > /dev/null
sudo chmod -R go-rwx "$backup"
echo "Backup criado e índice do dump verificado: $backup"
echo "A construir a aplicação. O serviço atual continua disponível durante a construção."
"${compose[@]}" build app
"${compose[@]}" up -d --no-deps app
echo "A aguardar o arranque e as migrações..."
for attempt in {1..30}; do
  if sudo docker exec "$app" node -e 'fetch("http://127.0.0.1:4000/health",{signal:AbortSignal.timeout(3000)}).then(r=>r.ok?r.json():Promise.reject()).then(d=>process.exit(d.status==="ok"?0:1)).catch(()=>process.exit(1))' > /dev/null 2>&1; then
    echo "Atualização concluída: health OK. Atualize o navegador com Ctrl+F5."
    exit 0
  fi
  sleep 2
done
echo "O arranque não foi confirmado. Backup disponível em: $backup"
"${compose[@]}" logs --tail=60 app
exit 1
