# Atualizar o Misto para a base original v1.0.21

Integração da release original `f5132469e53b17cf3457181ec2f93893698b6325` (v1.0.21), mantendo as alterações da Inove. O aviso após instalar v1.0.18 corresponde a versões originais posteriores, não a falha no health check.

## Instalação na loja

Na sessão SSH do servidor, uma linha de cada vez:

```sh
cd ~/OficinaOS-misto
```

```sh
git pull --ff-only origin inove/release-candidate
```

```sh
bash scripts/update-misto.sh
```

O script pede sudo, recusa alterações locais ao código (permite o `compose.misto.yaml` local), guarda DB/anexos/configuração em `/var/backups/oficinaos-misto/antes-v1.0.21-<data-hora>`, verifica o índice do dump, constrói apenas a aplicação Misto e confirma `/health` dentro do contentor. A legibilidade do índice não prova uma recuperação completa. Executar numa janela sem alterações para maior consistência entre os anexos e a base.

Não usa `down -v`, não apaga volumes e não altera os projetos das portas 4000/4001. A cópia local não é uma cópia externa. As configurações de rede da loja são mantidas.

## Alterações visíveis

- Base v1.0.21, incluindo melhorias originais de impressão de alto contraste, formulários e validações.
- Menu Gestão da loja: clientes sem atividade recente, reposição (previsão existente) e prazos de garantia por serviço.
- Encomendas imediatamente a seguir às reparações no grupo Operação.
- Mantidos CRM, tarefas, documentos, RMA, Atlas, encomendas e pagamentos da Inove.
- Integrações e mensagens continuam desligadas no sandbox Misto salvo a opção explícita de polling de integrações. A demo pública original tem os seus bloqueios próprios.

O novo campo original `printerHighContrast` entra em `20261120000000_printer_high_contrast`, depois das migrações próprias já existentes. Nenhuma migração aplicada anteriormente foi editada. Não altera automaticamente as definições da impressora.

Após health OK: Ctrl+F5, abrir uma encomenda, verificar inserção de peça, abrir Gestão da loja e testar filtros. Confirmar os prazos com os documentos reais antes de os usar no atendimento: esta consulta utiliza a configuração atual de garantia e a primeira entrega registada, não um snapshot de condições antigas.

## Validação de desenvolvimento

Bun 1.4.4, instalação frozen-lockfile, geração Prisma, lint, typecheck e build. Testes de rotas/interface, permissões, filtros e instalador. As 96 migrações foram também executadas numa base PostgreSQL embebida (PGlite), com consultas reais dos novos relatórios e dados fictícios. Isto não substitui a validação no Postgres 16 da loja.

A suite geral encontra uma restrição conhecida do ambiente de desenvolvimento em mDNS (`uv_interface_addresses`); não se alterou a descoberta de rede da loja para contornar essa restrição.

Ver `revolio-coverage.md` para as funcionalidades comparadas e o que continua pendente. Esta entrega não implementa a totalidade do Revolio nem configura contas Stripe/Moloni/Meta ou backups externos.
