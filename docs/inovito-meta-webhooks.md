# Inovito — WhatsApp e Messenger oficiais (fase 5, testes)

Este ramo depende das fases 1–4. **Não foi colocado em produção.**

## O que foi implementado

- Um único callback HTTPS a usar no Meta Developers: `https://DOMINIO-DE-TESTES/api/public/inovito-meta/webhook`.
- GET de verificação `hub.mode=subscribe` com token seguro de comparação constante. POST com validação obrigatória do cabeçalho `X-Hub-Signature-256` sobre os **bytes exatos do JSON recebido**.
- Captura opcional, desligada por defeito, de **mensagens de texto de entrada** na tabela `business_messages` já existente no OficinaOS, canais `WHATSAPP` e `MESSENGER`. As mensagens surgem na área de Mensagens.
- Apenas mensagens do **WhatsApp Business Phone Number ID** e da **Página do Facebook Page ID** configurados são aceites. Outros números, outras páginas, eco de mensagens enviadas, eventos de estado, imagens, vídeos e chamadas são ignorados.
- Deduplicação por `(channel, externalId)`; não há resposta automática, IA, campanhas, marketing ou envio aos clientes.
- Bloqueio de captura em `DEMO_MODE` e `OFICINAOS_SANDBOX`. Limite de tamanho de 256 KiB por POST, limite de 50 mensagens por entrega e de 4 000 caracteres por mensagem.

## Segredos necessários (apenas no servidor)

Configurar **em ambiente de testes isolado e HTTPS**:

```dotenv
INOVITO_META_WEBHOOK_ENABLED=false
INOVITO_META_CAPTURE_ENABLED=false
INOVITO_META_APP_SECRET=
INOVITO_META_VERIFY_TOKEN=
INOVITO_META_WA_PHONE_NUMBER_ID=
INOVITO_META_PAGE_ID=
```

**Nunca adicionar valores reais a ficheiros do GitHub, screenshot, logs nem mensagens de chat.**

1. Criar ou escolher uma aplicação empresarial no Meta Developers e configurar o produto WhatsApp Business Platform (Cloud API) e/ou Messenger para a Página.
2. Verificar propriedade e permissões do número e da Página. Configurar no Meta Developers o callback HTTPS acima e o verify token. O `INOVITO_META_APP_SECRET` é o *App Secret* da aplicação Meta.
3. Com `INOVITO_META_WEBHOOK_ENABLED=true`, validar a subscrição e confirmar nos logs apenas o estado HTTP (sem conteúdos pessoais). **A captura continua desligada.**
4. Fazer um teste controlado com mensagens fictícias e rever a política de privacidade, prazos de retenção e acesso às mensagens. Só depois ativar `INOVITO_META_CAPTURE_ENABLED=true`, exclusivamente numa instalação não-demo e não-sandbox.
5. Rever na área Mensagens se o WhatsApp e o Messenger apareceram com `deliveryStatus=CAPTURED` e se a repetição do mesmo webhook não duplicou a mensagem.

## Segurança e limites

- Se o Meta não enviar assinatura válida, responder 401 sem gravar. Pedido desconhecido ou não configurado nunca cria mensagem.
- O GET de verificação não concede permissão de escrita. Não existem tokens Meta de envio nem chamadas à Graph API nesta fase.
- A ligação automática não funciona sem configurar e autorizar a API oficial Meta. O webhook **não permite** ler o histórico anterior nem aceder a conversas pessoais do WhatsApp.
- A identificação do remetente e o texto de mensagens são dados pessoais. Requer base legal adequada, informação aos clientes, retenção e acesso mínimo. A gravação deve permanecer desativada até estas condições estarem verificadas.
- Se o proprietário desligar captura, não se apagam mensagens já guardadas; fazê-lo exige procedimento de retenção conforme a política de privacidade.
- Se o webhook falhar, não ativar respostas automáticas como alternativa. Desativar as duas flags e remover a subscrição Meta para rollback operacional.
- Antes de publicação do conjunto das fases, resolver o alerta de dependência `better-auth`, validar o HTTPS móvel, cookies, sessão e Google OAuth, testar autenticação Meta em ambiente isolado e passar na auditoria CI.

## Testes

`bun run typecheck`

`bun run test -- server/__tests__/inovito-meta.test.ts`

`VITE_INOVITO_VOICE_ENABLED=true bun run build`

`bun run check`

Os testes de assinatura e parsing **não substituem** um ensaio com Meta Developers e uma conta empresarial real.
