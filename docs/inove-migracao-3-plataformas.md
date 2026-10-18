# Migração Inove.pt — HelloClient, HubSpot e Keymaster → OficinaOS Misto

**Estado: levantamento / preparação. Nenhuma importação destas plataformas foi efetuada.**

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
