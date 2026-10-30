# Inovito JARVIS — fase 3: tarefas e passagem para IA

Esta evolução depende dos ramos de teste das fases 1 e 2. Não é uma publicação.

## Comandos implementados

- **«Quantas tarefas pendentes tenho?»**: consulta `GET /api/tasks?completed=false` da sessão autenticada, sujeito a permissões do próprio backend e ao filtro de tipos de processos. O texto lido inclui apenas o número de tarefas visíveis ao utilizador. O endpoint devolve **até 100 registos por página**; com `nextCursor` a resposta diz «pelo menos N», nunca um total inventado.
- **«Pergunta ao assistente como diagnosticar um iPhone»**: abre o módulo de IA preexistente e mostra uma **pergunta preparada**. O utilizador escolhe «Usar no campo» e tem de clicar «Enviar» conscientemente. O Inovito **não chama automaticamente** o endpoint de geração de IA, não faz operações e não expõe a pergunta em parâmetros do URL.
- Podem ser ditos com microfone no modo manual (botão «Falar») ou escritos na caixa do Inovito.
- Os comandos anteriores (navegação e resumo agregado da loja) continuam disponíveis.

## Privacidade e segurança

- As tarefas só são consultadas depois de validar `jobs:view` e com sessão autenticada. A API aplica ainda filtragem por workflow, incluindo as permissões de acesso. O Inovito nunca fala títulos ou dados de tarefas, clientes, fornecedores, técnicos, telefones nem importâncias.
- As perguntas preparadas passam por estado de navegação efémero, são limitadas a 500 caracteres e removidas do histórico do router assim que são recebidas pelo chat. Não há envio à IA antes de confirmação pelo utilizador. Os dados da pergunta aparecem no ecrã para revisão; não usar com informação pessoal de clientes em ecrãs públicos.
- Cancelamento das consultas de leitura pendentes quando a pessoa desliga o assistente ou fecha o módulo. Sem endpoints novos nem migrações.
- `VITE_INOVITO_VOICE_ENABLED=true` continua a ser **apenas uma flag de compilação para testes**.
- A ativação de voz por navegador continua experimental, podendo o modo manual usar um serviço externo; o modo contínuo só é permitido depois de confirmação de reconhecimento local em pt-PT. Continua sem existir um motor dedicado de deteção de «Inovito».

## Verificações

Executar `bun run check`, `bun run typecheck`, `bun run test -- src/lib/__tests__/inovito-intents.test.ts` e `VITE_INOVITO_VOICE_ENABLED=true bun run build`.

Validar manualmente em ambiente privado de testes:
1. utilizador proprietário, técnico e perfil sem acesso à IA;
2. resposta «pelo menos» com 100 tarefas e `nextCursor`;
3. navegação para o chat com pergunta preparada, possibilidade de descartar e ausência de chamadas à IA antes do envio;
4. terminar sessão ou desligar com consulta pendente; rever cancelamento;
5. navegadores sem suporte de reconhecimento local;
6. verificar que não há impacto nos serviços Asterisk/VoIP.

## Dependências externas

Não publicar sem resolver o alerta crítico de `better-auth` identificado na auditoria do repositório e sem validar o microfone num computador real. Os PRs da fase 1 e 2 continuam independentes e por integrar. Não aplicar atualização de dependências sem testes de autenticação, backups e rollback.
