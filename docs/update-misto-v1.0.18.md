# OficinaOS Misto: integração da v1.0.18

Base original: `braindeadpt/OficinaOS`, tag `v1.0.18`, commit `e25dfaea96ea99aa39826578755fdb6de095e9bf`.

Integra as alterações da versão original sem substituir as funcionalidades da Inove: encomendas com linhas/estados/filtros, pagamentos, RMAs, anexos, Atlas, importações, CRM e marketing. Mantém Dockerfile.node, compose.misto.yaml e as adaptações para HTTP da rede local. O modo Misto continua a respeitar OFICINAOS_SANDBOX; integrar a atualização não ativa envios nem processos externos.

As 94 migrações já existentes permanecem byte a byte iguais. A nova migração de cursores e responsáveis das regras de tarefas foi colocada em `20261119000000_task_rules_cursor_assignee`: o timestamp original de upstream, `20261109000000`, já está usado no Misto. Apenas a migração nova, nunca aplicada no Misto, recebe outro nome. Mantém a limpeza dos responsáveis que já não existem antes de criar a chave estrangeira.

## Instalação no servidor

Na pasta `~/OficinaOS-misto`, obter a branch personalizada e executar o instalador:

```bash
git pull --ff-only origin inove/release-candidate
bash scripts/update-misto.sh
```

A alteração local de compose.misto.yaml é permitida e preservada. Outras alterações locais a ficheiros versionados fazem o instalador parar para revisão. Os ficheiros `.dump` antigos não são apagados e passam a ser excluídos da imagem Docker.

O instalador guarda um dump, verifica o seu índice, copia uploads e configuração para uma pasta privada em `/var/backups/oficinaos-misto`, constrói a aplicação e recria apenas o serviço app. Não elimina volumes nem altera os serviços das portas 4000 e 4001. A cópia dos uploads é feita com a aplicação ativa; em instalações com escritas contínuas, usar uma janela sem edições para coordenar os ficheiros com o snapshot da base de dados. A verificação do índice não substitui um ensaio de restauro completo.

O teste de saúde corre dentro do contentor, evitando confundir uma porta publicada apenas em Tailscale com um erro em 127.0.0.1 no servidor. Se falhar, o instalador mostra os logs e a localização do backup; não declara sucesso nem restaura dados automaticamente.

Isto prepara a atualização. A instalação na loja só fica confirmada depois de o comando terminar com `health OK` e de testar login, encomendas e pagamentos no navegador.
