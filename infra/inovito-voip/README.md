# Inovito Voice — Central Asterisk isolada (ambiente de testes)

O objetivo imediato é instalar **uma central SIP local e sem acesso público**
para validar Docker/Asterisk, sem interferir com a instância OficinaOS nas
portas 4000/4001 e sem desviar o telemóvel Amigo.

## Iniciar num Ubuntu com Docker + Compose v2

```bash
cd ~/Inovito-VoIP-teste/infra/inovito-voip
bash start-lab.sh
docker compose -f compose.yml ps
docker compose -f compose.yml exec -T asterisk asterisk -rx 'core show version'
docker compose -f compose.yml exec -T asterisk asterisk -rx 'pjsip show endpoints'
```

Se a pasta ainda não existir, obter apenas o ramo de testes em pasta separada:

```bash
git clone --depth=1 -b feature/inovito-voice-call-log \
  https://github.com/clementemsantos/OficinaOS.git ~/Inovito-VoIP-teste
```

### Segurança

- Apenas a porta UDP **15060** no **loopback do host** é publicada. **Não**
  abrir 5060, 8088 nem RTP no router/firewall.
- ARI e HTTP desativados nesta etapa. Sem gateway Gemini nem encaminhamento
  de chamadas reais. Asterisk **não** está integrado com a Amigo nesta fase.
- O utilizador de testes `inovito-lab` tem uma senha aleatória em
  `runtime/pjsip-peer.conf`, gerada localmente, não enviada para o GitHub.
- O contexto `inovito-lab` oferece apenas a extensão **999 (eco)**;
  não admite chamadas externas nem chamadas de saída.
- O transporte VoIP está em **loopback**, de modo que o endpoint SIP de testes
  só pode ser usado a partir do próprio Ubuntu (por exemplo com softphone
  local e porta 15060). Não se trata de acesso do Android pela rede.
- Para produção, a escolha do DID/trunk SIP, rede/NAT, TLS, RTP, credenciais,
  transferência para humano e fallback depende do fornecedor real.

### Parar, sem afetar o OficinaOS

```bash
cd ~/Inovito-VoIP-teste/infra/inovito-voip
docker compose -f compose.yml down
```

## Próxima fase (não implementada)

1. Confirmar com a Amigo **desvio por ausência de resposta aos 30 segundos**,
   custo e preservação do número chamador.
2. Escolher DID/VoIP com SIP trunk que suporte destino português e CLI original.
3. Ligar Asterisk ARI a um gateway de áudio (RTP/PCM 16 kHz ↔ Gemini Live
   PCM de saída a 24 kHz), com identificação de IA e interrupções naturais.
4. Integrar o gateway com as APIs já adicionadas ao OficinaOS:
   `POST /api/inovito-voice/gateway/decision` (antes da IA) e
   `POST /api/inovito-voice/gateway/event` (registo de chamadas comerciais).
5. Testar contactos excluídos, chamadas ocultas, RGPD e contingência antes
   de colocar o número real em serviço.
