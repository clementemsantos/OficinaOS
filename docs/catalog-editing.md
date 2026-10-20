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
