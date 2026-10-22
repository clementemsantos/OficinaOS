# Migração Inove.pt — HelloClient, HubSpot e Keymaster → OficinaOS Misto

**Estado: levantamento / preparação. Nenhuma importação destas plataformas foi efetuada.**

## Decisão confirmada: migração INTEGRAL de reparações Keymaster (18/10/2026)

**O OficinaOS Misto é o destino principal.** A loja confirmou que devem ser
migradas **todas as obras de reparação**, não só 18 referências partilhadas:
**63 em curso** no momento da consulta, mais **todas as concluídas**, de
qualquer ano que ainda esteja disponível. A contagem definitiva de obras
fechadas ainda não foi fornecida; a contagem 63 pode variar enquanto o
Keymaster estiver a ser utilizado.

**Obrigatório por obra:**
- ID imutável e referência visível (ex. `2026/255`), cliente e equipamento
  por ID de origem, entrada, previsão, conclusão e entrega, técnicos,
  sintomas, orçamentos e decisões, valores e pagamentos históricos;
- estado atual *e* cronologia de todas as transições com datas e autores
  originais, preservando nomes dos estados personalizados do Keymaster;
- texto integral de notas/diagnósticos/observações, autores, datas e
  visibilidade privada por defeito;
- todos os ficheiros disponíveis (fotos, vídeos, PDF, assinaturas, orçamentos,
  documentos), incluindo binários físicos, nomes originais, MIME, tamanho,
  checksums e ligação inequívoca à obra.

**Exportação necessária do Keymaster:** pacotes estruturados `obras`,
`historico_estados`, `notas` e `anexos_manifesto` (CSV/XLSX/JSON
segundo a possibilidade real), bem como `anexos.zip`/transferência de
binários. Caso não haja exportação disponível na UI de Migração de Dados
(onde foram mostrados apenas cinco cadastros), solicitar ao suporte
**info@keymaster.pt** um arquivo/backup **completo**, dicionário de
relações, data-limite de retenção dos anexos e entrega segura.

**Urgência de preservação:** os termos do Keymaster no módulo Folha de
Obra Digital mencionam até *três anos de histórico das galerias*, período
extensível mediante contratação. A disponibilidade histórica efetiva
deve ser confirmada diretamente com o fornecedor, e o pedido deve
abranger **todos os ficheiros ainda existentes**, inclusive anteriores
a três anos. Fonte: https://www.keymaster.pt/termos-e-condicoes/ .

**Não executar a migração através de `/api/import/jobs` ou do importador
genérico:** não preservam a cronologia, notas e anexos completos. A fonte
Keymaster atualmente disponibilizada em Definições → Dados é apenas
pré-visualização local dos cinco ficheiros de cadastro, sem escrita.

**Validação antes da passagem a produção:**
1. Manifesto com quantidades de obras por estado/ano (e total concluídas),
   eventos, notas e anexos na origem; identificação de exceções/ausências.
2. Cópia isolada, dry-run sem escrita, resolução de mapeamentos e duplicados.
3. Importação em lotes para 4002, idempotente por origem e ID, sem envios
   de mensagens, faturação ou alterações de stock; contagem e checksums
   por lote com relatórios de perdas/erros e retoma.
4. Conferência manual de obras abertas e concluídas com estado, notas,
   fotografias e PDFs; delta final das alterações entretanto feitas.
5. **Não desligar o Keymaster** nem substituir as outras instalações antes
   da aprovação explícita e cópia de segurança final.

## Fontes e evidências

1. **HelloClient** — https://my.helloclient.app/
   - Clientes: interface **Clients → More → Download Data to Device** (Excel).
   - Serviços: **Services → More → Download data to Device** (Excel).
   - Catálogo de produtos: documentação refere importação/exportação.
   - Pedidos/reparações, pagamentos, tarefas e fornecedores: recolher amostra
     exportada e confirmar disponibilidade/limitações em cada módulo.
   - Referências: https://helloclient.app/help-center/import-clients e
     https://helloclient.app/help-center/start
