# Conexão do canal com o Google

Em **Configurações → Google Drive**, importe o **JSON de conexão do canal**. Ele identifica o canal, a pasta, o conector pessoal e, opcionalmente, uma planilha existente. A importação verifica a conexão, prepara a estrutura e sincroniza os projetos. Não há seletor de “estrutura Content Lab ou Diazverso”: todos os canais usam o mesmo contrato de planilha compatível com o plugin.

## Configuração pessoal, sem cliente OAuth em Testing

O caminho principal é um **Google Apps Script instalado pelo próprio titular da conta**. Ele executa como essa pessoa, usa o projeto Google padrão criado pelo Apps Script e gera o JSON de conexão. Não é necessário cadastrar um cliente OAuth desktop nem colocá-lo em beta/Testing. A primeira autorização Google continua obrigatória, e avisos de aplicativo não verificado podem aparecer; o titular precisa lê-los e decidir. Este mecanismo não dispensa políticas do Google nem é uma promessa de aprovação de um aplicativo público centralizado.

O tutorial e os dois arquivos estão disponíveis na própria tela, em **Como conectar seu canal → Obter arquivos do conector**:

1. Abra [Apps Script](https://script.google.com/home/start), crie um projeto e copie `assets/google-connector/Code.gs`.
2. Nas configurações do projeto, mostre o manifesto `appsscript.json` e copie o arquivo fornecido. Ele habilita os serviços Drive, Sheets e Docs; no projeto padrão do Apps Script, as APIs associadas são ativadas automaticamente.
3. No início do código, preencha `CANAL.nome`. Se já tem uma pasta e planilha, informe seus IDs opcionais. O nome do projeto do Google Cloud **não** é tratado como nome do canal.
4. Implante como **Aplicativo da Web**, **Executar como você**, com acesso **Qualquer pessoa** para receber solicitações assinadas do aplicativo local. Não é uma autorização pública aos dados: o conector recusa solicitações sem assinatura válida.
5. Copie a URL `/exec` da implantação para `CANAL.urlImplantacao`, salve e execute `gerarConexao`. Autorize o script pessoal. A URL é usada na geração do arquivo; alterar esse campo não muda o processamento de solicitações da versão implantada.
6. No registro de execução, abra o link e baixe o JSON privado. Ele fica na raiz do Meu Drive, fora da pasta do canal que pode ser compartilhada.
7. Importe o JSON no Content Lab. A conexão é validada por uma chamada assinada, sem enviar seu segredo no corpo ou na URL.

[Apps Script: aplicativos da Web](https://developers.google.com/apps-script/guides/web), [serviços avançados e projeto padrão](https://developers.google.com/apps-script/guides/services/advanced), [regras de autorização/verificação](https://developers.google.com/apps-script/guides/client-verification).

## Pastas e planilha

A raiz tem o **nome do canal informado no JSON**. Nela ficam:

- Planilha `Canal do YT — V1.0 (Nome do canal)`, com **Produções, Ideias, Afiliados e Config** (oculta).
- **Backgrounds**.
- **Thumbnails/Longos** e **Thumbnails/Shorts**.
- **Roteiros/Longos** e **Roteiros/Shorts**.

Outras bibliotecas podem ser criadas pela pessoa. Não há pasta por vídeo. Pastas e planilha existentes são reutilizadas; nomes ambíguos e cabeçalhos incompatíveis bloqueiam a criação. A descoberta percorre todas as páginas e também identifica planilhas pelo conjunto de abas, mesmo com outro nome. Abas extras, formatação, validações e campos manuais fora das alterações são preservados.

## Sincronização e acervo

- Ao salvar um projeto, o app agenda uma sincronização em segundo plano; a cada minuto verifica pendências enquanto estiver aberto. Falha de rede não invalida a edição local. O botão Sincronizar agora faz a conferência explícita.
- A planilha recebe ID, tipo, tema/tese, títulos, status, links de roteiro e thumbnails. Status alterado manualmente deixa de ser controlado pelo app. Planejamento, aprovação e publicação nunca são inventados.
- Roteiros são **Docs nativos formatados**, com briefing, embalagem, capítulos, fala, cenas/direção marcadas NÃO NARRAR e fontes. Escritas usam revisão exigida e índices UTF-16. Shorts têm só embalagem A.
- Thumbnails selecionadas, existentes e com direitos confirmados são enviadas para sua pasta. Formatos PNG/JPEG/WebP, até 8 MB; o conteúdo é identificado por hash e nunca se apaga a versão anterior automaticamente. Itens pendentes são sinalizados, não enviados como aprovados.
- Esta integração ainda não envia automaticamente narrações, renders, arquivos brutos ou kit completo, nem publica vídeos.
- Em **Projetos**, o **Acervo do canal** lê registros da planilha, inclusive vídeos sem pasta local. Busca por ID, título, tema ou observações; filtra longos/Shorts e mostra links de roteiro, vídeo, thumbnails e kit quando existentes. Abrir um link não restaura um projeto local completo.

## Numeração e vínculos

Vídeos longos usam VD e Shorts SH em sequências independentes. O maior ID encontrado na planilha e no ledger, mais o contador persistido, determina o próximo. Exemplo: VD_0015 → VD_0016, sem afetar SH. IDs já emitidos não são reutilizados após remoção de linha.

No conector pessoal, a reserva acontece sob `ScriptLock`, com contador e operação idempotente escritos juntos. Novos projetos conectados recebem seu ID antes da criação local. Uma reserva interrompida pode deixar um número sem projeto; esse número permanece emitido e não é reciclado. Quando o mesmo pedido é retomado, ele devolve o mesmo ID.

Projetos locais antigos com ID no título mantêm esse ID. Uma linha existente só é vinculada automaticamente quando ID/tipo e título A ou tese coincidem; o Doc precisa ter MIME/pasta válidos. Conteúdo incompatível vira pendência, em vez de outra produção ou sobrescrita cega. Campos manuais são preservados.

## Segurança e limites

O conector usa HMAC-SHA256, timestamp, nonce e proteção contra replay. Só encaminha chamadas às APIs Drive/Sheets/Docs e valida que os recursos estão dentro da raiz do canal. A URL de implantação sozinha não permite acessar arquivos. O segredo no JSON concede acesso por esse conector: guarde-o como credencial e não o compartilhe.

O Content Lab aceita apenas endpoints HTTPS `script.google.com/macros/s/.../exec`. O retorno do ContentService só pode redirecionar para `script.googleusercontent.com`; o pedido assinado não é reenviado a esse destino. Tokens OAuth do Google ficam no Apps Script e nunca são entregues ao app local nesse modo.

O JSON importado fica na pasta privada `google/` dos dados do aplicativo (arquivos 0600 e diretório 0700 em POSIX), fora dos projetos e exportações. Não há criptografia própria em repouso; valem as permissões do sistema. O status e o MCP nunca retornam o segredo.

**Desconectar remove a credencial deste computador**, preservando os arquivos e vínculos. Para revogar uma cópia do JSON em outro lugar, desative a implantação ou altere `SECRET` nas propriedades do script e gere outro JSON.

Planilhas não oferecem compare-and-swap. O conector serializa reservas e compara os valores lidos antes de aplicar o batch sob a mesma trava; outros escritores que não usam esse conector e edições humanas ainda exigem coordenação. Docs editados externamente são detectados por conteúdo/revisão e bloqueiam sobrescrita posterior. Respostas perdidas são reconciliadas pelo conteúdo esperado e pelos ledgers. Há limites e quotas do Apps Script/Google; erros ficam visíveis e os arquivos locais são preservados.

A compatibilidade com OAuth desktop anterior permanece no núcleo para instalações existentes, mas não é o tutorial nem o caminho principal desta tela.

## MCP / API

`google_status`, `google_inspect`, `google_prepare`, `google_sync` e `google_archive`. O último consulta metadados e links sem exigir projeto local.

API local `/api/v1/google/{status,connector,configure,connect,disconnect,inspect,prepare,sync,archive}`. Status e connector usam GET; os demais POST. Host/Origin/CSRF continuam aplicados.

Testes automatizados usam respostas Google simuladas e executam o código do Apps Script em um ambiente isolado para assinatura, replay, destinos e reservas. A validação real da conta exige instalar/autorizar o conector e importar o JSON; não se declara envio real antes dessa leitura de retorno.
