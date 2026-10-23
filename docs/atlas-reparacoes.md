# Atlas Técnico de Reparações — OficinaOS

## Objetivo

Biblioteca didática original, criada para consulta rápida por técnicos de reparação, em português de Portugal. O projeto é **independente** de qualquer atlas digital comercial; não reutiliza imagens nem texto do anúncio que inspirou a funcionalidade.

## Primeira versão (MVP)

- Entrada **Atlas de Reparações** no menu (lateral e no menu móvel).
- Rota autenticada `/atlas`, com autorização `jobs.view`.
- Pesquisa por avaria, sintoma, ferramenta, componente e palavra sem acentos.
- Filtros por tipo de equipamento.
- Guias com segurança, ferramentas, diagnóstico por etapas e checklist final.
- Diagramas didáticos originais para telemóveis e computadores; **não são boardviews**.
- Acesso contextual desde `/jobs/:id` (tipo de equipamento e ligação de regresso).
- Partilha de ligação `/atlas?guia=<id>` entre técnicos da **mesma instância**, mediante autenticação.
- Zero alterações ao esquema de base de dados, a encomendas, à faturação, às peças ou às reparações existentes.

## Limitações deliberadas

1. Nesta fase, o catálogo está versionado em `src/lib/repair-atlas.ts` e é **de leitura**. Não existe ainda editor de guias na interface nem sincronização entre lojas.
2. A checklist é temporária, não constitui prova de execução e **não é gravada** nas ordens de reparação. Os resultados de testes têm de ser registados no local próprio.
3. As ilustrações não representam circuitos, posições reais ou especificações de modelos concretos.
4. O conteúdo técnico é uma referência de triagem, não substitui documentação oficial, formação, práticas ESD ou procedimentos de segurança relativos a baterias de lítio.
5. O conteúdo interno não está exposto publicamente; a partilha só funciona para técnicos com conta e acesso.
6. O corpo dos guias desta primeira versão está em PT-PT. As etiquetas do menu foram adicionadas também em EN/ES/FR.

## Como atualizar a instância Linux existente

Depois de o PR ter sido revisto e integrado na branch usada pela instalação, fazer backup da base de dados e confirmar que o diretório de trabalho corresponde a esse repositório. Atualizar por Git e reconstruir o contentor:

```sh
git status
git pull --ff-only
docker compose up -d --build app
docker compose ps
docker compose logs --tail=80 app
```

**Não** correr `git reset --hard`, `docker compose down -v`, `prisma migrate reset` ou comandos destrutivos: podem perder alterações locais ou dados de clientes. Este módulo não exige migrações.

## Evolução proposta (após teste em bancada)

- Editor com aprovação, revisão e histórico por técnico.
- Fotografias/diagramas próprios com créditos, permissão e remoção.
- Associação explícita de checklist e notas a uma reparação, com registo de autor e data.
- Biblioteca opcional entre instalações OficinaOS, mediante publicação voluntária, moderação e proteção de dados.
- Guias por marca/modelo **apenas** com documentação licenciada ou autorizações válidas.
- Exportação controlada de guias didáticos para PDF.

## Aceitação manual

1. Entrar como utilizador com permissão para ver reparações.
2. Verificar `/atlas` no menu desktop e móvel.
3. Pesquisar `não carrega`, `ecrã preto` e `oxidação`.
4. Filtrar por Portáteis e verificar que só aparecem guias da categoria.
5. Abrir um guia; verificar fluxo, segurança e checklist.
6. Copiar ligação de partilha; abrir noutra sessão autenticada e verificar acesso.
7. Verificar que um navegador não autenticado é encaminhado para autenticação.
8. Abrir uma reparação; escolher **Atlas técnico**, confirmar filtro por equipamento e botão para regressar.
9. Confirmar que nenhum dado de cliente é incluído no link copiado.
