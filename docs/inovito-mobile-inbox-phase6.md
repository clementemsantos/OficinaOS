# Inovito — Gmail e webhook Meta, validação móvel (fase 6)

Esta fase depende do PR #14 e não foi implementada na loja de produção.

## Correio eletrónico no telemóvel

A ligação Google (quando configurada por OAuth no OficinaOS) consulta até **5 e-mails não lidos** e apresenta apenas os cabeçalhos **From** e **Subject** na página `/inovito`. Utiliza o âmbito já previsto `gmail.metadata`, sem pedidos de acesso ao corpo ou aos anexos. Não envia e-mails, não marca mensagens como lidas, não as grava no CRM nem devolve dados de mensagens no histórico do Inovito. Os cabeçalhos têm limite de tamanho e caracteres de controlo removidos.

Na utilização real, os assuntos podem conter dados pessoais: não utilizar o ecrã com clientes presentes e aplicar HTTPS, sessão pessoal e bloqueio do telemóvel. O Gmail exige consentimento da conta Google e eventual verificação do projeto OAuth.

## Testes Meta com protocolo HTTP

O teste `inovito-meta-http.test.ts` usa Fastify `inject`, sem chaves reais nem acesso a mensagens:
- endpoint fechado por omissão;
- rejeição de POST não assinado com HTTP 401;
- aceitação de JSON com assinatura HMAC correta, mas **sem gravação** em modo dry-run.

As flags `INOVITO_META_WEBHOOK_ENABLED` e `INOVITO_META_CAPTURE_ENABLED` permanecem desligadas por defeito. A captura e quaisquer respostas automáticas exigem autorização empresarial e testes end-to-end.

## Dependências antes de utilização

1. Resolver e integrar o PR independente de segurança do `better-auth` (com lockfile atualizado, testes e rollback).
2. Concluir a cadeia de PRs do Inovito em ambiente separado da produção.
3. Usar HTTPS com DNS próprio de testes; não abrir diretamente as portas do Docker/PostgreSQL na Internet.
4. Configurar as credenciais OAuth Google e os webhooks Meta **exclusivamente no servidor**, confirmar consentimento e testar com dados fictícios.
5. Testar instalação PWA e autenticação no Android e no iPhone e verificar revogação de acessos.

Rollback: desativar as flags experimentais, desligar as integrações nos respetivos serviços, voltar à imagem Docker de testes anterior, sem mexer nas bases de dados de produção.
