# OficinaOS — Atlas Técnico V2
## Especificação funcional e técnica pronta para execução

**Data:** 23-10-2026  
**Base de integração:** inove/release-candidate, preservando as funcionalidades Inove.pt, importações Keymaster, encomendas, RMA e POS  
**Estado deste documento:** plano aprovado para preparar desenvolvimento; NÃO significa implementação funcional ou instalação no servidor  
**Idioma padrão:** português de Portugal (PT-PT); arquitetura preparada para internacionalização

## 1. Visão do produto

Transformar o Atlas V1 (10 guias PT-PT versionados em código, esquemas didáticos, pesquisa e acesso desde reparações) numa biblioteca técnica visual **editável, auditável, colaborativa e opcionalmente federada** entre instalações do OficinaOS.

Objetivos:
1. Um técnico resolve mais depressa uma avaria, pesquisando por marca, modelo, sintoma e componente.
2. Qualquer técnico autorizado adiciona guias, passos, imagens próprias e pontos visuais.
3. A loja controla o que é privado, o que é visível para a equipa e o que pode sair para a comunidade.
4. Um moderador valida o conhecimento antes de entrar no catálogo comunitário.
5. Cada modelo de iPhone dispõe de ficha pesquisável; apenas modelos com esquema revisto exibem mapa interno como tecnicamente exato.
6. Uma ligação a uma obra nunca publica dados, fotos, IMEI, números de série, códigos de desbloqueio ou informação de clientes.

### Definição de V2 concluída

A V2 só é considerada integralmente concluída após a entrega de: edição e imagens locais, modelos e pesquisa, hotspots visuais acessíveis, revisões, autorizações, associação a obras, comentários e votos, serviço central de comunidade com moderação e sincronização opt-in, catálogo integral de modelos de iPhone, diagramas originais validados conforme disponibilidade de evidência, testes de segurança e ensaio de restauro.

A entrega é faseada: V2.1 (local e visual), V2.2 (primeira coleção iPhone), V2.3 (comunidade), V2.4 (expansão e qualidade). O catálogo completo de nomes **não** implica inventar layouts internos dos modelos ainda não documentados.

## 2. O que já existe na V1 e o que será preservado

- Página protegida /atlas, menu desktop/móvel e permissões de visualização de reparações.
- Guias genéricos originais, pesquisa sem acentos, categorias e diagramas SVG didáticos.
- Ligação contextual a partir da obra (/jobs/:id) e ligação copiável para utilizadores autenticados na mesma instalação.
- Os dados das reparações continuam separados do Atlas.
- O conteúdo V1 é mantido e disponibilizado como conteúdo inicial, sem apagar ou duplicar obras.

**Limites atuais:** não existem editor de guias nem media persistente, as checklists não são gravadas, não existe hub entre instalações, e os esquemas atuais não são boardviews.

## 3. Perfis, acessos e experiência

| Perfil | Ler | Criar/editar | Publicar na loja | Publicar na comunidade | Moderar |
|---|---|---|---|---|---|
| Técnico | Autorizado | Rascunhos próprios | Não | Submeter pedido | Não |
| Responsável/gestor da loja | Autorizado | Sim | Sim | Submeter pedido | Conteúdo da loja |
| Proprietário/admin da instalação | Autorizado | Sim | Sim | Ativar partilha e submeter | Conteúdo da loja |
| Moderador do serviço central | Catálogo comunitário | Rever/corrigir mediante fluxo | Não gere lojas | Aprovar/rejeitar | Sim |

Criar recurso autónomo no sistema de permissões: atlas: view, create, editOwn, editShop, publishShop, submitCommunity, moderateShop, manageSettings. Nunca confiar apenas em permissões escondidas no frontend: verificar o papel e a propriedade em cada endpoint. Os moderadores globais pertencem ao serviço central, não ganham acesso à base de dados de nenhuma loja.

**Primeira utilização:** mostrar um tutorial compacto explicando diferenças entre Privado, Loja e Comunidade, com aviso de proteção de dados ao publicar.

## 4. Tipos e estados de conteúdo

Tipos: GUIA, DICA, ATLAS_VISUAL, CHECKLIST.

