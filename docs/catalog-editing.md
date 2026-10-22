# Catálogos e edição de linhas nas reparações

Esta atualização permite editar o nome, quantidade, tipo, categoria, fornecedor e preço das peças aplicadas numa reparação, conforme as permissões do utilizador. Os serviços aplicados também podem ser editados. As reparações em estado terminal mantêm as restrições existentes.

Uma alteração de quantidade ajusta apenas a diferença no stock, dentro de uma transação. A edição do nome ou preço não movimenta stock. As linhas conservam a ligação ao artigo ou serviço e os seus dados históricos; editar o catálogo não altera automaticamente reparações anteriores.

Os seletores permitem pesquisar artigos, serviços, clientes e fornecedores. É possível criar peças, serviços, fornecedores e clientes durante o preenchimento, quando o utilizador tem autorização. Os fornecedores antigos guardados apenas como texto continuam visíveis; a ligação a um fornecedor da base de dados é escolhida explicitamente.

As categorias adicionais suportam subcategorias, alteração do nome, mudança de categoria superior e desativação. Existem categorias para peças, serviços, clientes, fornecedores, encomendas, tickets e acordos comerciais. Os tipos base existentes são preservados. Os filtros dos catálogos incluem as subcategorias da categoria selecionada.

Os novos seletores consultam o servidor durante a pesquisa. Os controlos de estados e outros valores fixos mantêm as opções próprias de cada módulo. Esta atualização não transforma todos os campos livres da aplicação em seletores.

## Validação

- Testes de edição de linhas: diferenças de stock, insuficiência de stock, preços, permissões e isolamento por reparação.
- Testes de categorias: hierarquia, ciclos, duplicados, âmbito e permissões.
- Testes dos seletores e criação durante o preenchimento.
- Migrações verificadas num PostgreSQL PGlite, incluindo preservação de um artigo anterior à migração.
- Traduções novas escritas localmente em português e inglês; francês e espanhol usam inglês para estas novas mensagens.

A atualização requer a migração Prisma incluída. O arranque habitual do contentor aplica as migrações. Deve ser feito um backup antes da atualização.

## Seletor único e revisão dos formulários

Os formulários de criação e edição de peças/serviços e de linhas aplicadas apresentam agora um único seletor de categoria. Inclui os tipos históricos e as categorias personalizadas; estas últimas mantêm a gestão de nomes e hierarquia. O tipo histórico é conservado internamente quando se escolhe uma categoria personalizada. Os filtros dos catálogos usam o mesmo seletor, com apenas uma categoria ativa de cada vez.

A revisão acrescenta:

- Edição dos dados de um RMA, incluindo fornecedor, peça e reparação associada. As referências opcionais podem ser limpas; o ciclo dos estados mantém as suas regras.
- Pesquisa de peças e criação de artigos durante o preenchimento do RMA. A criação de um artigo não constitui receção ou devolução de stock do RMA.
- Pesquisa de reparações por código nos RMAs e tarefas; pesquisa de responsáveis nas tarefas e na sua edição.
- Acesso à edição do fornecedor na sua própria ficha, reutilizando o formulário existente.
- Edição de retomas em proposta (`OFFERED`), com nova assinatura antes de guardar alterações ao documento. O cliente original mantém-se associado. Retomas já compradas/vendidas mantêm as restrições do servidor.
- Correção do motivo de uma devolução aberta, respeitando a permissão de edição e o acesso às devoluções do próprio utilizador. As ligações históricas à reparação e à linha reclamada são preservadas.
- A pesquisa remota aceita os resultados do servidor, incluindo correspondências por contacto que não constam do nome mostrado.

Os estados e valores fixos continuam a usar os controlos próprios dos módulos. Campos de texto livre, valores monetários e datas mantêm os seus formatos. Esta revisão não altera credenciais, configurações de rede ou dados do servidor.
