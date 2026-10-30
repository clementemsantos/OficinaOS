# Inovito JARVIS — integração com sites WordPress / WooCommerce

## Estado desta fase

A loja WordPress **https://inove.pt** foi verificada com a ligação WPVibe (acesso de leitura) em 30/10/2026. Confirmado WooCommerce ativo e existência de produtos publicados no endpoint Store API. O OficinaOS já possui importação independente de encomendas WooCommerce com credenciais cifradas, uma fonte de cada vez; a integração do Inovito **não duplica essa importação nem altera o site**.

## Implementado no OficinaOS (ramo de testes)

- Painel móvel `/inovito` com secção «Os meus sites», responsável por consultar os sites autorizados ao carregar e ao carregar no botão «Atualizar sites».
- Site predefinido: `https://inove.pt`; devolve até **cinco produtos publicados** com nome, link na mesma origem e preço em PT-PT.
- Consulta feita no servidor via **WooCommerce Store API pública**, sem consumer keys, sem acesso a produtos em rascunho, clientes, encomendas, dados de checkout ou configuração WordPress.
- Endpoints apenas para sessão proprietária: `GET /api/inovito/sites`. Mostram também se o **importador WooCommerce já existente** está configurado, ativo, se tem erro e data da última sincronização, sem divulgar credenciais.
- Outros sites WordPress/WooCommerce podem ser acrescentados **apenas pelo administrador do servidor**, definindo no ambiente `INOVITO_SITE_ORIGINS` como lista de origens HTTPS separadas por vírgula.
- Sem credenciais ou cookies enviados para os sites de terceiros, sem mudança de preços e sem processos de sincronização em segundo plano. As informações são consultadas em tempo real quando o utilizador abre ou atualiza o painel.
- Páginas API que não respondem são assinaladas como indisponíveis, sem bloquear os outros sites.

## Adicionar outro site no futuro

Exemplo na configuração **do servidor de testes**, não no navegador:

```dotenv
INOVITO_SITE_ORIGINS=https://inove.pt,https://loja.exemplo.pt
```

O domínio tem de ser previamente aprovado pelo administrador. Os endereços não podem ter caminhos, query, credenciais, portas alternativas nem usar HTTP. O cliente não aceita URLs livres: a origem é definida pelo servidor, e a ligação HTTP reutiliza `integrationJson` com TLS, resolução DNS verificada, endereço IP público e DNS fixado para impedir acesso à rede interna e ataques de DNS rebinding. Redirecionamentos não são seguidos. Máximo de oito sites configurados.

Para um site **não-WooCommerce**, será necessário um adaptador específico (por exemplo WordPress REST API ou API do próprio CMS), sujeito às mesmas regras de segurança. Esta fase só consulta **produtos publicados WooCommerce**.

## Próximas etapas de verdadeira sincronização de negócio

1. Avaliar a ligação privada do importador WooCommerce já existente ao `inove.pt`, com Consumer Key/Secret criadas na administração do WooCommerce e permissões mínimas, sem compartilhar chaves no chat.
2. Evoluir `IntegrationConnection` de um registo global `WOOCOMMERCE` para várias lojas identificadas por `siteId`, com credenciais cifradas por site, cursor de alterações e deduplicação de encomendas por `siteId + orderId`.
3. Acrescentar sincronização incremental de produtos/stock numa **única direção** por enquanto, e definir qual sistema é a origem de verdade de preços/stock para evitar alterações circulares; não assumir que OficinaOS e WooCommerce têm o mesmo IVA/margens.
4. Adaptar o chatbot/mascote Inovito já instalado em WordPress para consumir um serviço central seguro, com consentimento e isolamento entre negócios/sites, sem divulgar dados de clientes entre sites.
5. Testar autorização, RGPD, backup, respostas do assistente e notificações em Android/iPhone e só depois integrar produção.

## Testar / rollback

- `bun run typecheck`
- `bun run test -- server/__tests__/inovito-sites.test.ts`
- `VITE_INOVITO_VOICE_ENABLED=true bun run build`
- `bun run check`
- Teste manual `https://inove.pt/wp-json/wc/store/v1/products?per_page=5` e página `/inovito` em HTTPS com utilizador proprietário.
- Para desativar um site, retirar o domínio de `INOVITO_SITE_ORIGINS`; sem tabela nova, sem alterações de dados, sem migrações associadas a esta fase.
- Não publicar enquanto os PRs de segurança e todas as fases anteriores do Inovito não estiverem integrados e ensaiados.

**Nenhuma configuração de produção foi alterada nesta fase.**