**Visibilidade (campo próprio):**
- PRIVATE: criador e responsáveis autorizados, dentro da instalação.
- SHOP: técnicos com acesso ao Atlas na instalação.
- COMMUNITY: revisão publicada no serviço comunitário central; apenas metadados e conteúdo expressamente selecionados são enviados.

**Estado editorial (outro campo):**
- DRAFT, PENDING_SHOP, APPROVED_SHOP, PENDING_COMMUNITY, PUBLISHED_COMMUNITY, REJECTED, ARCHIVED.

Não misturar visibilidade com estado. Uma publicação aprovada pode regressar a rascunho numa nova revisão sem apagar a revisão pública existente. A remoção da comunidade exige retirada sincronizada e trilho de auditoria.

## 5. Páginas e navegação

| Página | Rota proposta | Componentes |
|---|---|---|
| Início Atlas | /atlas | Busca, filtros, famílias, guias recentes, mais úteis, novidades da comunidade |
| Catálogo iPhone | /atlas/iphone | Pesquisa por geração, Plus/Pro/Max/mini/SE/e/Air/Duo, ano, revisão |
| Ficha por modelo | /atlas/modelos/:slug | Capa original, mapa visual com hotspots, separadores componentes/avarias/checklist/fontes |
| Guia | /atlas/guias/:id | Sumário, passos com imagens, riscos, ferramentas, sintomas, revisão, autor |
| Editor | /atlas/novo e /atlas/guias/:id/editar | Editor em etapas, uploads, hotspots percentuais, pré-visualização |
| Os meus conteúdos | /atlas/meus | Rascunhos, privados, por aprovar, publicados, histórico |
| Moderação da loja | /atlas/revisao | Fila, diffs, rejeição fundamentada, publicar/arquivar |
| Comunidade | /atlas/comunidade | Catálogo público da comunidade, contributos, votar, denunciar |
| Administração | /definicoes/atlas | Opt-in partilha, identidade pública, sincronização, limites de media |

### Esboço visual (modelo iPhone)

~~~
[← Atlas]  [Apple] [iPhone 13] [Pesquisar por sintoma...]
[Imagem/diagrama interativo do aparelho] [Componentes por zona]
   (hotspots numerados e acessíveis)       Bateria       [Ver guias]
                                          Ecrã          [Ver guias]
                                          Placa         [Ver guias]
                                          Câmara        [Ver guias]
                                          Porta carga   [Ver guias]
[⚠ Segurança]  [Falhas comuns]  [Ferramentas]  [Testes finais]
[Notas da loja] [Guias da comunidade] [Adicionar contributo]
[Fontes e grau de verificação: específico / genérico / pendente]
~~~

Design adaptado a telemóvel, tablet e desktop; lista textual equivalente aos hotspots para acessibilidade por teclado e leitores de ecrã; zoom e deslocação com limites; foco visível; alternativa para utilizadores sem apontador.

## 6. Editor manual

Campos obrigatórios: título, tipo, categoria, descrição curta, passos ou conteúdo, estado de publicação, declaração de autoria/licença.

Campos opcionais: marca/modelo, códigos de modelo (ex.: Axxxx), sintomas, tags, dificuldade, duração indicativa, ferramentas, peças, pré-testes, segurança, passos ilustrados, verificações pós-reparação, fontes e data de última verificação.

Funcionalidades:
- Guardar rascunho; pré-visualizar; submeter; editar nova revisão; comparar duas revisões; rejeitar com motivo.
- Arrastar/reordenar passos, inserir imagem por passo, escolher imagem de capa e adicionar legenda/acessibilidade.
- Marcar zonas no diagrama/foto com hotspot (coordenadas normalizadas x/y em percentagem de 0 a 100, polígono opcional).
- Anexar fotografias próprias e diagramas originais; permitir reutilização dos mesmos media com licença válida.
- Associar vários modelos a um guia ou um único modelo específico, sem supor que são idênticos.
- Duplicar um guia como rascunho sem publicar automaticamente o original.
- Guardar automaticamente no navegador apenas estados não sensíveis; persistir rascunhos no servidor com conflitos/versionamento.

