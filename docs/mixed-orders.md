# Peças e produtos nas encomendas

A encomenda pode ter o tipo **Produtos**, **Peças** ou **Peças e produtos**. O tipo identifica a encomenda inteira; as linhas continuam a representar os artigos individuais e podem ligar-se ao catálogo de inventário ou ter descrição manual.

Na ficha, **Adicionar peça ou produto** abre uma linha com pesquisa no inventário. Se o artigo ainda não existe, pode ser criado nessa pesquisa; o formulário de criação usa termos comuns a peças e produtos. O inventário é partilhado, sem criar catálogos duplicados.

Cada linha mantém quantidade, referência, fornecedor, custo, preço ao cliente, IVA e margem. O tipo misto não movimenta stock, não cobra pagamentos e não altera as fórmulas financeiras. Existe também filtro **Peças e produtos** na lista.

Migração `20261121000000_mixed_purchase_orders`: alarga a restrição do tipo e permite a referência antiga de peça no cabeçalho de uma encomenda mista, mantendo as validações de custos e IVA. Não modifica encomendas existentes. Não distingue automaticamente peças de produtos por linha nem reclassifica artigos antigos.

Instalar no servidor com o procedimento habitual `git pull --ff-only origin inove/release-candidate` e `bash scripts/update-misto.sh`. Depois de health OK, Ctrl+F5.
