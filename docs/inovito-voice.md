# Inovito Voice — Integração Telefónica com OficinaOS (MVP)

Estado: **desenvolvimento em ramo de funcionalidade**, NÃO ligado ao número real da loja.

## Decisão de negócio (18/10/2026)

- Número principal: **telemóvel Amigo**; manter o número e SIM.
- O proprietário atende normalmente.
- Se a chamada tocar **30 segundos sem resposta**, a operadora desvia para um número DID/VoIP que será adquirido para o Inovito, **só se a Amigo suportar esta função**.
- O Inovito responde em português de Portugal e identifica-se como assistente virtual.
- As chamadas comerciais tratadas pelo Inovito devem criar um registo no OficinaOS, com hora, número, estado, duração, resumo e ligação futura a cliente, reparação, encomenda e ticket.
- Lista de números pessoais excluídos: o gateway tem de consultar o OficinaOS **antes de iniciar a IA**. Uma exclusão não impede necessariamente a operadora de desviar a chamada; no gateway encaminhar para voicemail separado / destino seguro, sem recolher dados da conversa. Números ocultos: negar IA por defeito.
- O site inove.pt e a app Inovito Phone devem reutilizar o mesmo núcleo de IA através de APIs autorizadas, **não** partilhar diretamente credenciais ou disponibilizar operações internas sem autenticação.

## Bloqueio de telefonia a confirmar com Amigo
A Vodafone é a prestadora do serviço Amigo, mas não há confirmação pública suficiente de que o tarifário **Amigo** permite o desvio **por não resposta** ao fim de 30 segundos. Ligar para **923 17 17 17** (suporte Amigo); perguntar:
1. Este SIM/tarifário permite reencaminhar apenas chamadas não atendidas após 30 segundos para um número fixo/VoIP português?
2. É possível configurar isso por código GSM **61** (e qual a sintaxe), ou só através do apoio?
3. Qual o custo da chamada reencaminhada? Conta para os minutos incluídos? E em roaming?
4. É preservado o **número original de quem ligou** no destino?
5. O correio de voz pode ser substituído apenas nesse cenário, mantendo os restantes desvios inalterados?
6. Como desativar apenas o reencaminhamento por não resposta?

**Não ativar qualquer desvio nem cancelar correio de voz sem conhecer o destino, custos e mecanismo de reversão.**

## Segurança e arquitetura
1. Operadora Amigo → reencaminhamento condicional → DID VoIP → SIP/RTP gateway público → voice stream Gemini Live → consulta autenticada ao backend OficinaOS (nunca expor porta LAN 4000 diretamente).
2. Serviço remoto deve ter HTTPS/mTLS ou VPN/túnel privado para as APIs do OficinaOS.
3. Chamadas autenticadas pelo gateway usando segredo longo por header e TLS, com rotação e limites de débito; não enviar tokens ao browser.
4. Primeiro pedido por chamada: decisão em tempo real (número está excluído?). Nenhuma gravação/transcrição ou registo comercial para os excluídos. Tratar com prudência Caller ID oculto/ausente.
5. Eventos idempotentes pelo ID da chamada; atualizações de estado recebidas com segurança. Resumo de chamada armazenado sem dados desnecessários; áudio e transcrições DESATIVADOS por defeito.
6. Associar a cliente/reparação depois de comprovar a identidade e restringir permissões por canal, especialmente informações de reparações.
7. Medidas contra fraude: evitar loops de transferência, ações de venda e alteração de estado sob IA sem confirmação, filtragem de conteúdos não confiáveis, auditoria, custos por chamada e corte de duração.
8. Política RGPD e informação clara ao cliente que fala com IA. Avaliar a base legal, prazos de retenção e eventual consentimento para gravações.

## Fases
1. Contrato de eventos e lista de exclusão + persistência no OficinaOS (ramo feature).
2. Interface `Comunicações > Chamadas` e avisos.
3. Gateway SIP/VoIP + voz em tempo real (número de teste).
4. Integração completa com site inove.pt e dados da loja.
5. Testes de 30 s e de chamadas pessoais, falhas e privacidade; só depois ativação no número Amigo real.

## Aceitação do MVP de OficinaOS
- Um POST autenticado consulta a lista de exclusão e devolve allowAI true/false, sem armazenar chamadas pessoais.
- Um POST autenticado grava/atualiza uma chamada comercial, idempotente por ID externo.
- Os registos são visíveis apenas a utilizadores autenticados com permissão apropriada.
- O responsável pode gerir a lista de números excluídos.
- Não existe ativação remota nem desvio do SIM neste ramo.

## Contrato de API implementado neste ramo

> NÃO configurar o gateway fora de ambiente de testes. O serviço responde 503 se INOVITO_VOICE_TOKEN não estiver definido. Os pedidos externos exigem HTTPS e header `x-inovito-voice-token` com o segredo configurado (pelo menos 40 caracteres aleatórios).

- `POST /api/inovito-voice/gateway/decision`
  `{"callerPhone":"+351912345678"}` → `{"allowAI":true,"reason":"allowed"}` ou `{"allowAI":false,"reason":"excluded"}`. Número oculto/inválido → `allowAI:false`. **O gateway é responsável por respeitar isto ANTES de enviar áudio à IA.**
- `POST /api/inovito-voice/gateway/event`
  `{"providerCallId":"test-001","callerPhone":"+351912345678","status":"completed","durationSeconds":55,"summary":"Pedido de informação sobre reparação"}`.
  Estados: `ringing`, `answered`, `completed`, `failed`. ID único por chamada; eventos repetidos não criam novas linhas e eventos de ordem inferior não fazem regressar um estado terminal para `ringing`.
- `GET /api/inovito-voice/calls` — utilizador autenticado com `customers:view`.
- `PATCH /api/inovito-voice/calls/:id/customer` — atribuição manual de cliente validado; utilizador com `customers:edit`.
- `GET /api/inovito-voice/exclusions` — `settings:view`.
- `POST /api/inovito-voice/exclusions` — `{"phone":"+351912345678"}`, `settings:edit`, remove também registos anteriores desse número.
- `DELETE /api/inovito-voice/exclusions/:id` — `settings:edit`.

A página `/inovito-voice` permite consultar o histórico e gerir números excluídos. Apenas dados comerciais processados pelo gateway devem ser enviados para eventos.

## Testes ainda obrigatórios antes de produção

- `bun run db:generate` e `bun run db:migrate-deploy` na instalação de TESTES, com backup.
- `bun run typecheck`, `bun run check` e `bun run test`. **Ainda não executados neste ramo**; requer ambiente Bun e instalação das dependências.
- Teste manual de 30 segundos em número de TESTES e Caller ID real/oculto.
- Teste de privacidade: número excluído nunca deve receber IA nem ser guardado, mesmo com webhook repetido.
- Teste de separação de funções (técnico, atendimento, proprietário).
- Testes de interrupção de áudio, transferência para humano, falhas de conectividade, consumo de API e limites de duração.
