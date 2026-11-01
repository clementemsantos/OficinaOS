# Instância Inovito isolada para testar WooCommerce — porta 4003

**Objetivo:** testar `inove.pt` ↔ OficinaOS em `OficinaOS-inovito-stage` sem mudar as instâncias existentes: original 4000, testes 4001, misto 4002. A aplicação, PostgreSQL e uploads usam projeto Docker e volumes independentes.

Esta instalação só deve ser feita numa máquina autorizada, com acesso Tailscale. **Os comandos abaixo são para executar no servidor; o PR não executa qualquer comando remotamente.** Nunca partilhar ficheiros `.env`, tokens ou chaves no chat/GitHub.

## 1. Confirmar pré-requisitos e acesso seguro

Antes de iniciar, confirmar Docker Compose, Git, OpenSSL, curl e Tailscale:

```sh
docker compose version
tailscale status
tailscale serve status
```

Usaremos a **porta HTTPS 8443**, apenas dentro da tailnet, para não substituir configurações existentes de Serve na porta 443. Se `tailscale serve status` já mostrar uma aplicação na porta 8443, **não executar o comando Serve abaixo**: será necessário escolher outro endpoint HTTPS e atualizar o URL da staging.

Descobrir o DNS do servidor (normalmente termina em `.ts.net`, incluindo o ponto final que removemos):

```sh
STAGE_HOST="$(tailscale status --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')"
printf 'Domínio Tailscale: %s\n' "$STAGE_HOST"
```

Tailscale Serve exige certificados HTTPS ativados na tailnet e acesso permitido pela respetiva política ACL. Não usar `tailscale funnel` (público) para esta staging.

## 2. Clonar numa pasta separada

```sh
cd "$HOME"
git clone --single-branch --branch inove/inovito-staging-4003 \
  https://github.com/clementemsantos/OficinaOS.git OficinaOS-inovito-stage
cd OficinaOS-inovito-stage
bash scripts/setup-inovito-stage-env.sh "https://${STAGE_HOST}:8443"
```

O script gera um novo `.env.inovito-stage` (permissões 600) com credenciais aleatórias **exclusivas**. Não copia `.env`, `.env.misto`, bases de dados ou uploads anteriores. Se o ficheiro já existir, não o substitui.

## 3. Levantar a base própria e fazer backup antes do build

```sh
bash scripts/inovito-stage-start.sh
```

O script verifica o nome da pasta/ramo, confirma `docker compose config`, inicia a base independente e produz um `pg_dump` customizado com verificação `pg_restore --list` em `backups/inovito-stage`. Só depois compila e inicia **a aplicação deste projeto**, associada apenas a `127.0.0.1:4003`. Testa `/health`.

Não executar `docker compose down -v` — isso apagaria os volumes de staging. Não executar qualquer comando `docker compose` noutra pasta ou sem o projeto/ficheiro indicado.

## 4. Ativar HTTPS dentro da tailnet (após conferir o estado)

```sh
tailscale serve status
tailscale serve --bg --https=8443 http://127.0.0.1:4003
tailscale serve status
```

Abre `https://<STAGE_HOST>:8443` no computador/telemóvel **ligado ao mesmo Tailscale**. Não aceitar certificados inválidos. Se o domínio não abrir, não inserir credenciais.

A instalação é nova, com base vazia. Cria um utilizador OWNER de testes pelo setup. O token de criação está apenas no `.env.inovito-stage`; consulta-o **no terminal local**, nunca o publiques.

## 5. Só depois autorizar leitura privada WooCommerce

Depois de HTTPS, conta OWNER, autenticação e `/health` validados, ativar **duas** opções, mantendo `OFICINAOS_SANDBOX=true`:

```sh
sed -i \
  -e 's/^INOVITO_WOO_PRIVATE_ENABLED=false$/INOVITO_WOO_PRIVATE_ENABLED=true/' \
  -e 's/^INOVITO_STAGE_PRIVATE_READ=false$/INOVITO_STAGE_PRIVATE_READ=true/' \
  .env.inovito-stage
docker compose --project-name oficinaos-inovito-stage \
  --env-file .env.inovito-stage -f compose.inovito-stage.yaml \
  up -d --no-deps --force-recreate app
```

Abre `/inovito` → «Os meus sites» → `inove.pt`, confirma o estado, introduz as **Consumer Key e Consumer Secret Read** diretamente no formulário HTTPS da staging (não no chat), verifica as últimas encomendas e usa «Simular importação». Vai permitir consultar até cinco páginas de 25 registos e distinguir correspondências exatas, possíveis duplicados e pedidos sem registo. **Nenhum botão importa encomendas.**

O servidor continuará em modo sandbox, bloqueando envio de mensagens, polling de integrações, automatismos de tarefas e remarketing. A exceção é exclusivamente a leitura Woo com as duas opções e o marcador de staging. O modo de demonstração continua a bloquear tudo.

## 6. O que verificar e como parar

```sh
curl -fsS http://127.0.0.1:4003/health
docker compose --project-name oficinaos-inovito-stage \
  --env-file .env.inovito-stage -f compose.inovito-stage.yaml ps
```

Confirmar que `4000`, `4001` e `4002` continuam a funcionar. A auditoria de código inclui TypeScript, testes Woo, segurança, backup/restauro e compilação; falta ensaio end-to-end no teu servidor.

**Parar apenas a staging** (mantendo volumes e backups):

```sh
docker compose --project-name oficinaos-inovito-stage \
  --env-file .env.inovito-stage -f compose.inovito-stage.yaml stop app
```

Para retirar a rota Tailscale 8443 (não apagar outras rotas):

```sh
tailscale serve --https=8443 off
```

Se alguma migração causar problemas, não restaurar uma base por cima de outra; parar a app de staging, rever os backups de `backups/inovito-stage` e fazer rollback apenas do projeto `oficinaos-inovito-stage`.

## Limites e dados pessoais

- A ligação anterior do WooCommerce no site ou noutro OficinaOS **não prova** que esta nova staging tenha credenciais. O cofre é independente e inicia vazio.
- Os previews só devolvem ID, número, estado e total; não copiam dados de faturação dos clientes.
- Não copiar uma base de dados de produção para testar sem um plano formal de anonimização e backup.
- **Não ligar WhatsApp, Messenger, SMTP, VoIP nem importação automática** nesta staging.
- Esta fase não foi publicada nas tuas instâncias reais; os ficheiros apenas preparam uma instalação reversível e isolada.
