# Studio UI — nova interface do Content Lab

## Identidade visual

Interface original do Content Lab com linguagem editorial de software criativo: fundo claro, superfícies suaves, tipografia de sistema, cartões bem espaçados, navegação lateral e azul discreto nas ações primárias.

- Monograma autoral **CT** em SVG: `frontend/static/contentlab-mark.svg`.
- Sistema de design: `frontend/static/studio.css`, carregado após `style.css` para manter compatibilidade dos componentes antigos.
- Responsivo: navegação lateral em telas largas; navegação horizontal e layout empilhado em telas menores.
- Usabilidade: rótulos claros, contraste, navegação por teclado, controles com foco e respeito a movimento reduzido.

O projeto é inspirado na clareza visual de aplicativos contemporâneos e **não** replica logotipos, ícones ou identidade comercial da Apple.

## Banco de mídia e acervo online

**Banco de mídia** é uma área própria de pesquisa de mídia com filtros, prévia, créditos e licença, além de download protegido por confirmação de direitos. Prioriza a busca comum do **YouTube e Pinterest**; o filtro Creative Commons do YouTube e os acervos Wikimedia Commons/Internet Archive são seleções adicionais. A pesquisa Pinterest usa o endpoint público de busca de pins inspirado no projeto pinterest-dl e fornece resultados de imagem/vídeo quando o CDN pinimg.com disponibiliza mídia direta. Resultados de fontes indisponíveis não bloqueiam as demais. Fotos são armazenadas em Downloads/ContentLab/Imagens e vídeos utilizam o cache existente para cortes. Pins de fotos e vídeos MP4 públicos podem ser importados (desde que o usuário confirme seus direitos); consultas podem ser bloqueadas ou exigir login e a interface oferece o link para pesquisar diretamente no Pinterest. TikTok permanece com pesquisa externa, sem download integrado.

A API local expõe `GET /api/library/search`, `POST /api/library/download` e `GET /api/library/jobs/:id`. Não aceita URLs arbitrárias para download: só as chaves temporárias geradas na busca, com regras de hosts HTTPS permitidos e tamanho máximo 240 MB. Sem bypass de DRM ou streaming protegido. O usuário deve verificar os direitos e o crédito na origem antes de importar.

## Navegação lateral agrupada

O menu apresenta sete opções de primeiro nível: **Vídeos e cortes**, **Narração**, **Editor**, **Redes sociais**, **Configurações** e **Documentação**. Ao clicar em **Editor**, aparecem **Editor automático** e **Multi-editor automático**; ao clicar em **Redes sociais**, aparecem **Publicações** e **Métricas**. São submenus expansíveis que mostram uma categoria por vez; clicar novamente em uma categoria a recolhe sem fechar a tela já aberta.

Os IDs originais `tab-editor`, `tab-multieditor`, `tab-publications` e `tab-metrics` e as respectivas seções `panel-*` foram preservados. Links por fragmento `#editor`, `#multieditor`, `#publications` e `#metrics` abrem a área correta e expandem automaticamente o seu grupo. O grupo ativo recebe uma marca visual mesmo quando recolhido. Os botões são acessíveis por teclado e os submenus têm `aria-expanded` e identificação própria; a navegação móvel respeita a mesma estrutura.

## Conexões sociais — gerenciamento centralizado

Os provedores sociais mantêm identidade da conta, permissões concedidas, data de expiração e diagnóstico de reconexão. O botão **Verificar conexão** consulta o perfil pela API oficial e atualiza os dados não sensíveis da interface. Renovação simultânea é deduplicada no backend e falhas na renovação permitem voltar ao consentimento OAuth, sem solicitar senhas pessoais.

YouTube solicita também `yt-analytics.readonly` e disponibiliza relatório diário independente da amostra recente. Instagram solicita `instagram_business_manage_insights` e pode retornar estatísticas opcionais de conta e mídia; TikTok solicita `user.info.profile` e `user.info.stats`, mas o acesso depende da liberação do provedor. Quando informações opcionais falham, vídeos e métricas das demais redes permanecem acessíveis.

