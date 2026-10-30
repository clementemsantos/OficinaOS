# Inovito JARVIS — consultas seguras (fase 2)

Este ramo parte do piloto de voz `inove/inovito-jarvis-voz-mvp`, ainda experimental.

## Implementado

- **Modo por defeito «Falar»**: só pede reconhecimento ao clicar no botão. Não ativa escuta contínua ao carregar a página.
- **Modo de palavra de ativação «Inovito» (experimental)**: opção separada, desligada por defeito. O reconhecimento depende do navegador e pode encaminhar áudio para um serviço externo mesmo antes de ouvir «Inovito»; não usar em presença de clientes.
- **Entrada por texto**: permite testar comandos sem microfone ou navegador compatível; não guarda histórico.
- **Consulta do resumo da loja** para proprietários: pedidos como «Dá-me um resumo da loja» utilizam o endpoint de leitura existente `GET /api/dashboard/owner` (autenticado e sujeito a permissões). A resposta usa **apenas números agregados**, sem nomes, telefones, moradas ou dados financeiros.
- **Contagens fundamentadas**: serviços ativos e concluídos hoje vêm dos respetivos campos do painel; atrasos e recolhas são apenas os itens das listas consultadas, que podem estar limitadas no backend.
- Sem alterações na base de dados, nos acessos ao Asterisk ou nas rotas do servidor. Sem comandos de escrita.

## Testes exigidos

- `bun run check`
- `bun run typecheck`
- `bun run test -- src/lib/__tests__/inovito-voice-commands.test.ts src/lib/__tests__/inovito-owner-summary.test.ts`
- `VITE_INOVITO_VOICE_ENABLED=true bun run build`
- Testar manualmente no navegador: fala com microfone, permissão negada, áudio indisponível, interrupção do separador, fim de sessão, utilizador sem permissão, resposta sem dados de clientes.

O projeto **não foi instalado na produção**. Não ativar o módulo no atendimento ao público; a escuta local/offline da palavra «Inovito» ainda não foi implementada. Um modelo de detetor local auditado e consentimento adequado são necessários antes de avançar para funcionamento permanente.

## Rollback

Retirar `VITE_INOVITO_VOICE_ENABLED=true` do ambiente da compilação e reconstruir a instalação de testes, ou regressar ao ramo anterior. Não existem migrações de dados associadas a esta fase.
