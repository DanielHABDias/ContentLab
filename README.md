# Content Lab — Node.js + Remotion

**Redução de respiração:** disponível em **Narração → Tratamento**, na finalidade de narração oficial, e em **Gravar → Ajustar tratamento da gravação**. Vem marcada na interface, com intensidade de 60% (até 12 dB de atenuação); pode diminuir, desligar ou aumentar até 100% (20 dB). Atua conservadoramente em ruídos semelhantes a respiros nas pausas, sem cortar tempo e sem baixar outro modelo. Não garante eliminar toda respiração: ouça o resultado e reduza se afetar consoantes. O tratamento acontece antes da transcrição final; originais e tomadas são preservados. Não se aplica à transcrição avulsa nem à geração por IA automaticamente. Detalhes de API e limitações no guia integrado, seção “Redução de respiração nas pausas”.

## Projeto universal

Selecione **uma pasta no topo** para todas as abas. A pasta pode estar vazia: `edit_plan.json` só é necessário no Editor para editar/renderizar. O navegador restaura o último caminho usado; **Recarregar projeto** relê o plano, as tomadas, o inventário e as thumbnails. Confirme antes de descartar alterações do editor. Em gravação, finalize/salve a tomada antes de trocar a pasta.

**Downloads e transcrições avulsas não exigem projeto.** Vídeos/cortes vão para Downloads ou para o destino escolhido. Marque **Guardar nos assets do projeto ativo** para usar `assets/<obra-ou-fonte>/clips/`, `audio/` ou `transcripts/`. Transcrições de fontes baixadas sempre ganham uma subpasta exclusiva. Em Tratamento, **Transcrição avulsa** é a finalidade padrão: selecione um áudio e receba JSON/TXT/SRT em `Downloads/transcricao-<identificador>/`, mantendo os tempos originais sem tratar ou cortar o áudio. Não altera o `transcript.json` nem a narração oficial, mesmo com projeto ativo. Para substituí-los, escolha explicitamente a finalidade de narração oficial e confirme.

A narração oficial continua em `audio/`, com tomadas em `audio/takes/`. Thumbnails, imagens exportadas e ZIPs ficam em `thumbnails/`; o rascunho editável é `thumbnails/project.json`. Não movemos arquivos antigos de Downloads automaticamente. Exportações com nomes repetidos ganham um sufixo.

## Aprimoramento de voz por IA

**Gravação tratada automaticamente:** ao finalizar as tomadas, o padrão agora aplica IA forte a 100%, passa-altas de 70 Hz, compressão/de-esser suaves, normalização -16 LUFS (pico alvo -1,5 dBTP) e corte de silêncio nas bordas. Pausas internas ficam preservadas. Ajuste ou desligue em **Gravar → Ajustar tratamento da gravação**. As tomadas originais não mudam; a transcrição é gerada depois do tratamento. Falhas preservam a narração anterior e os intermediários não ficam acumulados em `audio/`. Tomadas e WAV final da gravação mantêm mono, 48 kHz e PCM 24-bit. Voz gerada por IA mantém seu fluxo separado.

**Voz expressiva:** além do Qwen, agora há **Chatterbox Multilingual V3** (pacote 0.1.7 com adaptação para selecionar os pesos V3 oficiais) com clonagem em português e controles de intensidade expressiva/CFG. Selecione-o em Configurações → Voz e modelos de IA, o ambiente separado é preparado na inicialização e os pesos são baixados automaticamente ao gerar. Em Criar com IA, escolha a voz e ajuste os pontos de partida Natural/Contido/Dramático/Enérgico. São sugestões numéricas, não garantia de emoção nem comandos em linguagem natural. Para variar durante a narração, gere trechos com ajustes diferentes e acrescente-os. Veja [modelos, fontes, parâmetros e limitações](docs/VOICE_MODELS.md). Os padrões de geração foram alinhados ao Voicebox local por modelo (Qwen: temperatura 0,9/Top P 1/repetição 1,05; Chatterbox: 0,8/1/2,0, intensidade e CFG 0,5). Qwen mantém Top K 50 e limite de 8192 tokens. Sem pausa extra por padrão. Os pesos V3 e a segmentação própria são preservados, portanto não é uma reprodução idêntica do Voicebox. Qwen continua disponível; nenhuma dependência global é alterada.

**Gravar:** finalize cada tomada, ouça/ordene/desmarque ou exclua; depois finalize a narração para unir `audio/narration.wav` e transcrever automaticamente. **Criar com IA:** cadastre uma voz autorizada em Configurações → Voz e modelos de IA (amostra recomendada de 10–30 s, texto fiel), escolha Qwen 0.6B ou 1.7B; o modelo é preparado e baixado automaticamente ao gerar. Gere, ouça e finalize as tomadas. Modelos grandes podem ser lentos em CPU e não garantem entonação. O servidor permanece Node; o worker de voz usa Python isolado em `.tools/qwen`, sem instalação global. Para apenas obter timestamps de uma fonte externa, use a finalidade **Transcrição avulsa** em Tratamento, não a finalização da narração.

Narração possui **Gravar**, **Criar com IA** e **Tratamento**: o topo compartilhado seleciona apenas a pasta do projeto. Gravação usa seus controles explícitos de tratamento ao finalizar; geração por IA não aplica limpeza adicional automática. Em Tratamento ficam as receitas ajustáveis, cortes de silêncio, IA, normalização, compressão suave e suavização de sibilância. Em **Configurações → Voz e modelos de IA**, ouça as amostras salvas, selecione a voz e cadastre novas referências; os modelos ficam numa seção separada.

Na área **Narração**, abra **Aprimorar voz com IA** para ativar redução de ruído local com DeepFilterNet, escolher limpeza natural/forte e intensidade e comparar uma prévia de até 20 segundos. O original é preservado; o áudio não é enviado a serviços externos. No primeiro uso, a ferramenta oficial é baixada e verificada automaticamente em `.tools/voice-enhancement` (Linux x64/Windows x64, sem instalação global). Personalizada começa com limpeza forte em 100%, compressão/de-esser suaves e pausas internas preservadas; a finalidade avulsa não aplica tratamento. Não é uma reprodução do Adobe Podcast; teste a naturalidade antes de aplicar à narração completa. Veja os parâmetros e o fluxo na documentação integrada.

Editor automático e utilitários de vídeo para projetos de conteúdo e motion design, com servidor Node.js, interface JavaScript, Remotion e FFmpeg. Os testes automatizados Linux e Windows estão disponíveis no GitHub Actions. A validação estética final continua dependendo dos arquivos e objetivos de cada projeto real.

## Thumbnails — editor visual e exportação em lote

A aba **Thumbnails** agora oferece um editor visual integrado: importar PNGs e imagem contextual, escolher fundos no estilo `BackgroundHQ` (com halftone, papel, filme, estrelas, grade ou cor sólida), ajustar camadas por arraste no canvas, escala e opacidade, luzes e degradê preto inferior. O título Anton é composto em duas passadas alinhadas: preenchimento com glow atrás do personagem central e contorno fino à frente, criando o efeito de atravessar o texto; Bangers é alternativa.