## 7. Atlas visual — segurança e rigor dos esquemas

Cada ficha visual contém:
- Diagrama ilustrativo exterior + interior **somente se validado**.
- Mapa de componentes por hotspots, legenda e acessibilidade.
- Sintomas comuns e provas de diagnóstico com nível de confiança.
- Identificação de cabos delicados, bateria de iões de lítio, vidro, vedação, sensores biométricos e cuidados ESD.
- Sequência visual de desmontagem/reassemblagem apenas com base técnica verificada para aquele modelo.
- Ferramentas, notas de compatibilidade e referências para o manual original do fabricante.
- Origem da imagem, licença, autor, data, dispositivo/região, revisão técnica e aprovador.

**Estados de verificação da imagem:** GENERIC_ILLUSTRATION, MODEL_SPECIFIC_DRAFT, MODEL_SPECIFIC_REVIEWED. Diagramas genéricos levam faixa visível "Esquema ilustrativo — não representa a posição real de componentes"; nunca apresentar um esquema aproximado como se fosse a placa exata, localização de conectores, tipo de parafuso ou torque do modelo.

**Fontes:** consultar links oficiais Apple Repair e fontes de documentação autorizada; não importar PDFs/imagens Apple, esquemas de fabricantes ou atlas comerciais para republicação sem licença. Não copiar boardviews protegidos ou criar representações potencialmente enganadoras.

**Revisão de segurança:** separar avisos para bateria inchada/perfurada e dispositivos danificados por líquidos; explicar que procedimentos perigosos exigem formação, equipamentos apropriados e consulta do manual oficial. Não publicar métodos de contorno de bloqueios, contorno de segurança de conta ou exposição de dados.

## 8. Catálogo de todos os iPhones

A navegação de catálogo deve conter desde o primeiro lançamento todos os nomes comerciais verificados; um modelo sem atlas validado mostra "Ficha em preparação" e permite adicionar notas/soluções, sem mostrar uma falsa vista interna.

### Catálogo base por famílias

| Grupo | Modelos a indexar |
|---|---|
| Origens | iPhone (2007), 3G, 3GS, 4, 4s, 5, 5c, 5s |
| Geração 6 | 6, 6 Plus, 6s, 6s Plus, SE (1.ª geração) |
| Geração 7 e 8 | 7, 7 Plus, 8, 8 Plus |
| Geração X | X, XR, XS, XS Max |
| Geração 11 | 11, 11 Pro, 11 Pro Max; SE (2.ª geração) |
| Geração 12 | 12 mini, 12, 12 Pro, 12 Pro Max |
| Geração 13 | 13 mini, 13, 13 Pro, 13 Pro Max; SE (3.ª geração) |
| Geração 14 | 14, 14 Plus, 14 Pro, 14 Pro Max |
| Geração 15 | 15, 15 Plus, 15 Pro, 15 Pro Max |
| Geração 16 | 16, 16 Plus, 16 Pro, 16 Pro Max, 16e |
| Geração 17 | 17, 17e, 17 Pro, 17 Pro Max, iPhone Air |
| Geração 18 e novos formatos | 18 Pro, 18 Pro Max, iPhone Duo (verificar disponibilidade e documentação técnica por modelo antes de publicar vista interna) |

**Fontes para atualização do catálogo:** https://support.apple.com/pt-pt/108044 ; https://www.apple.com/pt/iphone/compare/ ; https://support.apple.com/pt-pt/docs/iphone . Conferir data/variante e código Axxxx no lançamento de cada novo modelo. Nunca inferir a arquitetura interna a partir do nome comercial, de produtos irmãos ou da versão anterior.

**Campos por modelo:** id, fabricante, família, nome comercial, slug, ano, variantes regionais e códigos de modelo Axxxx (valores verificados), referência oficial, estado de revisão, notas de compatibilidade, data de atualização e aliases para pesquisa (por exemplo iPhone X R e XR).

### Ordem de produção de esquemas (não confundir com o catálogo)