2. **HubSpot** — https://www.hubspot.com/
   - **CRM → Contactos/Empresas/Negócios/Tickets → Exportar**; pedir **todas
     as propriedades e associações**, CSV ou XLSX.
   - Outros objetos: tarefas, produtos, chamadas, notas, reuniões,
     atividades e comunicações (exportação/API adicional, conforme plano).
   - O backup geral do CRM, quando disponível no plano, não contém
     associações nem histórico completo de atividades — NÃO o considerar
     exportação integral sozinho.
   - Referências:
     https://knowledge.hubspot.com/import-and-export/export-records
     https://knowledge.hubspot.com/object-settings/back-up-crm-data
3. **Keymaster** — https://inove.by.keymaster.pt/
   - Entidades pretendidas: clientes, equipamentos, fichas de obra,
     estados, técnicos, orçamentos/aprovações, datas, peças, pagamentos,
     documentos, anexos e histórico de alterações.
   - **Formato/API de exportação por confirmar.** Não usar scraping da área
     privada nem tentar obter dados sem autorização. Pedir exportação
     completa ao fornecedor caso a interface não permita descarregar.
   - Referência sobre módulos: https://www.keymaster.pt/oficinas-auto-software/

## Exportações Keymaster recebidas — 18/10/2026

A loja forneceu cinco ficheiros `.xlsx` na conversa. Os **dados pessoais
não foram colocados no repositório GitHub**. Contagens verificadas na primeira
folha útil de cada ficheiro, excluindo as folhas auxiliares Países/RegimesIva.

| Fonte Keymaster | Folha | Linha dos cabeçalhos | Registos | Identificador principal |
| --- | --- | ---: | ---: | --- |
| Listagem de Clientes | Lista de Clientes | 2 | **2 634** | ID KEYMASTER |
| Lista de Equipamento | Lista de Equipamentos | 3 | **168** | ID |
| Listagem de Fornecedores | Lista de Fornecedores | 2 | **4** | ID |
| Catálogo de Serviços | Lista de serviços | 2 | **166** | REF. |
| Inventário de Stock | Lista de produtos | 2 | **94** | REF. |
| **Total** | | | **3 066** | |

### Correspondências pretendidas, sem importação automática

- **Clientes:** ID KEYMASTER → `sourceId` na proveniência; NOME →
  `Customer.name`; TELEFONE 1/2/3 e EMAIL 1/2 → contactos; NIF, morada,
  localidade, país, regime IVA e crédito exigem preservação adicional.
  Contagem observada: **2 634 IDs Keymaster distintos**, mas apenas
  **1 061 valores distintos** em **2 027 telefones 1 preenchidos**.
  Não fundir por telefone ou nome sem inspeção humana.
- **Equipamentos:** ID → `sourceId`; tipo, marca, modelo, número de série,
  acessórios e cor → equipamento e atributos de entrada. Os **168 registos**
  não têm preenchido `ID SISTEMA LEGADO DO CLIENTE`; o ficheiro por si só
  **não permite ligar equipamento a cliente ou ficha de obra**.
  Não criar fichas de reparação a partir de equipamentos soltos.
- **Fornecedores:** ID → `sourceId`; nome, NIF, contactos, morada, favorito
  e condições comerciais → registo de fornecedor, preservando impostos.
- **Serviços:** REF. → referência externa; DESCRIÇÃO, opções/QTD,
  invisibilidade e sinalizadores → catálogo de serviços. **166/166**
  estão sem PVP UNITÁRIO neste ficheiro; preço **desconhecido** não
  equivale a 0,00 €.
- **Stock:** REF. → referência externa; descrição, família, código de
  barras, CUSTO, QTD., MARGEM, PVP UNITÁRIO, visibilidade → inventário.
  **94 artigos**, mas `ID GRUPO` aparece repetido; não é identificador
  individual seguro. Valores monetários devem preservar vírgula decimal
  portuguesa, custo vs preço, e IVA.

### Implementação inicial no ramo

- **Definições → Dados → Origem Keymaster** apresenta uma
  pré-validação **sem escrita** para estes cinco tipos de exportação.
- Deteção da assinatura `CLIENTS`, `ITEMS`, `SUPPLIERS`,
  `SERVICES`, `PRODUCTS` e das linhas de cabeçalho 2/3.
- Lista quantidade, referências vazias/repetidas, equipamentos sem ligação
  a clientes e serviços sem preços. O ficheiro é lido no browser e **não é
  enviado para o servidor** nesta etapa.