Monte primeiro a thumbnail **16:9** do vídeo longo e clique **+ Novo Short** para gerar versões 9:16 com o **mesmo fundo global**, alterando personagem, texto e enquadramento individualmente. Também há saída 1:1 ou 16:9. Salve imagens ou um **ZIP com todas as versões e JSON editável** na subpasta `thumbnails/` do projeto ativo. O rascunho é salvo automaticamente em `thumbnails/project.json` e restaurado por pasta; nenhuma imagem é enviada para serviço externo. Rascunhos antigos do navegador não são migrados automaticamente: selecione a pasta e importe o JSON que deseja guardar nela.

Guia: [docs/THUMBNAIL_STUDIO.md](docs/THUMBNAIL_STUDIO.md). A aba usa as fontes Anton/Bangers já incluídas em `builtin-assets/fonts`. Os fundos de thumbnail reproduzem os estilos de forma **estática no canvas**; não são renders do TSX de vídeo nem mudam a biblioteca dos quinze presets.

Nas thumbnails, os secundários podem receber **degradê lateral** independente (`glowMode: "lateral"`), acima das figuras laterais e abaixo da sombra, do texto e do protagonista. O título permite ajustar a **distância entre linhas** (`lineHeight`) mantendo o preenchimento atrás e o contorno fino à frente perfeitamente alinhados. Projetos existentes preservam seu brilho radial e sua entrelinha quando não incluem esses campos.

A saída das thumbnails é **Full HD** por padrão, com opção **4K**, em **JPG** (padrão), PNG ou WebP. O painel **Luzes laterais independentes** (`background.sideLights`) controla azul/amarelo ou quaisquer cores como degradês das bordas, mesmo sem PNGs. A foto contextual fica atrás da página HQ e dos personagens, com **Preencher / Mostrar imagem inteira** e botão para centralizar posição e zoom. O ZIP respeita a resolução e o formato escolhidos; detalhes no guia do Studio.

A **skill interna e o ZIP da Documentação** também orientam a criação desses projetos e incluem o guia completo de thumbnails, parâmetros, camadas e exportação. O JSON de imagem tem `version: 1` e imagens incorporadas; não é o `edit_plan.json` de vídeo. Preferências de canal são externas, não padrões públicos obrigatórios.

O fundo oferece **Inverter cor dos efeitos**, sem inverter foto/personagens: bolinhas brancas no preto ou grade/estrelas pretas no branco. Papel/filme/grade/estrelas usam o próprio BackgroundHQ.tsx como fonte gráfica estática, não frames dos vídeos. O contorno do título aceita zero e frações; valor 1 equivale a 0,15 px na largura 1280, sem negrito artificial. Personagens têm saturação e luminosidade ajustáveis.

## Vídeos e cortes — link da internet

