# OficinaOS Inove.pt — release candidate (base original + melhorias da oficina)

## Âmbito da versão candidata
- Base original OficinaOS **v1.0.14** da branch main.
- Compatibilidade com Node.js 22 e Docker usada pela instalação Inove (`inove/node-compat`).
- Funcionalidades desenvolvidas no ramo `inove/workshop-workflow`: tarefas transversais, estados de trabalho configuráveis, tickets de suporte, histórico manual de mensagens, encomendas a fornecedores, margens com IVA e gestão comercial.
- NÃO inclui o módulo **Inovito Voice** (continua isolado no PR #3, sem atendimento real).

Esta branch é uma **candidata de integração**, não uma versão aprovada para produção.
As funções já aceites pelo proprietário e as ainda pendentes de validação devem ser distinguidas no teste de aceitação antes da promoção.

## Plano para uso na loja (sem perda de dados)

1. Inventariar o servidor existente ANTES de qualquer deploy: containers, portas, imagens, volumes, `.env`, versão do código, backups e bases de dados das instâncias **4000 (principal)** e **4001 (testes)**. Não assumir que correspondem a ramos de código específicos.
2. Fazer **backup completo verificado**, incluindo PostgreSQL e ficheiros anexados. Guardar cópia externa ao servidor e testar restauração em base de dados isolada.
3. Construir a release candidate numa **terceira instância temporária**, com portas/volumes/BD próprios. Não apontar para `DATABASE_URL` existente de 4000/4001. Aplicar migrações apenas à base temporária.
4. Testes de aceitação reais, com dados fictícios ou cópia anonimizada: criar cliente, registar reparação, importar dados, gerir stock, criar tarefa, gerar orçamento, receber produto, concluir/entregar e exportar relatório. Confirmar permissões e histórico. Testar fluxos de ticket, mensagens manuais e compras.
5. Analisar requisitos ainda incompletos e desativar ou impedir o acesso a funcionalidades não validadas, quando tecnicamente necessário.
6. Só após aceitação, programar janela de mudança: parar escritas, fazer backup final, migrar dados para a versão nova, verificar contagens e anexos, configurar DNS/endereços e iniciar. Guardar rollback da base e da imagem anterior.
7. Durante transição, usar apenas **uma base de dados como fonte de verdade** para clientes/reparações. Evitar introduzir registos reais nas versões 4000 e 4001 em paralelo: isso gera divergências impossíveis de resolver com um simples merge Git.
8. Após estabilização, **produção** para loja, **testes** para experiências, **Inovito Voice** isolado até funcionar em chamada real com fallback.

## Verificações obrigatórias

- `bun install --frozen-lockfile`, `bun run db:generate`, `bun run check`,
  `bun run check-primitives`, `bun run typecheck`, `bun run test`,
  `bun run build`.
- Migrations apenas na base temporária, com backup/restauro efetivo.
- Riscos especiais: integrações fiscais/AT/Wintouch/ERP (não presumir que foram migradas), importações de Keymaster, WhatsApp e dados de clientes, emails/SMS automatizados, permissões de acesso e RGPD.
- Garantir caminho de rollback: **reverter aplicação e base de dados em conjunto**; uma migração pode não admitir downgrade automático.
- Sem código do Inovito Voice em produção nesta fase.

## Decisões que devem ser confirmadas no servidor
- Código/comando efetivo das instâncias 4000 e 4001, sua configuração do Docker e estado das bases de dados.
- Que funcionalidades foram aprovadas pelo proprietário na versão de testes (não equiparar existência no GitHub a aprovação).
- Se já há dados reais na versão 4001, precisam de ser exportados/reconciliados antes de escolher BD principal.