- **Lote 1:** iPhone 7 / 7 Plus, 8 / 8 Plus, X, XR, 11, 12, 13 e variantes para as quais exista documentação validada.
- **Lote 2:** restantes 11–13, SE, 14 e 15.
- **Lote 3:** 16, 16e, 17, 17e, 18 Pro/Pro Max, Air e Duo; esquemas individuais conforme documentação disponível.
- **Lote 4:** séries antigas (original até 6s), manutenção e correção comunitária.

Cada modelo requer verificação independente de conectores, abertura, componentes, identificação exata e revisão. Não reutilizar uma única vista anatómica como representação factual de todos os modelos.

### Guias de sintomas prioritários por modelo/família

Não liga; sem imagem; ecrã/tátil; não carrega com cabo; carregamento sem fios; bateria/autonomia; Face ID/Touch ID; câmaras; microfones/auriculares/altifalantes; rede/Wi-Fi; aquecimento; danos por líquidos; problemas pós-reparação/peças e assistência. Cada guia só assume relações específicas depois da verificação técnica.

## 9. Dados persistentes locais — Prisma/PostgreSQL

Criar novas tabelas de forma **aditiva**, sem modificar ou apagar dados das obras:

1. AtlasEntry: id, slug local, kind, title, summary, body estruturado (JSON validado), brand, difficulty, currentRevisionId, authorUserId, visibility, editorialStatus, createdAt, updatedAt, archivedAt.
2. AtlasRevision: id, entryId, revisionNo, snapshot JSON imutável, editorUserId, changeReason, createdAt, reviewState, reviewedById, reviewedAt. Unique(entryId, revisionNo).
3. AtlasModel: id, brand, family, name, slug, releaseYear, modelCodes JSON, officialSourceUrl, verificationStatus, verifiedAt. Unique(brand, slug).
4. AtlasEntryModel: entryId, modelId, applicability (SPECIFIC/GENERAL/UNVERIFIED), composite unique.
5. AtlasMedia: id, entryId, revisionId nullable, storageKey, SHA-256, mime, width, height, bytes, caption, altText, copyrightOwner, license, createdById, createdAt, visibility. Não utilizar o caminho de fotos de clientes/obras.
6. AtlasHotspot: id, revisionId, mediaId, componentKey, xPct, yPct, optional geometry JSON, label, technicalConfidence, sortOrder. Verificar pertença de media à revisão.
7. AtlasEntryTag: entryId, normalizedTag, unique composto; AtlasVote: entryId, voterId, value, unique composto; AtlasComment: entryId, authorUserId, text, moderationState, timestamps.
8. AtlasModerationEvent: id, entryId, revisionId, actorId, action, justification, createdAt; sempre append-only.
9. AtlasJobLink: jobId, entryId, revisionId optional, createdById, timestamp; **só existe localmente**, não sincronizar.
10. AtlasCommunityLink: entryId, localRevisionId, hubEntryId, hubRevisionId, publicationConsentAt, lastSyncAt, syncStatus, error, lastSeenCommunityVersion.

Índices: categoria/marca/modelo/status/data, pesquisa normalizada/acento-insensível, tags, hubEntryId, e autor.

**Separar referências locais de públicas:** a identidade pública do autor é pseudónimo/alcunha voluntária, nunca userId, nome de cliente ou nome interno da obra. Identificadores globais UUID aleatórios e idempotência para uploads/sincronização.

**Conteúdo V1:** manter 10 guias como conteúdo "bundled" de leitura; criar importação idempotente para BD ou camada de leitura combinada. Não duplicar em upgrades, nem alterar histórico de reparações.

## 10. API da instância (proposta)

