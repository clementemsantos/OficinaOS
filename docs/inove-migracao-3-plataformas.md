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
