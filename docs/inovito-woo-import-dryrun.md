# Inovito — simulação WooCommerce sem importação (fase de reconciliação)

## Objetivo

Permitir identificar possíveis encomendas novas ou já importadas antes de qualquer escrita. A página `/inovito` > «Os meus sites» > ligação WooCommerce privada mostra «Simular importação» apenas quando o site está ligado e a funcionalidade `INOVITO_WOO_PRIVATE_ENABLED=true` está ativa.

O resultado usa **exclusivamente leitura**:
- Consulta até cinco encomendas recentes com os campos limitados `id, number, status, total, currency, date_modified_gmt`;
- Consulta as chaves `integration_receipts(source, externalId)` do OficinaOS, no formato usado pelo importador existente: `source = WOO:<origem HTTPS>` e `externalId = id WooCommerce`;
- Classifica cada uma como **já registada**, **sem registo nesta origem** ou **estado excluído** (cancelled/failed/trash/refunded). Um pedido já registado tem prioridade na classificação, mesmo que agora esteja cancelado;
- Mostra totais da amostra e um aviso de que os pedidos sem registo **ainda não são elegíveis para importação automática**.

Nenhuma encomenda, contacto, linha de artigo, preço, stock, fatura, estado ou registo de importação é criado, atualizado ou apagado.

## Limitações importantes

- A amostra é de **cinco** encomendas recentes, não é uma reconciliação completa da loja.
- A procura de duplicados só reconhece recibos guardados com a origem HTTPS **exatamente igual**. Importações legadas com www/outros esquemas ou importações manuais podem exigir correspondência adicional e revisão humana.
- A ausência de recibo não prova que uma encomenda possa ser importada: faltam validar dados pessoais, clientes já existentes, linhas de artigo, IVA, descontos, devoluções e regras de reconciliação.
- Os resultados só estão disponíveis para sessão do proprietário e não devolvem dados de faturação dos clientes.

## Verificação e futura ativação

1. Confirmar que o PR de ligação privada WooCommerce está integrado numa **instalação de testes** do OficinaOS, com backup verificado.
2. As chaves do site devem ter apenas permissão `Read`. Não partilhar chaves no chat, repositório ou documentação.
3. Verificar no painel «Ligação guardada» e executar «Simular importação».
4. Comparar a amostra com o histórico de encomendas no WooCommerce e com os registos importados no OficinaOS.
5. **Não ativar importação nem alteração de stock** nesta fase. Uma futura importação deverá ter cursor por site, leases, transações idempotentes, validação fiscal e procedimentos de recuperação e auditoria.

## Testes e rollback

`bun run db:generate`
`bun run typecheck`
`bun run test -- server/__tests__/inovito-woo-private.test.ts`
`bun run check`
`VITE_INOVITO_VOICE_ENABLED=true bun run build`

Rollback: desativar `INOVITO_WOO_PRIVATE_ENABLED` ou regressar à versão anterior do Inovito. Esta fase não cria tabelas nem altera dados.

**Não foi feita implantação nem sincronização real de encomendas nesta fase.**
