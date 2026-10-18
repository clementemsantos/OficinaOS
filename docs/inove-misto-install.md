# OficinaOS misto — porta 4002 no Tailscale (teste isolado)

Este procedimento assume instalações originais **4000** e **4001** ativas.
O código está no ramo `inove/release-candidate`, pasta
`/home/clemente/OficinaOS-misto`, descarregada por `git clone`.

**Não** copiar `.env` de produção ou da versão de testes. **Não** executar
`docker compose up` sem `--project-name oficinaos-misto` e
`-f compose.misto.yaml`. **Não** usar `docker compose down -v`.

## 1. Criar credenciais e validar configuração (não inicia aplicação)
```bash
cd ~/OficinaOS-misto
bash scripts/setup-misto-env.sh
sudo docker compose --project-name oficinaos-misto --env-file .env.misto \
  -f compose.misto.yaml config --quiet
```

- Segredos são gerados em `.env.misto` com permissões 600 e ignorados pelo Git.
- Porta 4002 apenas no IP Tailscale do Ubuntu.
- PostgreSQL 16 apenas na rede interna Docker, sem porta publicada.
- Volumes próprios com prefixo `oficinaos-misto_` (`misto-pgdata`, `misto-uploads`).
- Não inicia Evolution API, Cloudflare, nem serviços de backup da produção.

## 2. Iniciar **só a base de dados** da nova instância

```bash
sudo docker compose --project-name oficinaos-misto --env-file .env.misto \
  -f compose.misto.yaml up -d db
sudo docker compose --project-name oficinaos-misto --env-file .env.misto \
  -f compose.misto.yaml ps
```

## 3. Gerar snapshot portátil da **base de testes** (origem, só leitura)

Usar `pg_dump -Fc` (formato custom). O backup anterior feito com
`pg_dumpall` mantém-se intacto e é uma cópia de salvaguarda adicional.
Guardar o arquivo fora do repositório e não publicar no GitHub:

```bash
sudo bash -c '
set -Eeuo pipefail
DEST=/home/clemente/backups-oficinaos/pre-mista-20261018-145403
docker exec oficinaos-teste-db-1 sh -c '\''exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"'\'' > "$DEST/testes-portavel.dump"
test -s "$DEST/testes-portavel.dump"
docker exec -i oficinaos-teste-db-1 pg_restore -l < "$DEST/testes-portavel.dump" >/dev/null
sha256sum "$DEST/testes-portavel.dump" > "$DEST/testes-portavel.dump.sha256"
'
```

O `pg_dump` produz snapshot consistente; não altera o conteúdo na origem.

## 4. Restaurar na **terceira base**, ainda com a aplicação parada

**ATENÇÃO:** este comando apenas pode ser executado após confirmar a identidade
do contentor `oficinaos-misto-db-1`. O `--clean` elimina objetos apenas
da **nova** base. NUNCA executar em `oficinaos-db-1` ou
`oficinaos-teste-db-1`.

```bash
TARGET=oficinaos-misto-db-1
PROJECT="$(sudo docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$TARGET")"
test "$PROJECT" = oficinaos-misto || { echo "Projeto incorreto!"; exit 1; }
sudo bash -c '
set -Eeuo pipefail
D=/home/clemente/backups-oficinaos/pre-mista-20261018-145403
cat "$D/testes-portavel.dump" | docker exec -i oficinaos-misto-db-1 sh -c '\''exec pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"'\''
'
```

Após restauro, validar contagens e migrações. Ainda **não** iniciar a aplicação
sem verificar o resultado do restauro e confirmar que o modo sandbox funciona.

## 5. Aplicação (somente após validação)
```bash
sudo docker compose --project-name oficinaos-misto --env-file .env.misto \
  -f compose.misto.yaml up -d --build app
```

O modo `OFICINAOS_SANDBOX=true` desliga o worker de notificações,
remarketing, Cloud poller, tarefas automáticas e rotinas de limpeza.
**Não** substitui firewall nem impede que um utilizador envie manualmente
comunicações por integrações configuradas.

Verificar `sudo docker compose ... ps` e `curl http://IP_TAILSCALE:4002/health`.
As migrações, se existirem, são executadas **apenas na base da porta 4002**.

## Notas sobre restauração e segurança

- Os `.sql.gz` iniciais passaram checksums/gzip, **mas não foram testados
  com um restauro**. O novo `.dump` serve para restaurar apenas a BD da app,
  sem recriar roles e bases globais do servidor de origem.
- Na cópia restaurada, nomes/telefones são dados reais. A instância só deve
  ser acessível à equipa autorizada no Tailscale. Preferir anonimizar para QA.
- Como a origem de testes já tem migrações personalizadas, é adequada para
  aferir tarefas e tickets; qualquer histórico exclusivo da original precisa
  de avaliação/migração distinta. **Não juntar tabelas das duas bases por SQL
  sem reconciliação de IDs e relações.**
- Guardar cópia **fora do servidor** e testar restauro antes de substituir
  qualquer base real. Usar uma única BD de produção para evitar divergências.