- **PENDENTE**: criar armazenamento de proveniência e importadores por
  entidade, com dry-run, reconciliação e associação explícita. Não
  escolher o importador genérico existente para importar estes ficheiros
  por engano: perder-se-iam campos, referências e relações.

### Ficheiros que continuam em falta

Os cinco ficheiros acima **não** são uma exportação de obras de reparação
com estados, alterações de estado, notas e ficheiros binários.
Para cumprir os requisitos obrigatórios da loja, falta obter separadamente:
fichas/obras, respetivos eventos, notas e um pacote de anexos com
referência de ligação à obra. **Não declarar migração Keymaster concluída
sem estes dados.**

## Keymaster — requisitos obrigatórios confirmados pela loja (18/10/2026)

**A referência antiga, os estados, as notas e os ficheiros são informação
essencial e não podem ser perdidos, concatenados de modo irreversível ou
omitidos na migração.** Incluir tanto obras abertas como concluídas.

| Dado de origem | Preservação no OficinaOS | Regra de validação |
| --- | --- | --- |
| ID interno Keymaster + número visível da obra (ex. `2026/253`) | Identificador externo com origem `KEYMASTER`, código original pesquisável e ligação à obra | Reimportar o mesmo registo não pode criar duplicado; não alterar a referência apresentada |
| Estado atual + todas as transições existentes | Estado operacional mapeado e estado literal original; eventos históricos com data, autor e observação | Desconhecidos ficam `por mapear`, nunca fingir que foram entregues/concluídos |
| Notas, observações, diagnóstico, mensagens e decisões | Registos cronológicos separados, ordenados por data, com visibilidade privada por defeito | Guardar texto integral, origem, autor original e data se disponíveis; não divulgar automaticamente no portal do cliente |
| Fotografias, vídeos, PDF, orçamentos, assinaturas e outros documentos | Arquivos físicos no volume de anexos do Misto e metadados associados à obra correspondente | Confirmar byte size, tipo, checksum SHA-256, nome original e ligação à obra; nunca considerar simples URL expirável como ficheiro importado |

Outros campos que devem acompanhar cada reparação: cliente, contactos,
equipamento/modelo/serial, problema, acessórios, data de entrada, prazos,
técnico, orçamento dado e aprovado, peças usadas/encomendadas, custo,
pagamentos, data de conclusão/entrega e documentos fiscais históricos.
Respeitar consentimento e proteger dados sensíveis (códigos de desbloqueio
e palavras-passe **não devem entrar em notas públicas**).

**Lacunas técnicas que têm de ser resolvidas ANTES de importar o histórico:**

- `Job.externalRef` existe e é único globalmente; para três origens,
  definir chave composta `(sourceSystem, sourceEntity, sourceId)` em
  tabela de proveniência, não assumir referências independentes únicas.
- `Job.status` tem enum operacional reduzido; os estados personalizados
  Keymaster precisam de um mapeamento configurável E de preservação
  integral do valor e das transições históricas.
- `JobNote` guarda conteúdo/data/autor de sistema e visibilidade. Exige
  adaptação para preservar **autor externo, data original e fonte** sem
  atribuir falsamente autoria ao técnico que executa a importação.
- `JobPhoto` apenas guarda caminho/data/tipo de fotografia. Criar módulo
  de **anexos genéricos** com MIME, nome original, tamanho, checksum,
  origem e permissões, ligado à reparação; importar vídeo/PDF/documentos
  como documentos, não como fotos falsas.
- A rota atual `/api/import/jobs` só suporta campos-base de ficha,
  não importa o histórico detalhado ou os anexos. **Não utilizar**
  essa rota para fazer uma migração supostamente completa.
- Exigir `dry-run` com relatório por obra: referências, número de
  eventos de estado, notas e ficheiros esperados vs. importados, faltas,
  erros, checksums e casos de correspondência ambígua.
- Suportar importação reiniciável por lotes e auditoria de origem.
  Em caso de falha, não deixar anexos órfãos nem obras parcialmente
  importadas sem marcação explícita; aceitar retoma idempotente.

