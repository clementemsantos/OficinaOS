# Inovito JARVIS — telemóvel e ligações de comunicação (Fase 4, testes)

## O que já existe no OficinaOS

O OficinaOS tem uma **PWA instalável** (`public/manifest.webmanifest` e `public/sw.js`), layout móvel e um projeto Capacitor Android. Não é necessário criar outra aplicação ou abrir portas no router. A nova página do proprietário é `/inovito`; o atalho da PWA aponta para essa página. O serviço worker **não guarda respostas de API**, incluindo mensagens e tokens.

O Inovito de voz permanece experimental e opt-in: `VITE_INOVITO_VOICE_ENABLED=true` só no build de teste.

## Entregue neste PR

- Painel móvel com atalhos de sessão protegida para o chat IA, tarefas, histórico de mensagens do OficinaOS e aplicações oficiais.
- Estado de importação IMAP da loja; aproveita a integração `EMAIL` já existente (a configurar no OficinaOS, não se deve enviar credenciais por chat).
- **Ligação opcional Google OAuth 2.0** para o proprietário, com `state` assinado e limitado à sessão e a 10 minutos; PKCE S256, credenciais cifradas (AES-GCM, chave de servidor existente), tokens fora do frontend e âmbito limitado:
  - `calendar.events.readonly`: mostrar próximos 8 eventos do calendário principal;
  - `tasks.readonly`: mostrar até 8 tarefas da primeira lista acessível;
  - `gmail.metadata`: estimativa de correio não lido pela etiqueta UNREAD, sem ler corpo do e-mail.
- Botão de desligar ligação Google no OficinaOS. Não revoga permissões na conta Google; isso faz-se em «Acesso de terceiros» na conta Google.
- Sem envio de mensagens, sem alterações na conta Google, sem receção automática de WhatsApp ou Messenger.
- **WhatsApp Business e Messenger**: apenas atalhos para as respetivas aplicações e indicação «por configurar». O funcionamento integrado será uma fase própria com OAuth Meta, permissões para página/conta empresarial, webhooks validados e envio sujeito a consentimento e às janelas de mensagens permitidas.

## Configurar OAuth Google no servidor de testes

1. Ter um hostname **HTTPS** exclusivo para o ambiente de testes do OficinaOS (idealmente via Cloudflare Tunnel ou proxy HTTPS), sem exposição do PostgreSQL e sem partilhar a sessão de produção. `APP_URL` e `API_URL` devem resolver para esse mesmo hostname para manter as cookies de sessão na redireção OAuth.
2. Na Google Cloud Console, criar/selecionar projeto, ativar **Google Calendar API**, **Google Tasks API** e **Gmail API**; configurar ecrã de consentimento OAuth, conta de teste e cliente OAuth de tipo **Web application**.
3. Adicionar o URI de redireção exato: `https://SEU-DOMINIO-TESTE/api/inovito/google/callback`.
4. Configurar no ambiente do processo **apenas no servidor** (nunca em `VITE_*` ou no repositório):
   - `INOVITO_GOOGLE_CLIENT_ID=` (ID do cliente OAuth)
   - `INOVITO_GOOGLE_CLIENT_SECRET=` (segredo OAuth)
   - `APP_URL=https://SEU-DOMINIO-TESTE`
   - `API_URL=https://SEU-DOMINIO-TESTE`
5. Garantir backup da base de dados de testes e executar as migrações. A nova tabela `inovito_google_connections` tem chave primária por utilizador e só armazena tokens cifrados.
6. Autenticar com o proprietário, abrir `/inovito` e clicar «Ligar conta Google». Confirmar no consentimento as **três permissões de leitura**. O resultado regressa ao painel, sem expor códigos e tokens no URL permanente.
7. Se o projeto Google estiver em modo Testing, os refresh tokens podem expirar ao fim de 7 dias; configurar a publicação e verificação do ecrã de consentimento segundo as regras Google, sem ampliar as permissões.

A integração Gmail usa o escopo `gmail.metadata`, que dá acesso a metadados e pode implicar verificação de aplicações. A contagem `resultSizeEstimate` é aproximada; não corresponde necessariamente ao total exato. O código não sincroniza mensagens pessoais para o CRM.

## Testes de segurança

- `bun run db:generate`
- `bun run typecheck`
- `bun run test -- server/__tests__/inovito-google-oauth.test.ts`
- `bun run build`
- `bun run check`
- Testar **login/callback com cookies SameSite**, sessão errada/expirada, assinatura adulterada, consentimento negado, reconexão, refresh token expirado/revogado, conta sem papel OWNER, falha de rede, desconexão, reinstalação PWA, iOS e Android, e remediar o alerta de autenticação do CI antes do lançamento.

## WhatsApp e Facebook Messenger — requisitos para a integração futura

**WhatsApp oficial (Meta Cloud API):** portefólio empresarial Meta, WhatsApp Business Account, número e acesso à Cloud API, permissões aprovada(s), webhook HTTPS e validação criptográfica de mensagens recebidas; usar regras de consentimento e modelos/janelas de conversação. Não utilizar automações WhatsApp Web não oficiais na conta principal.

**Messenger (Meta):** página Facebook com permissões adequadas, aplicação Meta e `pages_messaging`, Page access token armazenado cifrado, webhooks HTTPS assinados, verificação das janelas de resposta e eventual App Review. O perfil/página do proprietário continua sob controlo da Meta, sem acesso automático a contas pessoais.

## Como instalar no telemóvel

- Abrir o endereço de testes em **HTTPS**, autenticar e ir a `/inovito`.
- Android/Chrome: «Instalar aplicação» ou «Adicionar ao ecrã principal». Selecionar o atalho «Inovito JARVIS» quando o sistema operativo permitir atalhos da PWA.
- iPhone/Safari: Partilhar > «Adicionar ao ecrã principal». O áudio e a escuta em segundo plano têm limitações do Safari; não prometer funcionamento tipo Alexa com o ecrã bloqueado.

## Produção, rollback e limites

**NÃO foi feito deployment, merge ou qualquer ligação real às contas.** São necessários credenciais, testes num telemóvel real e validação completa. O PR tem como base as fases 1–3 em rascunho. Não publicar até resolver o alerta crítico `better-auth` e a regra de componentes de formulário que falha no CI geral.

Rollback do código: não ativar a branch, ou voltar ao commit anterior. A migração cria uma única tabela independente; em testes, a tabela pode ser removida **após** confirmar backup e revogar conexões. Não alterar nem apagar tabelas de reparações/clientes. Nunca fazer rollback com perda de dados sem cópia verificada.