| Método | Endpoint | Objetivo |
|---|---|---|
| GET | /api/atlas/entries | Listar com paginação, filtros e pesquisa |
| POST | /api/atlas/entries | Criar rascunho |
| GET | /api/atlas/entries/:id | Guia + revisão publicada/autorizada |
| PATCH | /api/atlas/entries/:id | Editar com controlo de versão |
| POST | /api/atlas/entries/:id/revisions | Guardar nova revisão |
| POST | /api/atlas/entries/:id/submit | Enviar para revisão da loja/comunidade |
| POST | /api/atlas/entries/:id/review | Aprovar/rejeitar com motivo |
| POST | /api/atlas/entries/:id/media | Enviar imagem própria validada |
| GET | /api/atlas/entries/:id/media/:mediaId | Servir media autenticado e autorizado |
| GET | /api/atlas/models | Catálogo de modelos |
| GET | /api/atlas/models/:slug | Ficha com revisões e hotspots |
| POST | /api/atlas/entries/:id/votes | Voto autenticado, um por utilizador |
| POST | /api/atlas/entries/:id/comments | Comentário, sujeito a política |
| POST | /api/atlas/jobs/:jobId/link | Associar guia à obra (local) |
| POST | /api/atlas/community/publish | Consentimento expresso + pré-visualização de envio |
| GET | /api/atlas/community/sync | Obter catálogo aprovado e estado |

Todos os inputs validados com Zod, respostas paginadas e limites, CSRF/autenticação, rate limiting, controlo de ownership/roles no backend, registos auditáveis; não aceitar HTML executável. Manter formato e convenções dos serviços Fastify existentes. Aplicar ordenação estável/pesquisa insensível a acentos.

## 11. Imagens, ficheiros, licença e privacidade

- Formatos de utilizador: JPEG, PNG, WebP; PDF apenas como link de fonte, não distribuição automática. Não aceitar SVG/HTML de utilizadores sem conversão e sanitização segura (preferir diagramas próprios versionados).
- Máximo inicial indicativo: 8 MB por imagem; 12 imagens por guia; quotas de instalação configuráveis. Processar imagem, validar MIME real/magic bytes e dimensões, gerar thumbnail, bloquear formatos perigosos, evitar zip bombs e controlar consumo.
- Remover EXIF e localização, inspecionar metadados, permitir recorte manual, rejeitar imagens com dados identificáveis de clientes ou ecrãs com dados pessoais. A confirmação do técnico **não substitui a revisão**.
- Armazenamento local privado no volume persistente de uploads, com rotas protegidas. Imagens comunitárias são cópias publicadas no hub apenas após revisão e concordância de licença; nunca servir ficheiros arbitrários em /api/uploads.
- Licenças aceites: próprio conteúdo do autor, ou licença válida com atribuição e condições respeitadas. A comunidade usa uma licença explícita escolhida no momento do envio; sem licença, não disponibilizar para reutilização global.
- Conservação e eliminação: retirada de conteúdo público, retenção mínima necessária de logs de moderação, tratamento de denúncias, pedidos de remoção e política GDPR; evitar prometer eliminação imediata em caches offline.

## 12. Partilha entre instalações — hub comunitário separado

**Requisito arquitetural:** o OficinaOS instalado em várias lojas não pode trocar conteúdos automaticamente só por apontar para /atlas de uma delas. É necessário um **serviço central HTTPS** com API, BD, armazenamento de media, revisão, quotas e gestão de contas/instâncias. O hub não tem acesso às BD locais nem a portas de rede das lojas.

**Integração opt-in:**
1. O proprietário da loja ativa "Comunidade" nas definições e regista a instância com credencial própria de âmbito restrito; guardar segredo cifrado.
2. O técnico cria conteúdo privado ou da loja.
3. Para partilhar, o responsável abre "Pré-visualizar dados enviados"; autoriza expressamente uma revisão e as imagens selecionadas; processador remove metadados.
4. A API envia **apenas** título, conteúdo da revisão, tags, modelo, media licenciados e pseudónimo consentido; nunca ordens, clientes, códigos, fotos das obras, IMEI/serial, faturação, e-mail ou dados de login.
5. O hub fica em PENDING_COMMUNITY; moderador aprova, rejeita com motivo ou pede correção.
6. Instâncias que aderiram obtêm apenas versões PUBLISHED; cache local de leitura e origem/versão. As revisões propagam-se sem apagar notas privadas.
7. O autor ou moderador pode retirar publicação; o hub emite tombstone para retirada nas caches, com audit trail.