**Como obter dados:** confirmar primeiro se a interface Keymaster
permite exportar obras, estados, observações e galeria/media.
A documentação comercial confirma que o produto armazena fotos,
vídeos, notas e documentos ligados às obras, **mas não documenta
uma exportação integral destes artefactos**. Se não houver função de
exportação, solicitar ao suporte um pacote exportado com metadados
(CSV/XLSX/JSON, conforme disponível) e ficheiros binários (ZIP) com
manifesto `id_obra / id_ficheiro / nome`. Não presumir acesso à API
nem efetuar recolha automática de portal privado sem método autorizado.

## Princípios de integração

- Destino inicial **oficinaos-misto** (:4002) em sandbox, nunca a produção (:4000)
  nem o ambiente de testes (:4001) diretamente.
- **Backup, contagem de origem, dry-run sem escrita, comparação e aprovação**
  antes de aplicar alterações. Não enviar mensagens ou disparar automatismos.
- Guardar de cada linha: `sourceSystem`, `sourceEntity`, `sourceId`,
  data da importação, hash do registo, estado e erro/aviso. Deduplicar
  por chave de origem, idempotência em reimportações.
- Clientes: comparar telefone PT normalizado e email, depois nome/morada
  apenas como candidatos. Não fundir homónimos automaticamente.
- Empresas/fornecedores: distinguir pessoa/empresa; identidade por NIF
  validado ou código externo, com confirmação quando há ambiguidade.
- Reparações: preservar código de obra original numa referência externa,
  relacionar equipamento, cliente, técnico, estado original, notas, datas,
  histórico e documentos. NÃO converter silenciosamente estados desconhecidos.
- HubSpot: preservar associações contact–company–deal–ticket e IDs HubSpot;
  negociações não são automaticamente reparações.
- Peças/stock: nunca somar três inventários sem verificar se são o mesmo
  stock físico. Movimentos e saldos têm de ser reconciliados.
- Financeiro: faturas emitidas, IVA e pagamentos são históricos; nenhum
  importe deve emitir, alterar ou comunicar novos documentos fiscais.
- **RGPD**: tratar ficheiros com dados pessoais como confidenciais;
  evitar chat/GitHub públicos, limitar acesso e apagar temporários
  após importação validada.
- Sistemas originais permanecem acessíveis até reconciliação total.

## Lotes de execução

1. **Amostras**: pedir uma exportação de 5–20 linhas (anonimizadas quando
   possível) de cada tipo de entidade, mais cabeçalhos originais.
2. **Inventário**: tabela de ficheiros/entidades, quantidade de linhas,
   chaves únicas, codificações, fusos, campos customizados, links,
   anexos e limitações.
3. **Transformadores** específicos da origem com mapa de colunas;
   validar telefone, NIF, valores PT, data, encoding e estados;
   relatório prévio de duplicados e relações órfãs.
4. **Importação faseada**: empresas/fornecedores → contactos/clientes →
   produtos/serviços → equipamentos/reparações → tickets/negócios/tarefas →
   notas/histórico/documentos, mantendo a proveniência.
5. **Reconciliação**: contagens por sistema, amostras por cliente,
   estado das obras em aberto, datas de entrada/saída, materiais,
   orçamentos, pagamentos e links. Aprovação humana antes de produção.
6. **Passagem a produção**: backup final, não escrever simultaneamente
   no Keymaster e OficinaOS, importar delta e definir fonte única.

## Capacidades já existentes (ramo inove/release-candidate)

- `/api/import/jobs`, `/api/import/parts`, `/api/import/repairs`
  com validação por linha.
- CSV/XLSX importados pelo ecrã de Dados (normalização para JSON no
  browser). Fichas aceitam `jobCode`/`externalRef` para evitar
  duplicações nas reimportações.
- **Não há, por enquanto, importador nativo completo** de todas as
  entidades do HelloClient, HubSpot ou Keymaster. A migração completa
  precisa de mapeadores e gestão de proveniência e relações.
- Não executar importação em massa antes da pré-visualização, uma vez
  que estes endpoints escrevem diretamente na base de destino.

## Pedido de exportações para começar

- **HelloClient**: ficheiro de clientes; produtos; serviços; exportação
  de pedidos/reparações e respetivos históricos, se disponível.
- **HubSpot**: contactos, empresas, negócios, tickets (cada um com
  todas as propriedades e associações). Adicionar tarefas/notas/
  atividades quando relevantes.