Para o Instagram local, `server/instagram-bridge.mjs` aceita exclusivamente o callback e redireciona ao Content Lab em `127.0.0.1`. Aponte seu túnel HTTPS **somente para a porta 5151**, nunca para a porta da API 5000, e cadastre a URL exata no aplicativo Meta e em Configurações. Detalhes em [docs/INSTAGRAM_OAUTH_LOCAL.md](docs/INSTAGRAM_OAUTH_LOCAL.md).

## Assistente para login social

O fluxo preferencial é um clique no cartão e autorização no provedor oficial. Quando falta cadastro do aplicativo OAuth, o botão abre um assistente com passos da rede, link para portal oficial, documentação e URL de callback. Os campos Client ID/Secret estão em **Configuração avançada** e aparecem apenas ao optar por preenchê-los.

YouTube tem **Importar JSON do Google** para credenciais OAuth de aplicativo Desktop: verifica o JSON no navegador, envia Client ID/Secret para a API local existente e redireciona para o login oficial, sem importar tokens pessoais. Google Desktop usa PKCE S256 e escolha da conta; TikTok Desktop usa PKCE S256, Instagram usa consentimento empresarial com callback HTTPS. Em caso de falha do callback, a tela reabre o guia da rede para ajudar a diagnosticar permissões e URLs.

As três plataformas exigem aplicativos OAuth cadastrados; esta UI não pode substituir aprovações ou permissões externas nem conectar Instagram/TikTok apenas com a permissão Google. Não guardar senhas pessoais, tokens ou client secrets no frontend ou nos commits Git.

## Configurações — contas OAuth e permissões

A aba **Configurações** concentra os cartões de YouTube, Instagram e TikTok com status, botão de conexão e desconexão. Não há formulário de login na aba Publicações. Os cartões usam a identidade visual do Studio e mostram **Conectar com Google** para YouTube; os demais abrem o site oficial de autorização de cada provedor.

Um acordeão **Configuração avançada** recolhido guarda os campos opcionais para registrar o aplicativo OAuth quando necessário (Client ID/Secret da aplicação; callback HTTPS do Instagram). São credenciais do aplicativo, nunca senhas pessoais. Contas previamente configuradas no `.env` só precisam da autorização. O login Google solicita a seleção de conta; o consentimento Instagram/TikTok é separado, mesmo que a conta social tenha sido criada com Google.

**Portas de acesso:** quando não existe conta autorizada, a aba Publicações mostra apenas o convite para Configurações e mantém o editor oculto; Métricas mostra o mesmo direcionamento. Depois de conectar alguma rede, Publicações exibe somente destinos já autorizados e mantém a impossibilidade de enviar vídeos 16:9 ao TikTok.

## Métricas — dashboard conectado

A aba **Métricas** abre depois de Publicações. Sem OAuth, exibe somente o convite para conectar as contas. Com ao menos uma conta, exibe a visão geral e botões de filtro YouTube, Instagram e TikTok. Um segundo clique no botão selecionado retorna à visão geral.

O painel apresenta últimos vídeos, views/curtidas disponíveis, agendamentos retornados pelo YouTube, destaques em barras e avisos sobre limites das APIs. Números são calculados somente sobre a amostra de vídeos recentes e **nunca inventados**; informação indisponível aparece como `—`.

YouTube exige `youtube.readonly`, TikTok exige `video.list`, além das permissões de publicação anteriores. A API de métricas é apenas leitura, mantém tokens no servidor e faz cache de 2 minutos. Cada rede com falha é exibida separadamente, preservando as que responderam. Não há relatórios históricos persistidos nem monitoramento em segundo plano.

## Publicações — distribuição de vídeos

A aba **Publicações** permanece oculta até uma autorização OAuth válida. A conexão/desconexão fica exclusivamente em **Configurações**; Publicações cuida apenas da seleção de MP4s, metadados e envios com confirmação explícita. Tokens e configuração do aplicativo continuam no `.env` local ignorado pelo Git.

- Formato **16:9**: somente YouTube/Instagram; TikTok fica acinzentado e não recebe o vídeo. Formato **9:16**: as três redes. Backend verifica resolução com FFprobe.
- YouTube agenda com `publishAt` e exige escolher se o vídeo é para crianças.
- Instagram faz upload resumível e espera processamento antes de publicar.
- TikTok exige consulta de privacidade da conta e consentimento para publicar; upload aceito não significa post moderado.
- Legendas de Instagram/TikTok combinam título + linha em branco + descrição, convertendo `#Shorts` em `#Viral`.
- A imagem de capa externa ainda não é transmitida; o campo de frame é usado em Instagram/TikTok.
- A busca automática dos finais de projetos ainda não está presente; arquivos MP4 são escolhidos manualmente.
## Editor de cenas

