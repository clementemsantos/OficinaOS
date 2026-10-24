# Evolução do OficinaOS Misto para CRM/ERP

## Esta entrega

- Corrige a abertura das encomendas em HTTP da rede local: os identificadores usam `crypto.getRandomValues`, sem depender de `crypto.randomUUID`.
- Corrige a reposição do foco ao editar peças. A criação de uma peça não submete o formulário da linha nem a encomenda. É necessário aplicar a linha e guardar a encomenda.
- Uma peça nova sem custo de aquisição fica com margem pendente até confirmar o custo, evitando apresentar lucro com base num custo desconhecido.
- Acrescenta `/marketing`, para administradores: campanhas locais e oportunidades comerciais ligadas aos clientes existentes.
- Campanhas: canal, estado local, objetivo/público, orçamento previsto, despesa acumulada introduzida manualmente, datas e página de destino.
- Oportunidades: cliente existente opcional, campanha, etapa comercial, valor estimado, próximo contacto e notas. As encomendas desse cliente são acessíveis a partir da tabela.
- Pesquisa e paginação, edição com proteção contra versões antigas e registo de auditoria. Não são criados clientes duplicados para guardar oportunidades.
- Custo por oportunidade e ROAS estimado usam todas as oportunidades ligadas a cada campanha, independentemente da página visível. ROAS usa valores estimados de oportunidades ganhas; não é lucro nem atribuição confirmada.

A área é manual e local. Os estados «Ativa» e «Em pausa» não mudam anúncios reais. Não existe ligação ativa a contas Google Ads ou Meta nesta entrega. As ligações abrem os portais dos fornecedores; não enviam dados do CRM, não criam anúncios, não enviam campanhas nem alteram verbas. Os recebimentos, caixa e documentos fiscais existentes não são alterados por métricas de marketing.

## Próximas etapas propostas

1. Consolidar o núcleo ERP: encomendas, compras, peças, fornecedores, RMAs, recebimentos e reconciliação de caixa. Manter uma origem única para cada valor e impedir contagens duplicadas entre encomenda, reparação e venda.
2. Consolidar o CRM: histórico único por cliente, oportunidades, seguimentos e conversão explícita em orçamento/encomenda. Separar pedidos de assistência de vendas e guardar a origem da oportunidade.
3. Ligar Google Ads e Meta inicialmente para leitura: escolher conta autorizada, identificar campanhas por ID externo e importar métricas com data, moeda e origem. Nunca somar métricas importadas a valores manuais do mesmo período.
4. Gestão de anúncios: preparar rascunhos e comparação com o estado da plataforma. Publicação e alterações de orçamento exigem confirmação clara do conteúdo, conta, montante e período.
5. Comunicação: reaproveitar os consentimentos de contacto já existentes. Uma oportunidade ou um cliente registado não constitui autorização para enviar publicidade.

As integrações externas exigem configuração e autorização das contas nas plataformas. Não guardar palavras-passe ou tokens no código nem em campos de notas.

## Referências para a futura integração

- Google Ads API, autorização: https://developers.google.com/google-ads/api/docs/oauth/overview
- Meta Business SDK e Marketing API: https://github.com/facebook/facebook-nodejs-business-sdk

Consultar os requisitos atuais de acesso e as permissões antes de implementar os conectores. Esta entrega não fixa versões, tokens ou fluxos de autenticação desses serviços.
