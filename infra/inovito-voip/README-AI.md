# Inovito AI — teste telefónico isolado na extensão 997

**Estado:** PoC por turnos, não é conversação de voz em tempo real nem está pronta para clientes.

O ramo é construído sobre `feature/inovito-voice-call-log` e não altera
o número Amigo, as portas locais, a extensão `999` (eco), nem a `998` (saudação).

## Requisitos

- O Asterisk de testes deve estar a funcionar no mesmo Docker Compose.
- `sounds/en/custom/inovito-boas-vindas.wav` deve existir e ouvir-se na extensão `998`.
- Precisas de uma chave de **Gemini API**, criada em [Google AI Studio](https://aistudio.google.com/apikey).
  Não partilhes a chave por chat ou no GitHub.
- O gateway precisa de acesso de saída à Internet para Gemini e Edge TTS.
- O serviço por turnos envia pequenos excertos de áudio para a API Gemini;
  usa somente a tua voz para testes, nunca chamadas reais de clientes.
- Confirma limites, condições de utilização, privacidade e eventuais custos antes de testar.

## Arranque

Dentro da pasta `infra/inovito-voip`, depois de obter estes ficheiros:

```bash
sudo bash start-ai.sh
```

O script faz backup do dialplan, pede a chave sem ecoar os caracteres,
cria `.env.ai` com permissão 600, acrescenta **apenas** a extensão `997`,
recria o Asterisk (interrompe chamadas de teste), prepara as permissões para
gravações transitórias e inicia o gateway privado.

**Segurança:** `.env.ai` está excluído do Git; o gateway não publica
portas. A configuração SIP/RTP existente **não é modificada**. Não ativar
trunks, desvios ou encaminhamento de chamadas da loja.

## Teste

1. Confirma que `998` ainda reproduz a saudação masculina.
2. Liga `997` a partir do mesmo cliente SIP usado na `998`.
3. Ouve a saudação; após o sinal, faz uma pergunta curta (ex.: "O que é um SSD?").
4. Após 2 s de silêncio (ou 18 s máximo), o serviço pede resposta ao Gemini,
   sintetiza-a na voz Duarte pt-PT e reproduz no Asterisk.
5. Experimenta até três perguntas por chamada. Há pausas de processamento.

Diagnóstico:
```bash
sudo docker compose -f compose.yml -f compose.ai.yml ps
sudo docker compose -f compose.yml -f compose.ai.yml logs --tail=50 voice-gateway
sudo docker exec inovito-asterisk-lab asterisk -rx 'dialplan show 997@inovito-lab'
```

O serviço não regista áudio nem transcrições no disco a longo prazo: apaga
os WAV temporários após cada turno. Exceções e estados são registados
sem informações do chamador. Os fornecedores externos podem tratar o
áudio recebido segundo os respetivos termos.

## Parar a IA sem parar o Asterisk

```bash
sudo docker compose -f compose.yml -f compose.ai.yml stop voice-gateway
```

## Rollback

Existe um backup `asterisk/extensions.conf.pre-ai.*.bak`. Não o restaures
se houver outras edições posteriores; podes simplesmente retirar as linhas
da extensão `997` do dialplan e executar `dialplan reload`.
Remove a sobreposição AI apenas quando não estiveres a usar a `997`.
A `998` e a `999` continuam a funcionar independentemente.

## Limitações e fases seguintes

- Esta versão usa FastAGI `RECORD FILE` e Gemini multimodal por **turnos**.
  Não permite interrupção imediata quando a IA está a falar.
- Para voz bidirecional com baixa latência, será necessário um gateway RTP/ARI
  e a Gemini Live API (PCM 16 kHz entrada e 24 kHz saída), com gestão de sessões.
- Não contém integração real com o OficinaOS nem transferência de chamadas.
- Antes de receber clientes é indispensável rever RGPD, consentimento/
  aviso de IA, segurança de rede LAN, API key, limites de custo, retenção,
  fallback, monitorização, autenticação e casos de indisponibilidade.