Ao abrir um projeto, o storyboard fica dividido em duas áreas:

**Lista de cenas:** número, ID, intervalo, quantidade de camadas, resumo dos elementos, campo de busca e status do cache.

**Painel da cena:** vídeo individual salvo em `output/final/scenes/` (quando disponível), status, início/fim/ID, ações rápidas de inserir, duplicar e excluir, botão para adicionar camada e parâmetros avançados de fundo/câmera/animação.

Uma edição simples não exige editar JSON manualmente. Os campos do editor visual continuam produzindo `edit_plan.json`, que é a fonte única da verdade. O usuário precisa **Validar JSON → Salvar plano** para renderizar.

**Motion design:** o fluxo é sempre **Sua linha do tempo → + Nova cena → Adicionar camada → Editar propriedades avançadas**. No painel da cena é possível compor qualquer quantidade de PNGs, vídeos, textos ou efeitos, escolher posições no grid 3×3, configurar fundos de cor/imagem/vídeo (incluindo `background.loop`), câmera, transições e keyframes. Não há mais um formulário duplicado restringindo a cena a apenas duas imagens laterais.

### Ações e linha do tempo

O storyboard possui **Desfazer** e **Refazer** para edições visuais, inclusive criação, exclusão, inserção e duplicação. Inserir/duplicar agora escreve uma pausa na narração (`audio.silenceInserts`) e desloca eventos posteriores; editar manualmente o JSON reinicia o histórico visual. Veja [guia de sincronização](CORRECOES_CACHE_AUDIO_TRANSICOES.md).


- **+ Nova cena:** acrescenta uma cena de cinco segundos após o último trecho.
- **Inserir após:** insere imediatamente depois da cena selecionada e desloca os timestamps absolutos das cenas seguintes, incluindo camadas e SFX, para evitar sobreposição.
- **Duplicar:** duplica uma cena e seus elementos, cria um ID novo e insere após a original; as seguintes são deslocadas.
- **Excluir:** remove a cena mantendo o intervalo anterior da timeline como espaço em preto. O usuário recebe confirmação.
- **Adicionar camada:** escolha entre imagem, vídeo, texto, legenda, sobreposição ou SFX. Complete os assets em **Propriedades avançadas**.
- **Buscar:** filtra por ID, número, tempo ou texto de camadas sem descartar a cena em edição.

### Cache por cena

O endpoint `GET /api/editor/scenes?projectRoot=...` lista os estados `ready`, `changed` e `missing`. A assinatura atual leva em conta o JSON salvo e suas dependências.

O endpoint `GET /api/editor/scenes/:id/media?projectRoot=...` transmite **somente** o MP4 previamente gerado para um ID pertencente ao projeto. Há verificação de manifesto, nome de arquivo derivado de ID seguro, tamanho, mtime e links simbólicos.

- **Em cache:** arquivo consistente com a cena salva.
- **Alterada:** o JSON mudou; o vídeo anterior ainda pode ser visto, mas é identificado como versão anterior.
- **Sem render:** não há segmento íntegro em cache.
- A reprodução de uma cena **não** inicia renderização nem cria Preview completo.
- Os clipes por cena são visuais e não contêm toda a mixagem da narração/trilha.

**Aproveitar cache** continua sendo o comando para atualizar os clipes modificados e gerar o MP4 final; **Refazer tudo** apaga `output/` após confirmação.

## Validação

O CI inclui testes Node de estado do cache/segurança e teste de interface em Chromium/Chrome headless: carregar projeto, selecionar e buscar cenas, criar e duplicar, preservar os IDs e exportar captura de tela.

Os testes de integração existentes do render, transcrição, downloads e inicialização Node no Windows/Linux permanecem ativos.

## Próximas melhorias

O editor já utiliza os vídeos em cache para revisão por cena, mas o futuro `@remotion/player` trará mudanças de posição/escala com atualização de frames sem render. Isso será uma próxima etapa, distinta do antigo Preview de vídeo completo.
