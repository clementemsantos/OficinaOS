# Ficheiros, WooCommerce, e-mail e backup Google Drive — OficinaOS Misto

Esta versão acrescenta código e configuração. Não liga automaticamente nenhuma conta externa. Não foi ensaiada com as contas reais da loja: é necessário configurar e validar uma importação e uma recuperação antes de depender destes serviços.

## Ficheiros

- Nova opção **Ficheiros** no menu, disponível a administradores com acesso às definições.
- PDF, faturas e outros formatos até **5 MB por ficheiro**. Os ficheiros são internos e transferidos como anexos, sem executar HTML ou scripts no navegador.
- Em cada ficha, abrir **Tarefas e estado** para encontrar os anexos. O documento da biblioteca pode ser associado a várias reparações, encomendas ou tickets.
- Remover uma associação não elimina outras associações nem os bytes do ficheiro. Esta retenção protege a recuperação; não é um mecanismo de eliminação definitiva de dados pessoais.
- Os ficheiros privados ficam em `uploads/.documents`, dentro do volume persistente, bloqueados no serviço de ficheiros estáticos. A transferência verifica as permissões da ficha.
- Isto não publica ficheiros no portal dos clientes. A partilha pública exige uma seleção e autorização próprias.

## WooCommerce → Encomendas

Em **Encomendas → WooCommerce → Configurar**, indicar o endereço HTTPS da loja, uma chave REST **só de leitura**, o respetivo segredo e a data de início. Criar a chave no WooCommerce em **Definições → Avançado → REST API**. Não enviar estas credenciais por conversa.

**Sincronizar agora** importa um lote de até 100 pedidos em EUR. Os lotes automáticos correm a cada cinco minutos quando ativados. Os cursores mantêm a paginação e a janela temporal; o mesmo pedido da mesma loja não é criado novamente. O servidor da loja inicia a ligação HTTPS: não necessita de receber webhooks da internet.

Inclui produtos, portes e taxas adicionais, com total bruto conferido com a origem. A quantidade mantém-se; quando o valor não divide exatamente pelos artigos, uma linha pode ser repartida em duas para preservar os cêntimos. O IVA é estimado a partir do valor líquido/imposto recebido e deve ser confirmado na fatura original. Não emite faturas fiscais.

O WooCommerce não fornece o custo de aquisição neste fluxo. Os custos ficam **por preencher** e a margem não aparece como lucro confirmado. Editar as linhas e confirmar os custos para obter a margem. Um custo legitimamente zero pode ser confirmado como tal.

Associa um cliente existente se o e-mail corresponder a um único registo. Caso contrário, conserva os contactos nas notas para associação manual. Não cria clientes fictícios, movimentos de stock ou pagamentos.

Não altera a loja online nem substitui edições locais. Atualizações de estado, reembolsos e cancelamentos posteriores ainda não são sincronizados. Pedidos já cancelados, falhados ou reembolsados são ignorados. Pedidos com moeda diferente de EUR, valores negativos, mais de 45 produtos/3 portes/2 taxas, ou totais não conciliáveis interrompem o lote e mostram erro; não são parcialmente convertidos nem têm valores descartados. Os pedidos concluídos anteriormente permanecem e não duplicam na repetição.

## E-mail → Conversas → Ticket

Em **Conversas → Caixa de e-mail → Configurar**, indicar servidor IMAP público, utilizador, palavra-passe de aplicação, pasta (normalmente INBOX) e data inicial. Esta primeira versão utiliza **IMAP com TLS na porta 993**, com certificado validado. Contas que só permitem OAuth (sem palavras-passe de aplicação) necessitam de um conector OAuth adicional.

A caixa é aberta só de leitura: não elimina mensagens, não muda lidas/não lidas e não envia respostas. Importa o texto, o original `.eml` e os anexos internos. Em mensagens extensas, o texto apresentado é limitado a 30 000 caracteres; o original conserva o conteúdo completo. O limite é **5 MB para a mensagem completa**, incluindo os anexos codificados. Uma mensagem maior interrompe a sincronização; é preciso arquivá-la noutra pasta ou usar uma pasta de importação sem mensagens grandes.

A pesquisa por data é feita no servidor IMAP, sem percorrer todos os identificadores antigos da caixa. Cada lote examina até dez mensagens correspondentes; uma importação histórica pode exigir vários lotes. A identidade usa conta, pasta, UIDVALIDITY e UID. Mudanças de UIDVALIDITY podem causar uma nova captura de mensagens existentes; não se usa apenas Message-ID para apagar mensagens legítimas repetidas.

**Converter em ticket** conserva a conversa e associa os anexos ao ticket. Repetir o botão abre o ticket já associado. As ligações e o histórico do cliente continuam disponíveis. O envio por SMTP, respostas, pastas adicionais e sincronização de lidas ficam fora desta primeira versão.

As credenciais dos conectores são cifradas com `AI_ENCRYPTION_KEY`. É essencial recuperar a mesma chave se a base de dados for restaurada. Substituir uma configuração exige preencher novamente as credenciais; não são devolvidas ao navegador.

### Ativar automatismos no Misto

O Misto é um ambiente de ensaio e mantém a sincronização automática desligada no servidor por defeito. Depois de validar os botões manuais, acrescentar a `.env.misto`:

