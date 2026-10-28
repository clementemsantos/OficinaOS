# OficinaOS Misto — cobertura funcional comparada com o Revolio

Comparação de capacidades públicas em 28-10-2026. Não é uma auditoria da aplicação privada do Revolio nem uma declaração de equivalência. O código, marca, imagens e dados do Revolio não foram copiados.

Fontes oficiais consultadas:

- https://www.revolio.io/en/features
- https://www.revolio.io/en
- https://help.revolio.com.br/pt-BR

## Critérios

**Existente** significa código implementado no Misto, não necessariamente uma integração já configurada na loja. **Parcial** indica limites importantes descritos na coluna seguinte. **Pendente** não aparece como funcionalidade disponível. Credenciais, contratos e instalações de fornecedores externos não são criados automaticamente.

| Capacidade pública | Cobertura no Misto | Evidência / próximo passo concreto |
| --- | --- | --- |
| Reparações, orçamento, aprovações, etapas e acompanhamento | Existente | `server/routes/jobs.ts`, quotes, tracking e portal. O acesso público depende da rede/Cloud configurada. |
| POS, vendas e pagamentos presenciais | Parcial | Vendas e registos de pagamentos existem; não existe cobrança Stripe Terminal / tap-to-pay. |
| Stock, fornecedores e compras | Existente | Catálogo, movimentos, fornecedores e encomendas com linhas, custos e margens. |
| Sugestões de reposição | Existente, agora reunida em Gestão da loja | Reutiliza `restock-forecast.service.ts`: consumo histórico de 30 dias, até 50 peças. Não desconta encomendas pendentes nem prevê sazonalidade. |
| CRM e histórico do cliente | Existente | Clientes, reparações, vendas, mensagens e documentos ligados. |
| Identificação de clientes sem atividade recente | Novo | `/operations`, separador Clientes a recuperar. Considera reparações, vendas e encomendas; exclui clientes com reparações em curso. Não contacta ninguém automaticamente. |
| Garantias e devoluções | Parcial, consulta global nova | Reclamações e RMA existentes; novo filtro de prazos ativos, a terminar, terminados e desconhecidos por serviço entregue. Usa configuração atual, não um certificado imutável de garantia. |
| Cupões e fidelização por pontos | Pendente | Requer livro de movimentos, regras, utilização atómica no checkout e reversões ligadas às devoluções. Não representar descontos manuais como pontos já implementados. |
| Preços por dispositivo/serviço e importação/exportação | Parcial | Catálogos e importadores existentes; falta matriz unificada de variantes com preços por dispositivo. |
| Equipa, técnicos e permissões | Existente | Administrador também pode atuar como técnico; permissões aplicadas no servidor. |
| Quadros, notas e tarefas internas | Parcial | Tarefas universais, regras automáticas e notas existem. Não existe um quadro livre de sticky notes. |
| Inbox WhatsApp, SMS, email e chat | Parcial | Registos ligados a processos, IMAP para captura de email, transportes próprios de WhatsApp/SMS. Não é uma integração completa de todas as caixas sociais. |
| Agente IA que responde e age com aprovação | Parcial | Assistente e fornecedores de modelos (incluindo Gemini) existentes. Não existe equivalência ao agente Lemar nem execução autónoma de vendas/atendimento. |
| BI e métricas da operação | Existente | Relatórios de receitas, caixa, encomendas, peças, devoluções e insights. Separar valores estimados de recebimentos reais. |
| Campanhas e recuperação comercial | Parcial | Campanhas e oportunidades manuais, mais nova lista de clientes a recuperar. Sem sincronização Google Ads / Meta Ads. |
| Loja online e domínio próprio | Parcial | Storefront/Cloud existentes; WooCommerce importa encomendas. Não existe sincronização bidirecional de todos os stocks, preços e pagamentos. |
| Faturação certificada por integração | Parcial | Adaptador InvoiceXpress existente, sujeito a conta/módulo e configuração. Moloni, Fiz e Vendus não implementados. O Misto não se apresenta como software fiscal certificado. |
| Entregas, recolhas e rastreio de transporte | Pendente | Referências/notas manuais não equivalem a etiquetas e expedição via transportadora. |
| Cupons, promoções e recuperação automatizada | Parcial | Remarketing WhatsApp existente depende da configuração e consentimento. Cupões transacionais pendentes. |
| Catálogo partilhado / hub de peças | Parcial | Procuro-peça e fornecedores locais existentes. Não existe acesso à rede comercial privada Revolio. |
| Rede de reparações / marketplace | Pendente | Uma rede de parceiros real exige adesão e operação; não é criada por adicionar um ecrã. |
| Multiloja / franchises | Parcial | Métricas agregadas Cloud existentes; não equivale a isolamento multi-tenant, stock e gestão transacional entre lojas. |
| Aplicações e APIs para terceiros | Parcial | API interna e integrações específicas; não existe loja de aplicações com permissões, instalação e atualização de extensões. |
| Telemóvel | Existente / dependente da instalação | Web responsiva e projeto Android Capacitor. Não foi publicada uma nova app Android ou iOS nesta entrega. |
| Proteção e migração de dados | Parcial | Importações, cópias locais, backup remoto encriptado preparado. A conta remota e teste de recuperação da loja continuam a precisar de configuração/execução. |

## Próximas entregas técnicas

1. Fidelização e cupões: política de atribuição explícita; livro imutável; idempotência; utilização sem duplicação; anulação proporcional em devoluções; cobertura dos diferentes tipos de checkout.
2. Caixa e cobranças: distinguir registo manual de liquidação efetiva; integração de fornecedor com webhook autenticado, replays e reconciliação; nunca emitir cobrança ao ativar uma opção de configuração.
3. Faturação e transporte: escolher os serviços realmente usados pela Inove; implementar adaptadores e testar contas sandbox antes de ligar emissão/expedição real.
4. Inbox completo: sincronização e envio bidirecionais com autorização, anexos privados, associação ao cliente/processo e prevenção de mensagens duplicadas.
5. Agenda, matriz de preços, quadros e fidelização: concluir fluxos com interface, permissões, auditoria e testes, sem publicar botões que apenas simulem integrações.
6. Multiloja, marketplace e aplicações: projetos separados com isolamento e operação próprios; não ativar por copiar módulos visuais.

Esta entrega não conclui todas as capacidades acima. O mapa mantém explícito o trabalho restante.
