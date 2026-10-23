# Encomendas com várias linhas de produtos

Cada encomenda tem uma ficha com título, cliente, fornecedor principal, referência, categoria, ligação à reparação e notas. A tabela de produtos permite adicionar, editar e remover até 100 linhas, antes de guardar a encomenda.

Cada linha guarda uma descrição, quantidade inteira de 1 a 10 000 unidades, custo unitário com IVA, preço unitário ao cliente com IVA, taxas de IVA da compra e venda e a opção de deduzir o IVA da compra. Pode também guardar uma referência, fornecedor e ligação de compra próprios.

É possível pesquisar no inventário, criar um artigo durante o preenchimento ou usar uma descrição livre. Os valores sugeridos do catálogo podem ser ajustados na linha. As linhas guardam os seus próprios nomes e preços: futuras alterações ao catálogo não reescrevem encomendas anteriores.

## Totais e edição

Os totais são calculados no servidor em cêntimos inteiros. As taxas de IVA podem variar entre linhas. O valor líquido é arredondado por linha, depois de multiplicar pela quantidade; a margem global resulta da soma dos valores líquidos e custos efetivos, conforme a dedutibilidade do IVA. Não se calcula uma média das taxas.

As alterações à ficha e linhas são guardadas numa única transação. As linhas existentes mantêm os seus IDs; uma linha omitida é removida apenas da encomenda correspondente. O servidor rejeita IDs de linhas de outras encomendas. Cada edição de linhas envia a versão original da encomenda; se outra pessoa a tiver alterado, o servidor devolve um conflito e mantém os dados existentes. O formulário mantém a edição local e informa que é necessário voltar a carregar a encomenda.

Criar, editar ou remover linhas não movimenta stock. A criação de um artigo pode registar o stock inicial indicado no formulário do inventário, mas a encomenda não representa uma receção física de mercadoria.

## Compatibilidade e permissões

A migração cria uma linha por encomenda antiga, com quantidade 1, conservando valores, IVA, fornecedor, artigo, referência e ligação de compra. Encomendas sem artigo de inventário usam o título como descrição. Os cabeçalhos antigos são preservados.

Os leitores precisam de acesso ao catálogo; custos, preços, taxas e margens continuam protegidos pela permissão `parts:viewCost`, incluindo os valores dentro das linhas. A criação e edição exigem `parts:manageCatalog` e `parts:viewCost`. Os estados, tarefas e histórico mantêm as ligações à encomenda. O filtro por fornecedor inclui fornecedores das linhas, além do fornecedor principal.

A API aceita criações antigas sem uma lista de linhas e converte-as numa linha. Alterações antigas apenas à ficha conservam os produtos. Alterações financeiras no formato antigo só são aceites quando existe uma única linha com quantidade 1; encomendas com várias linhas devem usar a edição de linhas.

Antes de instalar, fazer backup da base de dados. O arranque habitual da aplicação aplica a migração incluída. Esta atualização integra-se na branch `inove/release-candidate` do Misto.

## Fornecedores que faturam sem IVA

A ficha do fornecedor e a criação rápida têm a opção **Fornecedor cobra IVA na compra**. Está ativa por defeito, conservando a configuração dos fornecedores existentes. Desativá-la define uma preferência para as novas linhas de encomenda associadas a esse fornecedor: a taxa de IVA cobrada pelo fornecedor passa a 0%, sem alterar o custo introduzido nem o IVA da venda ao cliente.

Cada linha tem a opção **Sem IVA na fatura do fornecedor**, que pode ser ajustada para a fatura concreta. As linhas já gravadas ou já editadas no formulário conservam os valores guardados ao serem reabertas. A preferência não é aplicada retroativamente e não é uma obrigação fiscal imposta pelo servidor.

Esta opção regista o IVA da fatura do fornecedor. Não calcula autoliquidações nem confirma uma isenção fiscal. Nas aquisições intracomunitárias pode ser necessário declarar IVA em Portugal e tratar o respetivo direito à dedução. Esses lançamentos fiscais, nomeadamente eventual IVA autoliquidado não dedutível, são tratados separadamente na contabilidade. As margens apresentadas resultam dos custos e impostos registados nas linhas.

## Lista e referência das encomendas

A página inicial apresenta uma tabela com referência, descrição, cliente, fornecedor, data, custo, total do cliente e margem (os valores financeiros respeitam as permissões existentes). A referência automática `EN-000001` é única e permanece estável. A referência externa já existente mantém-se separada e não é substituída.

Clicar na referência ou em «Abrir encomenda» abre apenas essa ficha, com as linhas de produtos, edição, totais, margem, tarefas, ficheiros e histórico. «Todas as encomendas» regressa à tabela. A migração atribui números às encomendas antigas sem modificar os seus valores ou referências externas.

## Estado e filtros da lista

A tabela apresenta o estado configurável da encomenda. Na ficha, o seletor de estado fica junto dos dados principais, separado da área de tarefas e anexos, que abre expandida. Mantêm-se linhas, custos, orçamento, IVA, margem e histórico.

Os filtros por pesquisa, estado (incluindo sem estado), cliente, fornecedor, tipo e datas são aplicados no servidor antes da paginação. A pesquisa inclui referência EN, referência de fornecedor, descrição, nomes e produtos. Os intervalos de datas incluem todo o último dia em UTC. Os estados existentes, mesmo desativados, continuam disponíveis para consultar histórico; a atribuição continua a exigir um estado ativo.

## Orçamentos e recebimentos

A ficha tem uma área de orçamento e pagamentos. O orçamento pode ser marcado manualmente como rascunho, enviado, aceite ou recusado. Esta marcação não envia mensagens ao cliente nem recolhe uma assinatura. Cada marcação guarda uma cópia das linhas, quantidades, preços e IVA no registo de auditoria; os últimos 50 registos estão disponíveis na ficha.

Só é possível registar recebimentos depois de marcar a aceitação. São permitidos pagamentos parciais e vários métodos: numerário, cartão, transferência, MB WAY, Multibanco e outro, reutilizando as opções existentes. Mostra-se o total orçamentado, o recebido e o valor em falta. O registo inclui referência, nota, data e utilizador.

Os valores são calculados com decimais sobre as linhas reais. O servidor bloqueia pagamentos superiores ao saldo, pedidos com versões desatualizadas e duplicações da mesma confirmação. As operações são serializadas pela encomenda. Alterar linhas ou preços do orçamento devolve-o a rascunho; não é permitido baixar o total para menos do que já foi recebido.

A correção de um recebimento exige a permissão de anulação e um motivo. O registo permanece no histórico com data e responsável, deixando de contar para o total recebido. Isto não faz uma devolução de dinheiro. A consulta exige acesso aos valores e a pagamentos; registar e anular têm permissões próprias.

Estes são registos manuais da encomenda, não cobram por gateway nem emitem faturas/recibos fiscais. Não se transferem automaticamente para pagamentos de reparações/vendas ou para o fecho de caixa. Os recebimentos do WooCommerce não são importados automaticamente: confirmar a origem antes de registar um pagamento. As encomendas anteriores mantêm os valores e começam em rascunho, sem criar recebimentos fictícios.
