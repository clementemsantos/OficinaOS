# Inovito JARVIS — MVP de voz (apenas para testes)

## Âmbito implementado

Este módulo experimental acrescenta um botão **Inovito · Voz** ao OficinaOS. A funcionalidade só é incluída quando a variável de compilação **VITE_INOVITO_VOICE_ENABLED=true** estiver definida. Por omissão, está desligada; não interfere com as instâncias existentes, com o Asterisk ou com o atendimento telefónico.

Após o utilizador carregar em **Ativar** e autorizar o microfone, o navegador tenta reconhecer frases em **pt-PT**. Exemplos:

- «Inovito, abre as tarefas»
- «Inovito, mostra as reparações»
- «Inovito» → «Abre as encomendas» (nos 15 segundos seguintes)
- «Inovito, que comandos tens?»

O módulo responde com síntese de voz do navegador quando disponível. Só permite **navegação** entre áreas já permitidas ao perfil autenticado; não cria, altera ou apaga registos, não efetua compras, não envia mensagens nem interpreta pedidos de clientes. Não inventa números ou estatísticas. Não liga ainda ao cérebro conversacional, ao Inovito VoIP nem ao telemóvel em segundo plano.

## Importante: proteção de dados e limitações

Este protótipo **não contém deteção local da palavra de ativação**: enquanto está ligado, o reconhecimento do navegador pode processar áudio antes de ser dito «Inovito». Dependendo do navegador, os dados de voz podem passar por um serviço externo. Por este motivo, **não deve ser utilizado perto de clientes, nem para dados pessoais ou informação confidencial**. É apenas adequado para testes em ambiente privado e controlado.

- A permissão do microfone é pedida pelo navegador; a escuta arranca apenas por ação explícita e há sempre um botão **Desligar**.
- Ao terminar sessão, sair da página ou desativar a funcionalidade, o reconhecimento é interrompido.
- Ao colocar o separador em segundo plano, o módulo tenta interromper a escuta.
- O código do OficinaOS não grava áudio, não guarda transcrições na base de dados e não acrescenta endpoints.
- O reconhecimento contínuo depende do navegador e não é garantido: pode terminar por inatividade ou limitações da plataforma.
- O microfone em páginas web exige normalmente **HTTPS ou localhost**. Acesso ao OficinaOS por HTTP num IP da rede local (por exemplo, 192.168.x.x) não satisfaz esta condição.

**Versão futura para uso na loja:** detetor de hotword local e offline no dispositivo do utilizador, com indicador de microfone; após «Inovito», reconhecimento e resposta por voz; isolamento de dados pessoais e consentimento adequado. O processo do Asterisk deve manter-se separado.

## Como testar sem afetar a loja

1. Utilizar **um clone / worktree de testes** do repositório, não a pasta da instância de produção.
2. Selecionar o ramo **inove/inovito-jarvis-voz-mvp** baseado em **inove/release-candidate**.
3. Instalar dependências com **bun install --frozen-lockfile**.
4. Executar **bun run typecheck**, **bun run check**, **bun run test -- src/lib/__tests__/inovito-voice-commands.test.ts** e **bun run build**.
5. Para a compilação **apenas de testes**, definir **VITE_INOVITO_VOICE_ENABLED=true** no ambiente do processo Vite. É variável de compilação, não basta alterá-la depois de compilar.
6. Abrir a aplicação por HTTPS ou localhost com uma conta de testes e autorizar o microfone apenas num ambiente privado.
7. Verificar ativação/desativação, palavra de ativação, pausa no separador oculto, permissões do perfil e comportamento após terminar sessão.

**Rollback:** remover VITE_INOVITO_VOICE_ENABLED=true na compilação e reconstruir a versão de testes, ou regressar ao commit/ramo anterior. A funcionalidade não introduz migrações da base de dados nem modifica as rotas do servidor.

## Próximos passos (fora deste PR)

- Escolher/testar um motor **offline** de palavra de ativação portuguesa («Inovito»).
- Integrar comandos conversacionais e leitura de dados reais do OficinaOS exclusivamente através de endpoints autenticados e autorizados; nunca através de acesso direto à base de dados.
- Unificar o projeto Inovito VoIP com um serviço de orquestração, sem reintroduzir problemas de áudio SIP/ARI nem expor endpoints internos.
- Aplicar testes reais no microfone do PC de laboratório antes de considerar telemóvel, automatizações pessoais ou produção.