Requisitos técnicos do hub: autenticação máquina-a-máquina com rotação/revogação; HTTPS; consentimento e licença por publicação; IDs opacos; idempotência; versionamento e assinatura de payloads; moderação antispam e denúncia; rate limiting; backups e restauros; métricas operacionais; política GDPR; e desenho claro da entidade responsável, domínio, alojamento e custos antes de disponibilizar a outras lojas.

**Modo offline:** Atlas local e conteúdo já sincronizado continuam acessíveis; criar/editar guias locais não depende do hub. Fila de sincronização com retry e indicadores claros "Pendente", "Publicado", "Erro". Não pedir ao utilizador para expor a porta 4002 do servidor.

## 13. Pesquisa, qualidade e ajuda comunitária

- Busca sem acentos, com sinónimos PT-PT: telemóvel/smartphone, ecrã/display, porta de carga/conector, bateria/autonomia, não liga/sem imagem.
- Filtros: marca, modelo, família, sintoma, componente, dificuldade, tipo, nível de verificação, origem (meus/loja/comunidade).
- Guia útil: feedback "Ajudou?" e comentário técnico. Mostrar contagens, evitar manipulação por utilizadores repetidos, ocultar votos fraudulentos.
- Ranking com revisão editorial e adequação ao modelo prioritárias; votos nunca se sobrepõem a um aviso de segurança ou incerteza.
- Contributos sinalizados/denunciados passam a revisão.
- Pesquisas vazias oferecem "Criar nova dica" e "Pedir ajuda à comunidade", sem exposição de dados das obras.

## 14. Integração com reparações

Ao abrir obra:
- Identificar categoria e modelo por dados existentes quando disponíveis.
- Mostrar "Atlas técnico" e sugerir guias **com correspondência comprovada de modelo**.
- Permitir guardar uma ligação AtlasJobLink na obra, com revisão consultada, técnico e data.
- A checklist técnica pode ser marcada e armazenada como registo local próprio da obra, distinto das checklists existentes e identificado pelo autor/data; nenhuma conclusão deve ser assumida por abrir um guia.
- Informação de clientes, fotografias de obras, orçamentos e códigos de acesso nunca entram nos feeds da comunidade.
- Não alterar cálculos de reparações, peças, RMA, pagamentos, encomendas, IVA ou POS.

## 15. Fases, dependências e entregáveis verificáveis

### V2.1 — Editor local e estrutura

Entregáveis: migração aditiva; modelos/tags; CRUD privado/loja; imagens locais e licenças; papéis/validação; histórico de revisões; pesquisa; UI de grelha e editor; preservação de 10 guias V1.

Aceitação: técnico cria guia com 3 passos/2 fotos; outro técnico autorizado consulta a publicação loja; leitor não edita; média privada não é acessível por URL pública; 10 guias V1 continuam consultáveis; BD antiga atualiza sem perda.

### V2.2 — Atlas visual iPhone e ligação às obras

Entregáveis: catálogo completo de nomes por famílias; interface iPhone; diagramas visuais originais e hotspots; 1.º lote validado; filtros e ligações às obras; fonte e grau de verificação visíveis.

Aceitação: pesquisa "iPhone XR bateria" abre guia adequado; hotspots funcionam com rato/toque/teclado; modelo sem validação não mostra geometria inventada; associação à obra não transmite dados externos; mudança de dispositivo atualiza sugestões sem misturar modelos.

### V2.3 — Hub comunitário e moderação

Dependência externa: domínio e alojamento para API/BD/media do hub, termos/licenças e política de privacidade definidos. Desenvolver sem expor a instalação de loja à Internet.

Entregáveis: gestão de instâncias e credenciais; consentimento por item; exportação sanitizada; fila de moderação; comentários/feedback; hub API; importação de conteúdo aprovado; reversão/remoção; quotas e relatórios.

Aceitação: loja A publica dica e loja B encontra-a só após aprovação; loja B nunca recebe dados de clientes A; conteúdo privado não aparece no tráfego do hub; anulação de publicação propaga; falha de ligação não bloqueia trabalho local.

### V2.4 — Cobertura iPhone e refinamento

