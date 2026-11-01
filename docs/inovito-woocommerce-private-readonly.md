# Inovito — ligação WooCommerce privada por site (fase seguinte)

## Objetivo e alterações

Este ramo acrescenta **consulta privada de encomendas WooCommerce em modo de leitura**, por domínio aprovado, sem interferir com o importador global WooCommerce já existente do OficinaOS.

- O proprietário abre `/inovito` > «Os meus sites» > «Encomendas WooCommerce — consulta privada».
- Primeiro site autorizado: `https://inove.pt`. Outros domínios têm de constar de `INOVITO_SITE_ORIGINS` no servidor.
- Com a opção explicitamente ativa, o proprietário insere uma **Consumer Key** e **Consumer Secret WooCommerce** com permissão **Read**. A aplicação testa uma consulta `GET /wp-json/wc/v3/orders` sobre HTTPS, usando Basic Authentication no cabeçalho, nunca na URL. Só guarda a ligação se a consulta for bem-sucedida.
- As credenciais ficam cifradas em `inovito_woo_connections` por origem e nunca são devolvidas ao navegador, escritas em logs ou guardadas no WordPress.
- Após conexão, «Consultar últimas encomendas» apresenta **até cinco encomendas** com número, estado, valor e data de modificação. O cliente nunca recebe nome, e-mail, telefone, morada ou linhas da encomenda. A API pede apenas estes campos com `_fields` e valida a resposta.
- É possível desligar a ligação no painel e eliminar as credenciais do cofre.

## Segurança: funcionalidades desligadas por defeito

Configurar **apenas num servidor privado de testes, com HTTPS e autenticação do proprietário**:

```dotenv
INOVITO_WOO_PRIVATE_ENABLED=true
INOVITO_SITE_ORIGINS=https://inove.pt
```

A opção é **false** se não existir essa variável; também fica bloqueada quando `OFICINAOS_SANDBOX=true` ou `DEMO_MODE=true`, para não misturar chaves reais em ambientes de demonstração/partilhados. Não colocar credenciais no repositório, em screenshots ou no chat.

O utilizador tem de criar chaves de **leitura** na administração WooCommerce (WooCommerce > Configurações > Avançado > API REST > Adicionar chave). Esta operação deve ser feita diretamente pela pessoa autorizada na loja, sem copiar os segredos para conversas.

O endpoint está sob `/api/inovito`, que exige sessão do proprietário; os pedidos autenticados POST/DELETE também utilizam as proteções CSRF normais do OficinaOS. O transporte de saída herda `integrationJson`, com TLS obrigatório, verificação de IP público, DNS fixado, limite de resposta e sem redirecionamentos. Só são aceites origens pré-configuradas no servidor.

## Importação e stock: não realizados nesta fase

**Isto não é uma sincronização bidirecional.** O importador global anterior, em `IntegrationConnection(kind=WOOCOMMERCE)`, continua a importar encomendas e só suporta um único site. As chaves privadas multi-site desta fase **não disparam** esse importador.

Para importar encomendas de múltiplos sites com segurança, preparar numa fase posterior:
1. cursor de alteração e lease por site;
2. origem persistente por encomenda e idempotência `siteId + orderId` para impedir duplicações;
3. reconciliação de alterações de estado e devoluções;
4. mapeamento de IVA, clientes e artigos;
5. decidir qual sistema gere stock e preços — não publicar movimentos em dois sentidos sem regras de conflito e auditoria.

## Validação e rollback

- `bun run db:generate`
- `bun run db:migrate-deploy` **somente na base de dados de testes após backup**
- `bun run test -- server/__tests__/inovito-woo-private.test.ts`
- `bun run typecheck`
- `bun run check`
- `VITE_INOVITO_VOICE_ENABLED=true bun run build`
- Teste em HTTPS de chave válida de leitura, chave inválida, expiração/revogação, acesso de utilizador sem permissão, desligar ligação e rejeição de URL interna.

Para desativar sem migração: `INOVITO_WOO_PRIVATE_ENABLED=false` e reiniciar/reconstruir o serviço. Para eliminar credenciais guardadas, usar «Desligar ligação» após ativar temporariamente a funcionalidade em ambiente seguro, ou executar a retenção/limpeza aprovada. A migração é aditiva e não altera outras tabelas.

**Não foram executadas importações, alterações de stock, preços ou encomendas no inove.pt nem no OficinaOS de produção.**
