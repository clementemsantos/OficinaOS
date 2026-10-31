# Inovito — Reconciliação WooCommerce paginada (somente leitura)

Esta fase acrescenta ao painel `/inovito` uma reconciliação de até **5 páginas de 25 encomendas** (máximo 125 por consulta sequencial), começando pelo domínio `https://inove.pt` e extensível a outras lojas previamente aprovadas.

## O que faz

- Utiliza a ligação privada WooCommerce **Read** e consulta apenas identificador, número, estado, total, moeda e data de modificação.
- Mostra 25 registos por página, com «Página anterior» e «Página seguinte».
- Cruza cada encomenda com `IntegrationReceipt` usando o par `source = WOO:<origem>` e `externalId = id`, que é a identidade utilizada pelo importador legado `syncWoo`.
- Procura adicionalmente sinais conservadores de duplicação através de recibos Woo com outra origem e registos `PurchaseOrder` cujo `reference` seja igual ao ID e cujo título comece por «WooCommerce #».
- Classifica `already_recorded` (registo correspondente na origem exata), `possible_duplicate` (correspondência ambígua que pode pertencer a outra loja), `excluded_status` (cancelada/falhada/apagada/reembolsada) e `not_recorded` (sem prova de registo).
- **Nenhuma categoria é uma autorização para importar** e a aplicação não disponibiliza botão de importação. Os resultados são uma análise de risco sem ações de escrita.

## Limites e cuidados

- Uma encomenda com ID igual noutras lojas pode ser apenas uma coincidência. A indicação «Possível duplicado» exige verificação de origem e encomenda.
- A ordenação por última modificação pode mudar entre páginas se ocorrerem novas vendas durante a análise. Não existe nesta fase snapshot ou cursor estável; os totais **são sempre por página**, não devem ser somados como contagem definitiva de encomendas únicas.
- Mesmo `not_recorded` não garante que uma encomenda esteja ausente: entradas manuais ou origem historicamente diferente podem não ser identificadas.
- Não sincroniza estados, IVA, reembolsos, produtos, clientes, faturas nem stock. Essas operações dependem de reconciliação fiscal e de uma decisão explícita sobre a origem de verdade.
- Para proteção de dados e desempenho, o endpoint limita `page` a 1–5 e `limit` a 5–25. Só o proprietário autenticado o pode consultar.
- Se a instância não tiver as novas migrações e ligações privadas instaladas, a funcionalidade permanece indisponível. A ligação do WordPress por si só não ativa o código do Inovito.

## Preparação para testar no servidor

1. Confirmar backup **restaurável** da base de dados da instância de testes e dos anexos; guardar também o commit/imagem Docker anterior.
2. Atualizar **apenas a instância de testes**, depois de rever a sequência de PRs dependentes #10–#19; testar migrações e permissões de utilizador.
3. Ativar `INOVITO_WOO_PRIVATE_ENABLED=true` apenas na instância de testes **privada e autenticada**, fora de modo DEMO/SANDBOX. `INOVITO_SITE_ORIGINS=https://inove.pt`.
4. Criar chaves WooCommerce REST API com permissões **Read**, colocá-las diretamente no formulário da instalação de testes através de HTTPS; não partilhar segredos no GitHub nem no chat.
5. Abrir `/inovito` e executar «Simular importação»; comparar IDs e estados com a loja e com o histórico real de importações do OficinaOS.
6. Confirmar que repetir a análise não altera contagens de encomendas, stock, clientes, faturas nem os `IntegrationReceipt`.

Rollback: desativar `INOVITO_WOO_PRIVATE_ENABLED`, reverter a imagem de testes para o commit anterior e restaurar o backup apenas se necessário; não apagar nem reverter bases de produção.

## Comandos de validação CI

```sh
bun run db:generate
bun run typecheck
bun run test -- server/__tests__/inovito-woo-private.test.ts
bun run check
VITE_INOVITO_VOICE_ENABLED=true bun run build
```

**Sem deploy na produção, sem leitura efetiva da base do utilizador e sem importações reais nesta fase.**