Entregáveis: completar fichas de todas as famílias; revisões específicas por variantes disponíveis; instruções visuais de acordo com fontes licenciadas/verificadas; acessibilidade, suporte offline, exportação PDF com fonte/licença e histórico.

Aceitação: todos os nomes do catálogo têm ficha; os diagramas exatos só aparecem quando aprovados; guias com evidência insuficiente assinalados; rotas e PDFs respeitam visibilidade e não incluem dados de obras por defeito.

## 16. Testes, migrações e segurança de implementação

**Testes mínimos automáticos:**
1. RBAC por perfil, autorização por dono e por instalação; ler dados privados por outro utilizador/instância deve falhar.
2. Schema de entradas, revisão concorrente e histórico imutável; idempotência de importação V1.
3. Search PT-PT por acentos/sinónimos; filtros de geração e variantes.
4. Upload inválido, EXIF, extensões enganosas, quotas, autorização de acesso a imagem, sanitização de texto e malware.
5. Hotspot em escala, comportamento mobile e teclado, fotos sem legendas, contraste.
6. Publicação só após consentimento, sem dados de obras/IMEI e com workflow de moderação.
7. Sync reentrante, credencial revogada, offline, divergência, tombstones, retrys e logs sem PII.
8. Atualização PostgreSQL com dados legados, backup/restauro, rollback do binário e isolamento do hub.
9. Testes de regressão OficinaOS: reparações, clientes, RMA, encomendas, importações Keymaster e POS sem alteração.
10. Testes manuais na instância de testes com imagens próprias, antes de ativar em produção.

**Deploy na infraestrutura da Inove:** desenvolver na branch baseada em inove/release-candidate; usar PRs pequenos; correr CI, migrações testadas e backup (incluindo volumes de imagens). Aplicar primeiro no projeto docker compose --project-name oficinaos-misto --env-file .env.misto -f compose.misto.yaml na porta 4002. A imagem de produção/porta 4000 só muda após aceitação explícita. Não usar down -v, migrate reset, reset --hard nem misturar volumes de produção e teste.

**Backups:** base de dados **e** pasta/volume persistente dos media; retenção, checksum, restauro testado. Uma exportação pg_dump sozinha não restaura fotografias.

## 17. Definição de pronto para programação

- Interfaces e contratos API aprovados; modelos Zod e Prisma planeados.
- Alinhamento sobre licença de publicação da comunidade e política de remoção.
- Responsável pelo hub definido (domínio/alojamento) antes do desenvolvimento V2.3.
- Catálogo de modelos verificado com documentação Apple por variante.
- Critérios de revisão de diagramas atribuídos a técnico competente; avisos visíveis de conteúdos genéricos.
- Integração com a branch Inove e plano de migração/rollback verificados.

## 18. Decisões assumidas e próximos passos sem bloquear

- O primeiro objetivo de desenvolvimento é **V2.1 e V2.2**, que geram utilidade imediata dentro da loja sem dependência de um hub externo.
- O hub da V2.3 será **opt-in** e isolado por HTTPS; até existir hub operacional, "Partilhar com a comunidade" não aparecerá como funcionalidade disponível.
- O catálogo iPhone ficará completo por nomes desde cedo; desenhos precisos requerem revisão modelo a modelo.
- A biblioteca atual V1 não será removida; o utilizador mantém acesso aos guias de hoje.
- A documentação oficial da Apple é referenciada por **ligações**, sem cópia automática de textos, PDF ou imagens protegidas.

### Fontes oficiais consultadas (referência, não autorização de reprodução)

- Identificação e lista de modelos Apple: https://support.apple.com/pt-pt/108044
- Comparador e famílias: https://www.apple.com/pt/iphone/compare/
- Índice de manuais iPhone: https://support.apple.com/pt-pt/docs/iphone
- Reparação Self-Service e manuais originais: https://support.apple.com/pt-pt/self-service-repair
- Assistente de reparação pós-serviço: https://support.apple.com/pt-pt/120579

---

**Nota operacional:** Este ficheiro é a especificação da V2 e não instala funcionalidades novas. O Atlas V1 continua funcional em OficinaOS-misto:4002 enquanto o desenvolvimento das várias fases não for testado e aprovado.