```dotenv
OFICINAOS_ENABLE_INTEGRATION_POLLING=true
```

Recriar apenas a aplicação com os comandos habituais e ativar cada conector na interface. Numa cópia de recuperação/ensaio, remover esta variável e manter os conectores desativados. Não ativar a mesma caixa e loja simultaneamente em várias cópias operacionais.

## Backup diário cifrado no Google Drive

O ficheiro adicional `compose.misto.backup.yaml` acrescenta um serviço de backup sem substituir as portas de rede existentes. Não muda o compose principal editado na loja.

Inclui:

- Dump PostgreSQL 16 em formato custom, verificado com `pg_restore --list`.
- Fotografias e documentos, incluindo `uploads/.documents`.
- `.env.misto`, necessária para recuperar as chaves e a configuração.
- Manifesto e SHA-256 dos ficheiros.

O envio só aceita um remoto **rclone crypt**. Depois de copiar, lê novamente os dados remotos para verificar a integridade. Só nessa altura atualiza **Ficheiros → Última cópia online verificada**. Uma cópia local não é apresentada como proteção online. Falhas ficam registadas e são novamente tentadas no ciclo seguinte.

### Preparar a conta (uma vez, no servidor Ubuntu)

```bash
cd ~/OficinaOS-misto
sudo apt install rclone
mkdir -p backup-rclone
chmod 700 backup-rclone
rclone --config "$PWD/backup-rclone/rclone.conf" config
```

No assistente:

1. Criar remoto `oficina-drive`, tipo **Google Drive**, e autorizar a sua conta. Num servidor sem navegador, escolher a autorização noutro computador e seguir o comando `rclone authorize` indicado pelo assistente. O token não deve ser partilhado por conversa.
2. Criar remoto `oficina-crypt`, tipo **crypt**, apontado para `oficina-drive:OficinaOS-backups`.
3. Ativar cifra de nomes de ficheiros e de pastas e definir palavra-passe e salt fortes. Guardar essas duas chaves e uma cópia protegida de `backup-rclone/rclone.conf` **fora do servidor**. Sem elas, perder o servidor pode tornar as cópias irrecuperáveis.
4. Guardar o ficheiro e executar `chmod 600 backup-rclone/rclone.conf`. Não o publicar no GitHub. A pasta está excluída do Git e das imagens Docker.

Iniciar o serviço e montar o estado na aplicação:

```bash
sudo docker compose -p oficinaos-misto --env-file .env.misto -f compose.misto.yaml -f compose.misto.backup.yaml up -d --build online-backup app
```

Faz uma cópia ao iniciar e depois aproximadamente a cada 24 horas. Para repetir manualmente:

```bash
sudo docker compose -p oficinaos-misto --env-file .env.misto -f compose.misto.yaml -f compose.misto.backup.yaml run --rm --no-deps --entrypoint /bin/sh online-backup /scripts/full-backup.sh
```

A exclusão mútua impede dois backups simultâneos. As cópias locais com mais de sete dias são limpas apenas depois de um envio verificado. O histórico remoto não é apagado automaticamente: vigiar o espaço no Google Drive e estabelecer retenção. Se o Drive falhar, as cópias locais são mantidas e podem ocupar espaço no servidor. A aplicação mostra as datas de sucesso e falha; não envia alertas externos nesta versão.

### Verificar recuperação antes de confiar no backup

Listar e transferir uma pasta de backup para uma pasta privada no servidor ou noutro computador:

```bash
rclone --config "$PWD/backup-rclone/rclone.conf" lsf oficina-crypt: --dirs-only
```

Escolher o nome devolvido e copiá-lo com `rclone --config "$PWD/backup-rclone/rclone.conf" copy oficina-crypt:NOME_DA_COPIA /caminho/privado/recuperacao`. Dentro dessa pasta:

```bash
sha256sum -c SHA256SUMS
pg_restore --list database.dump > /dev/null
tar -tzf uploads.tar.gz > /dev/null
```

Ensaiar também um restauro completo num PostgreSQL 16 vazio e isolado, sem ligar a aplicação às contas externas. Confirmar clientes, reparações e abertura de anexos. A verificação de hashes e a listagem do dump não substituem esse ensaio.

Na recuperação real, parar a aplicação antes de restaurar a base de dados e o volume de uploads; recuperar as chaves de `.env.misto` com permissões restritas. Os nomes dos volumes e as ligações pertencem ao projeto `oficinaos-misto`. Não usar `down -v`, nem restaurar por cima dos dados operacionais sem um plano de recuperação.

O dump e a cópia de ficheiros são sequenciais, não um snapshot atómico de todo o servidor. Documentos privados são imutáveis e a remoção só desfaz associações, mas a eliminação simultânea de fotografias pode afetar a consistência. Para uma cópia de referência, pausar alterações na loja durante o backup e testar o restauro. Uma tarefa de backup a correr no mesmo servidor também não é uma garantia contra falha anterior ao primeiro envio.

## Validação desta alteração

Testes automatizados de privacidade/permissões, importação sem duplicação, valores e cêntimos, captura MIME, conversão em ticket e execução do backup com comandos externos simulados. Migrações ensaiadas numa base PostgreSQL compatível PGlite. A ligação e recuperação em PostgreSQL 16 real, WooCommerce, IMAP e Google Drive exigem validação na instalação.