- **Keymaster**: exportação de fichas de obra (incluindo fechadas),
  clientes, equipamentos e estados; pedir exportação completa ao suporte
  se necessário.

Segredos, acessos, ficheiros reais e dados pessoais **não devem ser
colocados no repositório público**.

## Revisão do esquema após validação dos cinco ficheiros (18/10/2026)

**Validação confirmada no OficinaOS Misto 4002:** os cinco XLSX passaram
a pré-visualização; 2 634 clientes, 168 equipamentos, 4 fornecedores,
166 serviços e 94 artigos de stock (total **3 066**).
Avisos: **168 equipamentos sem ID de cliente no export** e **166
serviços sem PVP**. `Sem avisos` nos clientes **NÃO** significa
compatibilidade com a base de dados: o pré-validador apenas verifica
referências vazias/repetidas no export.

### Bloqueios do modelo atual que impedem uma importação direta

1. **Clientes:** `Customer.phone String @unique`, obrigatório e único;
   na fonte 2 027 telefones principais preenchidos, mas apenas 1 061
   distintos, e outros clientes sem telefone. **Não substituir ausências
   por números fictícios; não fundir por telefone/nome.** Projetar
   contactos múltiplos associados a cliente, com telefone opcional,
   índices para pesquisa não exclusivos, e atualizar todos os fluxos
   que atualmente esperam `findUnique({phone})` ou univocidade.
   A chave de migração será `(KEYMASTER, CUSTOMER, ID KEYMASTER)`.
2. **Equipamento:** `Device` representa uma combinação marca/modelo
   (`@@unique([brandId,model])`) e **não uma unidade física**, sem
   número de série ou ligação própria ao cliente. É necessário
   preservar cada um dos 168 equipamentos físicos numa entidade
   específica, sem fundir equipamentos iguais. Não inventar
   ligação a cliente quando o export a omite.
3. **Serviços:** `RepairCatalog.defaultPrice Decimal` é obrigatório,
   mas **os 166 preços estão ausentes**. O catálogo importado deve
   permitir valor desconhecido/nulo ou guardar PVP em campo de origem
   distinto, sem atribuir arbitrariamente 0,00 €. Evitar fusões só
   porque o nome de serviço coincide; guardar `REF.` original.
4. **Stock:** `PartsCatalog` não tem custo de aquisição, referência
   interna/SKU, EAN, margem ou categoria livre; `category` é
   `PartCategory` restrito a tipos de componentes de reparação, e
   `defaultPrice` é obrigatório. Implementar modelo adequado a
   artigos comerciais, sem apagar custo/PVP/margem/código de barras
   nem converter automaticamente para `OTHER` sem auditoria.
5. **Fornecedores:** `Supplier` aceita NIF, nome e contacto, mas falta
   proveniência externa estável e campos completos de morada/
   condições comerciais. Identidade de cliente e fornecedor deve
   continuar partilhável sem fundir historicamente pessoas distintas.

### Ordem de implementação segura

- **Fase A: base de migração:** criar proveniência única por
  `(sourceSystem, sourceEntity, sourceId)` e recibos de importação,
  mantendo dados de origem intactos, idempotência e hashes de conteúdo.
  Criar *dry-run* detalhado com resolução explícita de conflitos,
  impacto sobre dados existentes e contagens por entidade.
- **Fase B: adaptar entidades:** clientes/contactos, equipamentos físicos,
  serviços sem preço, artigos de stock com custo e PVP e fornecedores;
  testar as rotas e formulários existentes após cada migração do esquema.
- **Fase C: aplicar com aprovação:** importação Misto (4002) apenas após
  backup verificável, relatório dry-run aprovado, permissões de
  administrador e reconciliação de todos os 3 066 registos.
- **Fase D: fichas de reparação:** importar todas as obras abertas/
  concluídas, transições, notas e anexos após obter a exportação
  completa do fornecedor; manter serviços antigos em consulta.

**PROIBIDO:** enviar os XLSX de clientes para o GitHub, usar o importador
genérico atual como atalho, gerar telefones fictícios, substituir
preço desconhecido por zero ou sobrescrever dados antigos sem plano de
reversão e aprovação.