A aba **Vídeos e cortes** aceita **Link da internet**. YouTube e outras plataformas públicas compatíveis (TikTok, Pinterest, Instagram, Vimeo, X/Twitter, Reddit, Facebook, Twitch e Dailymotion) usam o executável open source [yt-dlp](https://github.com/yt-dlp/yt-dlp) para consultar metadados e baixar mídia. O decifrador de URLs do `youtubei.js` não é usado nos downloads. Nenhum JSON do Google ou OAuth de publicação é necessário para esse fluxo.

**Preparação automática:** o inicializador baixa o executável standalone oficial do [yt-dlp](https://github.com/yt-dlp/yt-dlp/releases) para `.tools/ytdlp`, verifica SHA256 e testa sua execução. Não exige Python, instalação manual ou PATH. Se faltar ao importar um link, o próprio fluxo também o prepara. FFmpeg/FFprobe são preparados pelo inicializador. `CONTENTLAB_YT_DLP` fica apenas como override avançado opcional. Linux e Windows x64/arm64 têm artefatos mapeados; validação física realizada em Linux x64.

Ao colar um link suportado e clicar **Carregar**, o Content Lab consulta o título, a duração e a miniatura; depois, importa o vídeo para o mesmo cache da fonte e libera prévia, cortes e exportação. O download externo gera MP4 quando possível, admite vídeos de até 1 GB e seleciona apenas um vídeo por URL. Links já importados reutilizam o cache.

Para os desafios JavaScript do YouTube, o downloader recebe automaticamente o caminho do próprio Node 22+ que executa o aplicativo, inclusive em instalações portáteis. Os scripts EJS estão incluídos no standalone oficial; não é necessário configurar Deno ou instalar outro runtime. Cache existente, importação pelo Banco de mídia, cortes e exportação de áudio continuam usando o mesmo fluxo. A pesquisa por palavras-chave do Banco de mídia ainda usa `youtubei.js`, separadamente do download.

**Limites:** nenhum programa baixa literalmente de todo site. O aplicativo só encaminha URLs HTTPS de domínios de vídeo conhecidos; não baixa arquivos de endereços internos/locais ou URLs arbitrárias, não contorna DRM e não autentica contas privadas. Sites podem deixar de funcionar, exigir consentimento ou ter restrições nos seus termos. Respeite os direitos de uso e publicação do material.

## Banco de mídia — pesquisar, baixar e criar cortes

A aba **Banco de mídia** agora prioriza **YouTube normal + Pinterest** (seleção inicial), com busca por palavras-chave, miniaturas, autores, formatos, seleção e importação para o cache existente de Vídeos e cortes. É possível escolher cada fonte separadamente, todas as fontes ou o YouTube com filtro Creative Commons.

- **Wikimedia Commons:** pesquisa imagens e vídeos (JPG, PNG, WebP, GIF, MP4, WebM etc.) com metadados de licenças abertas reconhecidas. Exige conferência dos créditos e da atribuição na página original.
- **Internet Archive:** pesquisa filmes e registros audiovisuais que declaram licenças Creative Commons BY/BY-SA ou domínio público. A importação verifica novamente a licença no item original e escolhe um arquivo original suportado, de até **240 MB**. Um resultado não é prova absoluta de que o uploader possui os direitos; verifique antes de reutilizar cenas.
- **YouTube:** usa pesquisa **normal (sem filtro Creative Commons)** por padrão com a biblioteca **YouTube.js**, já instalada. A opção **YouTube (Creative Commons)** permanece como filtro separado. Encontrar um vídeo público não fornece licença de reutilização; confirme autorização dos titulares antes de baixar, reeditar ou publicar. A importação reutiliza o downloader existente, sem depender do OAuth de publicação Google, e pode falhar quando o YouTube muda seus mecanismos.
- **Pinterest:** pesquisa de pins públicos por palavra-chave dentro da aba, com imagens, vídeos MP4 disponibilizados publicamente, miniaturas e perfis dos criadores. A importação de imagens e vídeos diretos é implementada em Node, com acesso limitado ao CDN `pinimg.com`. A estratégia de pesquisa é inspirada no projeto [pinterest-dl](https://github.com/monji024/pinterest-dl), sem exigir Ruby ou Python. O Pinterest pode bloquear buscas públicas, exigir login ou mudar seus endpoints: nesses casos o Content Lab mostra a falha e fornece link para fazer a mesma pesquisa no Pinterest. Não utiliza cookies pessoais nem burla autenticação.
  - **Conectividade:** a pesquisa segue apenas redirecionamentos HTTPS entre domínios Pinterest válidos e preserva cookies de sessão pública/CSRF durante o retorno. Em caso de falha de rede, tenta uma vez o domínio regional `id.pinterest.com`. Erros de DNS, certificados HTTPS, conexão interrompida e exigência de login têm mensagens distintas. Esta mudança não substitui uma conta Pinterest nem contorna bloqueios da plataforma; não foi testada com a conexão real do usuário.
- **Fotos:** são salvas em `~/Downloads/ContentLab/Imagens` (ou pasta Downloads equivalente), com arquivo `.license.txt` informando fonte, criador e situação da licença. **Vídeos:** vão para o cache de fontes existente e ficam disponíveis para cortes na aba Vídeos e cortes. Para YouTube/Pinterest, os direitos não são inferidos a partir do fato de a mídia ser pública.
- A API aceita downloads **somente de resultados obtidos por busca válida**, com um identificador temporário, confirmação dos direitos, restrição de servidores de origem, limite de arquivo, limite de dois downloads simultâneos e sem permitir URL arbitrária ou bypass de DRM. Não há integração com sites de streaming protegido nem download de filmes/séries comerciais sem permissão.

**TikTok:** a pesquisa integrada ainda não é estável sem sessão/Playwright, então a aba oferece uma busca externa no TikTok com o mesmo termo. O projeto [TikTok-Api](https://github.com/davidteather/TikTok-Api) foi avaliado para uma integração futura, mas não é dependência obrigatória.

Ferramentas avaliadas: [yt-dlp](https://github.com/yt-dlp/yt-dlp), [gallery-dl](https://github.com/mikf/gallery-dl), [pinterest-dl](https://github.com/monji024/pinterest-dl), [YouTube.js](https://github.com/LuanRT/YouTube.js) e [Internet Archive](https://archive.org). O Banco de mídia usa APIs públicas e nosso código Node, sem exigir essas ferramentas extras como dependências.

## Tecnologias

- **Node.js 22+**: servidor HTTP, validação, projetos, cache, cortes, áudio e automações.
- **JavaScript e React/TypeScript**: interface web atual e composições Remotion.
- **Remotion**: renderizador visual das cenas, com keyframes, textos, PNGs, vídeo e câmera.
- **FFmpeg/FFprobe**: cortes, concatenação, transições, normalização, mixagem e verificação do MP4.
- **YouTube.js (`youtubei.js`)**: cliente JavaScript para fontes do YouTube.
- **whisper.cpp**: ferramenta local de transcrição executada diretamente pelo servidor Node.

Remotion concentra a renderização visual; o FFmpeg continua responsável por áudio, cortes e composição final. O código de servidor utiliza exclusivamente Node.js.

## Conexões sociais gerenciadas e métricas ampliadas

Inspirado no desenho de provedores do projeto Postiz, mas com implementação original para o servidor Node local:

- **Configurações:** cada cartão apresenta a identidade do perfil conectado (quando devolvida pelo serviço), suas permissões de acesso e o botão **Verificar conexão**, que consulta a API oficial para validar o perfil.
- **Sessões:** YouTube, Instagram e TikTok renovam a autorização quando necessário, com deduplicação de solicitações de renovação simultâneas. Falhas que exigem novo consentimento ficam identificadas para reconexão; os tokens permanecem somente no backend local.
- **Permissões:** novo consentimento inclui `yt-analytics.readonly` (YouTube), `instagram_business_manage_insights` (Instagram), `user.info.profile` e `user.info.stats` (TikTok). Se uma plataforma não conceder tudo, Configurações mostra o que faltou. Para atualizar permissões de contas conectadas anteriormente, clique **Reconectar**.
- **YouTube Analytics:** dados diários do canal (visualizações, tempo assistido e inscrições), com gráfico histórico separado das visualizações dos vídeos recentes. A YouTube Analytics API precisa estar habilitada no projeto Google Cloud e a permissão aprovada.
- **Instagram:** continua usando Instagram Login oficial; pede acesso a insights, tenta coletar estatísticas da conta e dos vídeos, mas não mostra números não concedidos pela Meta.
- **TikTok:** complementa métricas de vídeos recentes com informações do perfil quando a API autoriza. Permissões extras dependem da aprovação do aplicativo TikTok; a falha dos dados opcionais não interrompe o restante do painel.
- **Instagram em computador local:** adicionado `node server/instagram-bridge.mjs`, um servidor loopback restrito a um único callback, destinado a receber exclusivamente um túnel HTTPS na porta 5151. Veja [guia completo de conexão Instagram local](docs/INSTAGRAM_OAUTH_LOCAL.md). Não faça túnel para a porta 5000 do Content Lab.

As plataformas ainda exigem aplicativos OAuth cadastrados e permissões concedidas pelos portais oficiais. Código aberto não transfere as credenciais comerciais nem as aprovações do Postiz. Não usamos web scraping nem importamos código AGPL do Postiz. Nenhuma autorização real ou publicação foi executada pelos testes automatizados.

## Login com um clique e configuração assistida

O uso normal não pede tokens nem senhas pessoais. Em **Configurações**, clique em **Conectar com Google**, **Conectar Instagram** ou **Conectar TikTok**. Se o aplicativo OAuth já tiver sido registrado, o Content Lab redireciona diretamente para a página oficial da rede; depois da autorização, recebe e renova credenciais de sessão automaticamente no servidor local.

**Se ainda não estiver configurado**, o botão abre um assistente da própria plataforma com instruções passo a passo, links para o portal e a documentação oficiais, permissões necessárias e URL de retorno para copiar quando aplicável. Os campos técnicos só aparecem se você clicar em **Já tenho as credenciais do aplicativo** (ou expandir a Configuração avançada).

- **YouTube / Google:** abra [Google Cloud Console](https://console.cloud.google.com/apis/credentials), ative YouTube Data API v3, configure a tela de consentimento e crie um cliente OAuth **App para computador**. Baixe o JSON da aplicação e selecione **Importar JSON do Google** no assistente. O Content Lab lê apenas o Client ID/Secret desse arquivo, salva localmente e abre a escolha de conta Google automaticamente. O fluxo usa PKCE. Não se importa um JSON de conta de serviço ou um token.
- **Instagram:** abra [Meta for Developers](https://developers.facebook.com/apps/), configure **Instagram API with Instagram Login** para uma conta profissional e solicite as permissões `instagram_business_basic` e `instagram_business_content_publish`. É obrigatória uma URL de retorno **HTTPS**, encaminhada com segurança para o callback local do Content Lab; configure-a no portal e no assistente. Veja também a [documentação da Meta](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login).
- **TikTok:** abra [TikTok for Developers](https://developers.tiktok.com/) e adicione **Login Kit Desktop**, registrando a URL local `127.0.0.1` exibida pelo assistente. Configure `video.publish` e `video.list` onde aprovados, e preencha Client Key/Secret **do aplicativo** uma vez. Consulte o [guia Desktop](https://developers.tiktok.com/docs/en/login-kit-desktop).

**Limitações:** não existe OAuth universal do Google que autorize automaticamente as APIs do Instagram e TikTok. Mesmo usando Google para entrar nessas redes, cada uma apresenta sua própria autorização. Os fornecedores exigem registro de um aplicativo OAuth para permitir publicação; não há um caminho legítimo para pular essa etapa se o Content Lab ainda não tiver credenciais de aplicativo configuradas. Também não é necessário buscar ou copiar tokens pessoais manualmente: o OAuth troca o código de autorização por tokens nos bastidores. A liberação de publicação pública pode exigir auditoria da Meta/Google/TikTok.

## Configurações — contas e integrações

A aba **Configurações**, depois de Métricas, é o único local para conectar/desconectar YouTube, Instagram e TikTok. O usuário encontra três cartões com indicadores de status e botões diretos: **Conectar com Google**, **Conectar Instagram** e **Conectar TikTok**. Com um aplicativo OAuth já configurado, basta clicar no botão e autorizar a conta no site oficial. Para YouTube, o Google solicita explicitamente a seleção de conta.

Quando nenhuma conta está autorizada, **Publicações** esconde todo o editor e exibe apenas o convite para ir a Configurações; **Métricas** também mostra o convite, sem cartões. Assim que pelo menos uma conta é autorizada, ambos ficam disponíveis, e Publicações permite selecionar somente destinos conectados (além de manter a restrição 16:9/9:16 do TikTok).

**Configuração avançada:** serviços OAuth não permitem obter tokens de publicação somente pela senha pessoal ou reutilizando a permissão do Google para as três redes. Cada plataforma exige um aplicativo OAuth registrado no respectivo portal e suas credenciais de integração. O formulário de Client ID/Secret, e URL HTTPS no Instagram, fica recolhido no final de Configurações e só precisa ser usado quando ainda não existir configuração local. Quem distribui uma instalação já configurada não precisa preencher novamente os dados do aplicativo.

O Content Lab **não solicita nem armazena senhas pessoais de YouTube, Instagram ou TikTok**. Os sites oficiais realizam autenticação e consentimento, e apenas Client ID/Secret **do aplicativo**, tokens e dados OAuth são guardados no `.env` local ignorado pelo Git. Instagram e TikTok continuam exigindo autorizações próprias, mesmo quando o usuário entra nos sites usando uma conta Google. O `.env` deve ser mantido privado e transferido com segurança.
## Métricas — painel de desempenho conectado

A aba **Métricas**, localizada após Publicações, começa com um convite para conectar contas OAuth. Assim que pelo menos uma rede estiver autorizada, apresenta uma **Visão geral** com dados das plataformas conectadas. Clique no ícone de YouTube, Instagram ou TikTok para filtrar; clique novamente no ícone selecionado para voltar ao geral.

- **YouTube:** últimos 50 uploads do canal (até 20 vídeos públicos mostrados), visualizações, curtidas, comentários e possíveis publicações futuras retornadas por `status.publishAt`. O app solicita também o escopo `youtube.readonly` além de `youtube.upload`.
- **Instagram:** até 20 mídias recentes, com foco em vídeos, legendas, curtidas/comentários quando fornecidos e tentativa de consultar `views` para até oito vídeos. Métricas indisponíveis ficam como `—` em vez de zero. Não exibe agendamentos do Instagram.
- **TikTok:** até 20 vídeos públicos recentes da Display API, com views, curtidas, comentários e compartilhamentos. Exige o escopo adicional `video.list` habilitado no aplicativo TikTok. Não apresenta rascunhos nem vídeos programados no TikTok Studio.
- **Resumo:** últimas publicações, indicadores dos itens retornados, agendamentos disponíveis no YouTube e barras comparativas. Os totais são apenas da **amostra recente**, não do histórico inteiro dos perfis; nenhuma métrica é inventada.
- **Atualização:** o backend conserva respostas por 2 minutos para economizar quotas. O botão Atualizar força nova leitura. Cada plataforma falha isoladamente e sugere reconexão quando faltarem permissões.

Se você autorizou YouTube ou TikTok antes de incluir Métricas, use **Configurações → Reconectar** para conceder os novos escopos. O Content Lab guarda os tokens no `.env` local ignorado pelo Git e **não** envia tokens ao frontend do painel. A aba consulta `GET /api/social/metrics?platform=general|youtube|instagram|tiktok`; `refresh=1` ignora o cache temporário. Nenhuma informação fica agendada para atualização em segundo plano.

## Publicações — envio e agendamento

A aba **Publicações** permite selecionar vários MP4s locais, editar título/descrição por vídeo e publicar com OAuth nas três redes. Para Instagram e TikTok, título e descrição são unidos por uma linha vazia e `#Shorts` vira `#Viral`.

- **16:9 horizontal:** somente YouTube e Instagram; TikTok é desabilitado e acinzentado. O servidor confirma o formato real com FFprobe.
- **9:16 vertical:** YouTube, Instagram e TikTok. Outros formatos são rejeitados.
- **YouTube:** envio com agendamento futuro via `publishAt`, exigindo indicação de público infantil.
- **Instagram:** upload resumível local, processamento e publicação posterior.
- **TikTok:** consulta de privacidade permitida, consentimento explícito, envio por partes e processamento/moderação após o upload.
- **Lotes:** um Short por dia no YouTube; Instagram e TikTok enviam imediatamente, sem agendamento. Cada destino tem status próprio.

**Atenção:** contas reais ainda não foram validadas com apps OAuth autorizados; APIs podem exigir auditoria para publicar vídeos públicos. Nunca reenvie automaticamente quando o resultado for incerto: confira a plataforma antes. MP4s locais são enviados ao servidor via formulário e transferidos às APIs, com limite local de 1 GiB. A seleção de imagem de capa externa permanece apenas visual, sem transferência para as redes; escolha de frame é usada onde a API suporta. Arquivos finais de projetos podem ser escolhidos manualmente em `output/final/final.mp4`; busca automática na pasta ainda não está disponível.
### Configurando o acesso às redes sociais

1. Abra **Configurações**. Se a rede já estiver pronta, clique em **Conectar** e autorize no provedor oficial. Caso contrário, use **Configuração avançada** para cadastrar uma única vez o aplicativo OAuth de cada serviço.
2. Caso não haja integração pré-configurada, crie um aplicativo no portal de desenvolvedores e copie o **Client ID/Key** e o **Client Secret** para a configuração avançada. São credenciais da integração, não a senha da sua conta.
3. Registre no portal a **URI de retorno** informada na tela. YouTube: um cliente OAuth Google; TikTok: **Desktop Login Kit** com permissão `video.publish`; Instagram: **Instagram API with Instagram Login** (conta profissional).
4. Para o Instagram, a Meta normalmente requer uma URI pública **HTTPS**, encaminhada com segurança para `/api/social/oauth/instagram/callback` do servidor local. Apenas `http://127.0.0.1:5000` não é suficiente para essa integração.
5. Clique em **Conectar**. Após a autorização no site oficial, os tokens retornados ficam somente no `.env` local, ignorado pelo Git e gravado com permissões de proprietário (quando o sistema permite).
6. Para migrar de computador, transfira o `.env` apenas de maneira segura ou refaça o login. Tokens expiram, podem ser revogados e podem precisar ser renovados. Nunca publique o arquivo nem copie senhas pessoais para ele.

O servidor HTTP escuta somente em `127.0.0.1`. O callback HTTPS do Instagram requer um encaminhamento externo configurado pelo usuário; o Content Lab não instala automaticamente túnel. As permissões de publicação real dependem das aprovações dos serviços. O backend inclui as rotas de envio `POST /api/social/publish` e consulta `GET /api/social/jobs/:id`, com autorização, validação do MP4 e respostas por serviço. A publicação real depende do usuário conectar cada conta e autorizar o envio.

## Multi-editor automático: fila sequencial

A aba **Multi-editor automático** permite programar uma lista de projetos para renderização local em sequência, sem copiar planos nem abrir o editor JSON de cada um.

1. Abra a aba **Multi-editor automático** e cole o caminho absoluto de cada pasta de projeto, uma por linha, na ordem desejada. Também é possível adicionar pelo seletor de pastas ou pela pasta já aberta no Editor automático.
2. Selecione **Reaproveitar cache** para acelerar os renders ou **Refazer tudo** para reconstruir as saídas (o programa pede confirmação antes de apagar outputs existentes). Opcionalmente ative GPU e **Continuar os demais projetos se um falhar**.
3. Clique **Iniciar fila de renders**. Cada pasta mantém seu edit_plan.json, áudio, assets, cache e MP4 final em `output/final/final.mp4`. O painel mostra status, progresso e erros por projeto; **Cancelar fila** interrompe a etapa atual e não inicia as seguintes.

A fila valida previamente os projetos e narrações e executa um render por vez, sem concorrer com renders individuais. O máximo é de 40 pastas por fila; não são aceitas duplicatas. A fila é mantida em memória enquanto o servidor estiver aberto (se o servidor encerrar/reiniciar, será preciso iniciar outra fila). Os planos e arquivos dos projetos não são modificados por essa aba.

**API local:** `POST /api/render-queue` com `projectRoots: string[]`, `cacheMode: "reuse" | "rebuild"`, `hardwareAccel: boolean`, `continueOnError: boolean`; `GET /api/render-queue/latest`, `GET /api/render-queue/:id` e `POST /api/render-queue/:id/cancel`.



## Instalação automática e inicialização

**Não é necessário instalar manualmente Node.js, FFmpeg, whisper.cpp ou o modelo de transcrição.** O Content Lab verifica as dependências e prepara o que estiver faltando antes de abrir o navegador.

- **Zorin/Ubuntu/Linux:** execute `bash run.sh` (ou `./run.sh`) na pasta do repositório. Para criar um atalho no menu de aplicativos, execute `bash instalar-atalho.sh` uma única vez. O atalho abre um terminal durante a primeira instalação para mostrar downloads/avisos e, caso faltem compiladores, solicitar a senha do `sudo`.
- **Windows 10/11:** dê duplo clique em `iniciar.vbs` ou execute `iniciar.bat`. A instalação inicial abre uma janela de progresso e fecha após iniciar o servidor. Não exige instalação global do Node nem acesso de administrador para as ferramentas portáteis.
- **npm start:** usa o mesmo inicializador do atalho, com preparação automática. Para desenvolvimento sem bootstrap, `node server/http.mjs` inicia somente o servidor e pressupõe ferramentas já preparadas.

Na primeira execução, o instalador confere e prepara, conforme necessário:

1. **Node.js 22+ e npm:** utiliza uma instalação válida encontrada no sistema ou baixa o Node.js 22.16.0 portátil do site oficial, verificando SHA256.
2. **FFmpeg + FFprobe + filtro `rubberband`:** verifica também `ffmpeg -hide_banner -filters` para confirmar que o pitch do Grave suave/equilibrado/profundo funciona. Se o FFmpeg instalado não tiver `rubberband`, baixa automaticamente a versão GPL portátil BtbN/FFmpeg-Builds com `librubberband`, valida o manifesto SHA256 e verifica o filtro no executável baixado. Se já houver uma instalação capaz, reutiliza sem baixar novamente. O binário fica em `.tools/ffmpeg`, sem sobrescrever o FFmpeg do sistema.
3. **whisper.cpp:** reutiliza `whisper-cli` se instalado. No Windows baixa o binário CPU da release v1.9.4; no Linux baixa o código v1.9.4 e compila localmente. Se faltarem `cmake`, `c++` ou `make` no Zorin/Ubuntu, solicita autorização via `sudo apt-get` para instalar ferramentas de compilação.
4. **Modelo Whisper multilíngue `base`:** reaproveita `CONTENTLAB_WHISPER_MODEL` ou `~/.cache/whisper.cpp/ggml-base.bin`; senão baixa `ggml-base.bin` do repositório oficial do autor no Hugging Face, com hash SHA256 verificado. É necessário para a transcrição automática ao importar a narração.
5. **Dependências Node/Remotion:** instala o que falta com npm. As verificações de manifesto evitam reinstalar `node_modules` em toda abertura. Após mudanças em `package.json` ou no lockfile do Remotion, reinstala somente o conjunto afetado.
6. **Chrome Headless Shell do Remotion:** executa a verificação oficial `remotion browser ensure`, baixando o navegador compatível quando necessário. Depois disso o primeiro render não depende de descobrir um Chrome ainda ausente.

7. **Downloads externos:** yt-dlp standalone oficial, verificado por SHA256 e execução, em `.tools/ytdlp`; reaproveitado nas próximas aberturas.
8. **Voz por IA:** DeepFilterNet e ambientes CPU isolados Qwen/Chatterbox são preparados na inicialização. Python compatível é reutilizado; se ausente, uv verificado instala Python 3.12 local em `.tools/python`, sem instalação global. Os pesos do modelo escolhido são baixados automaticamente ao clicar Gerar (ou podem ser antecipados em Configurações). Não baixa todas as variantes de vários GB ao abrir.
9. **Seletores Linux:** curl/certificados e Zenity são preparados quando ausentes em Ubuntu/Zorin/Debian. Pacotes de sistema podem pedir senha de administrador; isso não exige configuração de PATH. A compilação do Whisper também prepara CMake/compilador. Outros gerenciadores de distribuição não foram automatizados.

As ferramentas que forem baixadas ficam em **`.tools/` dentro do Content Lab** (ignorada pelo Git), sem alterar o Node de outros projetos nem as variáveis PATH globais. O primeiro setup requer internet e espaço em disco para os binários, o modelo (~148 MB) e os pacotes npm e o navegador do Remotion; as próximas aberturas podem funcionar offline usando o que já estiver instalado. Compilador, curl/certificados e seletor Zenity podem exigir permissão administrativa se ausentes. Ambientes de voz podem ocupar vários GB e demorar na primeira instalação; as próximas aberturas reutilizam tudo. CUDA/drivers de GPU, credenciais de redes sociais e permissões de microfone continuam sendo escolhas/autorizações do usuário, não downloads automáticos.

**Diagnóstico:** caso o download falhe, a janela mostra o motivo e não inicia um servidor incompleto. No Windows execute `iniciar.bat` para rever mensagens. No Linux use `bash run.sh` no terminal. Para abrir sem instalar a transcrição (recursos de legenda automática não funcionarão), defina `CONTENTLAB_BOOTSTRAP_SKIP_WHISPER=1`.

**Personalização:** `CONTENTLAB_WHISPER_CLI` e `CONTENTLAB_WHISPER_MODEL` continuam aceitando ferramentas/modelos pré-existentes. Os downloads são feitos via HTTPS; Node, FFmpeg e modelo Whisper têm integridade SHA256 verificada. Caso haja falha na instalação, remova apenas o diretório problemático dentro de `.tools/` e execute o inicializador novamente.

**Abertura sem terminal permanente:** após a checagem, `server/launcher.mjs` inicia o servidor de modo destacado e abre automaticamente `http://127.0.0.1:5000`. O botão **Encerrar** do Studio continua finalizando o serviço. Para parar manualmente: `node server/launcher.mjs --stop` quando o Node estiver no PATH.

### Migração de planos anteriores

Existe **um único** schema: [`schemas/edit_plan.schema.json`](schemas/edit_plan.schema.json). O JSON não possui `version` no topo.

Para converter um `edit_plan.json` existente, preservando cópia de segurança:

```bash
npm run migrate:plan -- "/caminho/para/meu-video"
```

O script adapta planos existentes ao contrato único, valida todos os campos e preserva um backup. Em caso de erro, não sobrescreve o arquivo.

### Comandos

```bash
npm test
npm run render -- "/caminho/para/meu-video"
npm run render -- "/caminho/para/meu-video" --rebuild
node server/cli.mjs validate "/caminho/para/meu-video"
node server/smoke.mjs
```

## Contrato de autoria

Estrutura resumida:

```json
{
  "project": {"name": "Meu vídeo", "format": "youtube_long", "profile": "generic"},
  "sources": {"assets": "assets", "transcript": "transcript.json"},
  "audio": {"narration": "audio/narration.wav"},
  "timeline": [{
    "id": "batman",
    "start": 0,
    "end": 5,
    "layout": "3x3",
    "background": {"color": "#182238"},
    "elements": [{
      "id": "personagem",
      "type": "image",
      "asset": "project://assets/batman.png",
      "cells": [2, 5, 8],
      "transform": {"scale": 1.2}
    }]
  }]
}
```

Detalhes: [referência do JSON](EDIT_PLAN_REFERENCE.md), [motion design](MOTION_DESIGN_JSON.md) e [exemplos](examples/).

### Cenas TSX do projeto

Coloque componentes React/Remotion `.tsx` em `custom-scenes/` dentro da pasta do vídeo e referencie-os com `project://custom-scenes/Nome.tsx` no `edit_plan.json`. O Content Lab os renderiza normalmente, **sem variável de ambiente ou configuração extra**. TSX é código executável, não isolado em sandbox: abra somente projetos e componentes de origem confiável. O aplicativo restringe o caminho a `custom-scenes/` local e rejeita links simbólicos, mas isso não torna código desconhecido seguro.

## Organização do menu lateral

A navegação do Content Lab foi agrupada para ocupar menos espaço. **Editor → Editor automático / Multi-editor automático** e **Redes sociais → Publicações / Métricas** são categorias expansíveis; as outras áreas continuam com acesso direto. Apenas um grupo fica expandido por vez e clicar novamente no cabeçalho recolhe o submenu sem interromper a tela ativa. Os antigos links diretos `#editor`, `#multieditor`, `#publications` e `#metrics` continuam abrindo as respectivas áreas, com o grupo correto expandido. Em celulares, as categorias mantêm o mesmo comportamento, adaptadas para o menu compacto.

## Novo estúdio visual

A interface foi reformulada com uma identidade própria, monograma **CT**, navegação lateral, cores suaves e um storyboard por cena. No **Editor automático**, a lista à esquerda permite localizar cenas por ID, tempo ou texto. Selecione qualquer uma para ver seu MP4 salvo em cache (ou a versão anterior, caso o JSON tenha mudado), ajustar tempos, adicionar camadas, inserir, duplicar e excluir trechos — sem começar pelo JSON.

Os detalhes de câmera, fundo, animações e elementos permanecem acessíveis em uma área avançada. Alterações ficam como rascunho até você **Validar JSON → Salvar plano**.

Para criar motion design no editor, use **Sua linha do tempo → + Nova cena**, escolha quantas camadas quiser e ajuste grid 3×3, câmera, fundo e animações em **Editar propriedades avançadas**. O editor não impõe mais um formulário paralelo de duas imagens (esquerda/direita). O layout público `center_column` substitui a nomenclatura específica de um projeto antigo, preservada somente para compatibilidade interna de planos legados.

Veja [STUDIO_UI.md](STUDIO_UI.md) para o funcionamento do novo storyboard, cache e navegação.

## Sincronização, SFX e transições

Inserir ou duplicar uma cena no storyboard preserva o alinhamento das falas seguintes por meio de pausas explícitas na narração. SFX têm silêncio removido **somente nas bordas**, antes de serem inseridos no instante `at` do JSON; pausas internas são preservadas. Transições passam a usar os frames reais da cena entrante sem alterar a duração total. O cache visual não é invalidado por mudanças exclusivamente sonoras. O editor também permite desfazer/refazer e avisa sobre textos potencialmente sobrepostos.

Veja [CORRECOES_CACHE_AUDIO_TRANSICOES.md](CORRECOES_CACHE_AUDIO_TRANSICOES.md).

## Documentação e skill oficiais

A aba **Documentação** do site oferece o manual completo com navegação lateral, busca por campos, exemplos de JSON e diagramas SVG gerados por JavaScript. Há **somente três downloads de documentação**: **Documentação .md**, **Documentação .html** e **Skill .zip**.

O menu lateral tem **seis opções principais**: Vídeos e cortes, Narração, Editor, Redes sociais, Configurações e Documentação. **Editor** expande os submenus **Editor automático** e **Multi-editor automático**; **Redes sociais** expande **Publicações** e **Métricas**. Clique em um grupo para mostrar ou recolher as opções. O grupo da tela escolhida abre automaticamente, inclusive com links como `#editor`, `#multieditor`, `#publications` ou `#metrics`. As oito telas e os seus IDs permanecem, sem perder dados dos formulários ao trocar de área. O antigo Guia do projeto foi incorporado à Documentação, que agora inclui o primeiro acesso, uma árvore de pastas com arquivos gerados automaticamente, regras para caminhos `project://` e `builtin://`, um `edit_plan.json` completo de exemplo e a verificação de assets. Links antigos com `#guide` abrem diretamente a Documentação. Não há duplicação de abas nem de downloads.

A skill ZIP contém `SKILL.md`, a documentação oficial completa em Markdown e HTML, diagramas SVG, schema único e exemplos de edição. O HTML baixado é autossuficiente e inclui os diagramas sem precisar de internet para consultá-los. O Markdown referencia as figuras SVG versionadas no repositório.

Arquivos de referência: [Documentação Markdown](docs/Documentacao-ContentLab.md) · [Documentação HTML](docs/Documentacao-ContentLab.html).

O manual é gerado automaticamente a partir de `schemas/edit_plan.schema.json`, `server/docs-fields.mjs`, `server/docs-content.mjs` e `server/docs-diagrams.mjs`:

```bash
npm run docs:generate
npm run docs:check
```

Ao alterar o schema, os estilos ou as capacidades reais, revise as descrições, gere novamente e execute os testes. A validação automatizada verifica se todos os campos possuem explicação e se os arquivos publicados continuam sincronizados.

## Render e cache

O render por CPU escolhe automaticamente **até três cenas simultâneas**, conforme CPU/RAM e resolução, sem exigir RTX. Mantém ordem da timeline, qualidade e cache; sob pressão de memória, serializa novos trabalhos. GPU ativada ou paralelismo de frames personalizado mantém uma cena por vez. Não requer mudança no edit_plan.json. Para diagnóstico, `CONTENTLAB_SCENE_CONCURRENCY=1` força modo sequencial. Tempos e limite efetivo ficam no relatório final. Veja [política e limites](SCENE_CACHE.md).

No Editor automático:

- **Aproveitar cache**: mantém clipes por ID em `output/final/scenes/`; gera apenas cenas cuja assinatura mudou; reaproveita peças de composição válidas.
- **Refazer tudo**: com confirmação, limpa `output/` do projeto e gera tudo novamente. O sistema impede a exclusão se um asset de entrada estiver nessa pasta.

Os manifestos são persistidos antes da montagem final. Se houver falha na concatenação, a maior parte dos clipes continua disponível. Veja [SCENE_CACHE.md](SCENE_CACHE.md).

O resultado é `output/final/final.mp4`, com relatório `render_report.json`, narração preparada e listagem de cenas reaproveitadas.

## Transcrição

O adaptador de transcrição usa o executável `whisper-cli` e um modelo `ggml-*.bin` do whisper.cpp. Os inicializadores `run.sh` e `iniciar.vbs` preparam o executável e o modelo automaticamente, se necessário. Como alternativa, configure `CONTENTLAB_WHISPER_CLI` e `CONTENTLAB_WHISPER_MODEL` ou armazene o modelo na pasta `~/.cache/whisper.cpp/`. A segmentação e a precisão dos timestamps ainda precisam de comparação com o motor anterior.

## Estado e limites de validação

- Validação do contrato único e cache por cena: testes automáticos em Node.
- Render de ponta a ponta com Remotion + FFmpeg: smoke test na CI da branch.
- Downloads, corte, transcrição, CLI e HTTP: adaptadores Node implementados; ainda precisam de testes reais de compatibilidade.
- Empacotamento Windows, efeitos chroma/overlay, importação e recursos de interface: **paridade ainda não confirmada**.
- A skill do editor é gerada dinamicamente a partir do schema e dos guias atuais pela rota de download do aplicativo.
- Os módulos de runtime legados foram excluídos e a aplicação não depende mais de Python para abrir, renderizar, baixar mídia ou controlar projetos.

## Próximos passos de qualidade

1. Validar a renderização de um projeto real com assets disponíveis e comparar frames, áudio e transições.
2. Concluir testes de downloads e transcrição nativa, revisar limites de APIs externas.
3. Corrigir diferenças visuais e testes, atualizar skill e instalador Windows.
4. Medir desempenho de render e aprimorar os componentes de motion design Remotion/HyperFrames.
5. Integrar a branch ao `main` após os testes de aceitação.

[Direção Remotion/HyperFrames](MOTION_ENGINE_STRATEGY.md).

### Grid e transparência de camadas

`cells: [5,8]` já dimensiona automaticamente a caixa de um PNG nas duas células centrais inferiores. `fit: contain` preserva suas proporções, `transform.opacity: 0.65` controla transparência e `z` define qual camada fica acima. Os novos campos `transform.offsetX/offsetY` movem a camada em pixels depois do encaixe (+ direita/baixo), sem substituir o ajuste opcional por `transform.scale`.

### Trim e transições de áudio

O contrato aceita `audio.narrationTrim` para manter um único intervalo do áudio de voz ou `sourceCuts` para vários cortes (alternativas exclusivas), `audio.voice.fadeIn/fadeOut` e `audio.music[].sourceStart/sourceEnd` para tocar apenas parte de uma faixa. Músicas usam `start/end` como posição na timeline e se cruzam por sobreposição dos intervalos com `fadeOut` e `fadeIn`; `loop` repete o trecho escolhido, não a música inteira. Confira o capítulo Áudio da aba Documentação.

## Trim automático de silêncio nas bordas (narração e música)

O Content Lab aplica por padrão aos arquivos de **narração** e **música** a mesma detecção de silêncio nas bordas utilizada nos SFX (`silencedetect` do FFmpeg, aproximadamente -50 dBFS por 40 ms). Remove somente o silêncio inicial e terminal: **pausas internas, respirações e silêncios musicais no meio do trecho são preservados**. O áudio original nunca é sobrescrito.

- `audio.voice.autoTrimSilence: true` (padrão): detecta os limites audíveis da narração, inclusive depois de `narrationTrim` ou `sourceCuts`. O início real da fala passa a ser o tempo zero do áudio preparado e os timestamps das palavras da transcrição são remapeados para esse mesmo relógio. O `render_report.json` registra os segundos removidos em `narrationAutoTrim.start/end`.
- `audio.music[].autoTrimSilence: true` (padrão): detecta o silêncio das bordas da **seleção musical** (`sourceStart/sourceEnd`, ou faixa completa quando ausentes); o motor elimina essas bordas antes de repetir o trecho com `loop` e antes de aplicar `fadeIn/fadeOut`. Cada camada reporta `autoSilenceTrim.start/end` quando ocorreu trim.
- Especifique `false` em voz ou música quando houver silêncio intencional na introdução/saída que deva continuar audível como intervalo vazio.
- O trim é **automático e não requer preencher `sourceStart`, `sourceEnd`, `narrationTrim` ou `sourceCuts`**: esses campos continuam opcionais para recortes editoriais específicos. `trimDb` é volume em dB e não tem relação com remoção de silêncio.
- Crossfade de duas músicas continua funcionando por sobreposição de `start/end` e combinações `fadeOut/fadeIn`. Silêncio no meio dos arquivos continua intocado.
- A timeline de cenas permanece absoluta; a remoção do silêncio inicial desloca a fala para mais cedo. O renderizador remapeia os tempos das palavras para captions/kinetic text, mas **entradas manuais de cenas e SFX que tenham sido marcadas usando a gravação não limpa precisam ser revisadas** no Preview.

### Criação automática da transcrição do projeto

Ao criar um projeto no Studio e selecionar sua narração, o Content Lab vincula o arquivo ao plano, aplica `audio.voice.autoTrimSilence`, `audio.narrationTrim` ou `audio.sourceCuts`, `audio.silenceInserts`, salva `audio/narration.prepared.wav` e **transcreve esse arquivo preparado** para gerar automaticamente `transcript.json`, `transcript.txt` e `transcript.srt`. Não é obrigatório subir uma transcrição. O inicializador prepara `whisper-cli` e modelo base; outras qualidades (tiny/small/medium) são baixadas automaticamente ao solicitar a transcrição, com SHA256 verificado.

`sources.transcript` aponta automaticamente para `transcript.json`. Alterações no relógio da voz (cortes, pausas, troca do áudio) tornam a transcrição desatualizada e disparam uma nova geração após salvar; há também botão **Atualizar transcrição**. O render não aplica `sourceCuts`/`silenceInserts` novamente sobre timestamps de uma transcrição já gerada da narração preparada. Caso haja correções manuais, o Content Lab preserva um backup antes de substituir o arquivo numa regeneração. Textos podem ser normalizados manualmente ou com IA, mas os tempos devem continuar ligados à gravação real.


## Cenas especiais oficiais

Oferecimento do DiasVerso.

Os 15 padrões em [scene-library](scene-library/manifest.json) substituem os templates TSX antigos. Na aba Documentação, abra **Galeria de cenas especiais** para ver exemplos 16:9/9:16, parâmetros, sons e trechos JSON. Use **Preparar no projeto** para copiar o TSX para custom-scenes; não sobrescreve outra versão nem altera o plano/render automaticamente.

Os guias completos acompanham cada preset. Anton não usa sombra; Bangers mantém o acabamento HQ. As sete técnicas adaptadas são variantes de BrainstormHQ, PaginaHQCenas e TextoHQ, sem duplicação. Fontes e mídia são configuradas em customComponent.assets; SFX continuam explícitos no plano. As cópias já presentes nos projetos antigos permanecem intactas.

Flip e Curtain são transições nativas entre duas cenas: transitionOut: flip ou curtain, com transitionDuration em segundos, e não cenas TSX. Blur continua disponível nas quatro direções.

### Catálogo dos 15 presets

Os contratos e auxiliares são sincronizados por `node scripts/sync-scene-library.mjs` (`--check` somente verifica). A cópia manual deve incluir todos os companions do manifesto, incluindo `HQMotion.tsx` quando listado. As entradas mantêm relógio por frame; leia o significado de `at` em cada guia. Texto HQ oferece kinetic por palavra, Quadro HQ permite configurar a compactação e Caixinha mantém gestos/cliques independentes. Veja [guia da biblioteca](scene-library/README.md). Nenhum projeto existente é sobrescrito automaticamente.

| Padrão | Função |
| --- | --- |
| [Fundo HQ](scene-library/background-hq/README.md) | Fundos sólido, retícula, papel, grade, estrelas e filme. |
| [Barra de progresso HQ](scene-library/barra-loading-hq/README.md) | Progresso com pausas e mudanças de cor. |
| [Brainstorm HQ](scene-library/brainstorm-hq/README.md) | Nós, percursos, narrativa e evidências com câmera. |
| [Caixinha HQ](scene-library/caixinha-hq/README.md) | Caixas livres e presets sociais com entradas e gestos. |
| [Carrossel de frases HQ](scene-library/carrossel-frases-hq/README.md) | Próxima frase acima, ativa central e anterior abaixo. |
| [Comparativo de ideias HQ](scene-library/comparativo-ideias-hq/README.md) | Compare de duas a quatro imagens e textos. |
| [Encerramento HQ](scene-library/cta-encerramento-hq/README.md) | Indicação de vídeo no vertical; dois vídeos e canal no horizontal. |
| [Diálogo HQ](scene-library/dialogo-hq/README.md) | Dois participantes alternam destaque e falas. |
| [Galeria de cartas HQ](scene-library/galeria-cartas-hq/README.md) | Imagens entram e se empilham por coluna. |
| [Imagem e frases HQ](scene-library/imagem-frases-hq/README.md) | Imagem com brilho e frases sincronizadas ao lado. |
| [Linha do tempo HQ](scene-library/linha-do-tempo-hq/README.md) | Clipes percorridos em ordem ou reverso, com expansão. |
| [Página HQ Cenas](scene-library/pagina-hq-cenas/README.md) | Grid, dois painéis, divisão de escolhas e Parallax. |
| [Personagem, espiral e legenda](scene-library/personagem-espiral-legenda/README.md) | Personagem sobe sobre espiral pixelada e legenda por palavra. |
| [Quadro HQ sobre cena](scene-library/quadro-hq-sobre-cena/README.md) | Etiqueta e caixa de narração sobre mídia externa. |
| [Texto HQ](scene-library/texto-hq/README.md) | Frases/palavras com Anton ou Bangers, escrita e Kinetic. |

### Página HQ transparente

O fundo **Página HQ transparente** (`backgroundStyle: "comic_page"`) está disponível nos 15 presets, incluindo BackgroundHQ, e no Studio de Thumbnails (`background.style: "comic_page"`). Usa a arte original com divisórias e canal alfa. Controle a intensidade com `backgroundOpacity` (TSX) ou `textureOpacity` (thumbnail), entre 0 e 100. Nos vídeos, use `mode: "overlay"` para manter a mídia da cena por trás. A imagem preenche sem distorcer; em retrato, pode recortar as laterais.

**Preparar no projeto** inclui automaticamente `HQComicPage.tsx`. Na instalação manual, copie o TSX escolhido **e** esse auxiliar para `custom-scenes/`; uma única cópia do auxiliar atende a todos os presets. O PNG também está disponível como `builtin://backgrounds/background_pagina_hq.png`. Não é necessário manter o arquivo em Downloads.
