# Content Lab — Node.js + Remotion

Editor automático e utilitários de vídeo para projetos de conteúdo e motion design, com servidor Node.js, interface JavaScript, Remotion e FFmpeg. Os testes automatizados Linux e Windows estão disponíveis no GitHub Actions. A validação estética final continua dependendo dos arquivos e objetivos de cada projeto real.

## Tecnologias

- **Node.js 22+**: servidor HTTP, validação, projetos, cache, cortes, áudio e automações.
- **JavaScript e React/TypeScript**: interface web atual e composições Remotion.
- **Remotion**: renderizador visual das cenas, com keyframes, textos, PNGs, vídeo e câmera.
- **FFmpeg/FFprobe**: cortes, concatenação, transições, normalização, mixagem e verificação do MP4.
- **YouTube.js (`youtubei.js`)**: cliente JavaScript para fontes do YouTube.
- **whisper.cpp**: ferramenta local de transcrição executada diretamente pelo servidor Node.

Remotion concentra a renderização visual; o FFmpeg continua responsável por áudio, cortes e composição final. O código de servidor utiliza exclusivamente Node.js.

## Métricas — painel de desempenho conectado

A aba **Métricas**, localizada após Publicações, começa com um convite para conectar contas OAuth. Assim que pelo menos uma rede estiver autorizada, apresenta uma **Visão geral** com dados das plataformas conectadas. Clique no ícone de YouTube, Instagram ou TikTok para filtrar; clique novamente no ícone selecionado para voltar ao geral.

- **YouTube:** últimos 50 uploads do canal (até 20 vídeos públicos mostrados), visualizações, curtidas, comentários e possíveis publicações futuras retornadas por `status.publishAt`. O app solicita também o escopo `youtube.readonly` além de `youtube.upload`.
- **Instagram:** até 20 mídias recentes, com foco em vídeos, legendas, curtidas/comentários quando fornecidos e tentativa de consultar `views` para até oito vídeos. Métricas indisponíveis ficam como `—` em vez de zero. Não exibe agendamentos do Instagram.
- **TikTok:** até 20 vídeos públicos recentes da Display API, com views, curtidas, comentários e compartilhamentos. Exige o escopo adicional `video.list` habilitado no aplicativo TikTok. Não apresenta rascunhos nem vídeos programados no TikTok Studio.
- **Resumo:** últimas publicações, indicadores dos itens retornados, agendamentos disponíveis no YouTube e barras comparativas. Os totais são apenas da **amostra recente**, não do histórico inteiro dos perfis; nenhuma métrica é inventada.
- **Atualização:** o backend conserva respostas por 2 minutos para economizar quotas. O botão Atualizar força nova leitura. Cada plataforma falha isoladamente e sugere reconexão quando faltarem permissões.

Se você autorizou YouTube ou TikTok antes de incluir Métricas, use **Publicações → Conectar novamente** para conceder os novos escopos. O Content Lab guarda os tokens no `.env` local ignorado pelo Git e **não** envia tokens ao frontend do painel. A aba consulta `GET /api/social/metrics?platform=general|youtube|instagram|tiktok`; `refresh=1` ignora o cache temporário. Nenhuma informação fica agendada para atualização em segundo plano.

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

1. Abra **Publicações → Configurar credenciais do aplicativo OAuth** e escolha YouTube, Instagram ou TikTok.
2. Crie um aplicativo no portal de desenvolvedores da rede e copie o **Client ID/Key** e o **Client Secret** para a tela. São credenciais da integração, não a senha da sua conta.
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

**Compatibilidade do TSX Diazverso:** na versão do Remotion 4.0.530, ao usar `<OffthreadVideo loop />` é necessário indicar `durationInFrames` finito. Os projetos SH_0005 a SH_0010 devem usar o `DiazversoFlowHQ.tsx` corrigido em suas pastas `custom-scenes/`. Alterações no Drive não são transferidas automaticamente para o computador local; copie o arquivo atualizado ou substitua pelo ZIP de correção.

## Instalação automática e inicialização

**Não é necessário instalar manualmente Node.js, FFmpeg, whisper.cpp ou o modelo de transcrição.** O Content Lab verifica as dependências e prepara o que estiver faltando antes de abrir o navegador.

- **Zorin/Ubuntu/Linux:** execute `bash run.sh` (ou `./run.sh`) na pasta do repositório. Para criar um atalho no menu de aplicativos, execute `bash instalar-atalho.sh` uma única vez. O atalho abre um terminal durante a primeira instalação para mostrar downloads/avisos e, caso faltem compiladores, solicitar a senha do `sudo`.
- **Windows 10/11:** dê duplo clique em `iniciar.vbs` ou execute `iniciar.bat`. A instalação inicial abre uma janela de progresso e fecha após iniciar o servidor. Não exige instalação global do Node nem acesso de administrador para as ferramentas portáteis.
- **Modo de desenvolvimento:** `npm start` continua iniciando apenas o servidor e pressupõe runtime/dependências já preparadas. Para primeira instalação, use um dos inicializadores acima.

Na primeira execução, o instalador confere e prepara, conforme necessário:

1. **Node.js 22+ e npm:** utiliza uma instalação válida encontrada no sistema ou baixa o Node.js 22.16.0 portátil do site oficial, verificando SHA256.
2. **FFmpeg + FFprobe + filtro `rubberband`:** verifica também `ffmpeg -hide_banner -filters` para confirmar que o pitch do Grave suave/equilibrado/profundo funciona. Se o FFmpeg instalado não tiver `rubberband`, baixa automaticamente a versão GPL portátil BtbN/FFmpeg-Builds com `librubberband`, valida o manifesto SHA256 e verifica o filtro no executável baixado. Se já houver uma instalação capaz, reutiliza sem baixar novamente. O binário fica em `.tools/ffmpeg`, sem sobrescrever o FFmpeg do sistema.
3. **whisper.cpp:** reutiliza `whisper-cli` se instalado. No Windows baixa o binário CPU da release v1.9.4; no Linux baixa o código v1.9.4 e compila localmente. Se faltarem `cmake`, `c++` ou `make` no Zorin/Ubuntu, solicita autorização via `sudo apt-get` para instalar ferramentas de compilação.
4. **Modelo Whisper multilíngue `base`:** reaproveita `CONTENTLAB_WHISPER_MODEL` ou `~/.cache/whisper.cpp/ggml-base.bin`; senão baixa `ggml-base.bin` do repositório oficial do autor no Hugging Face, com hash SHA256 verificado. É necessário para a transcrição automática ao importar a narração.
5. **Dependências Node/Remotion:** instala o que falta com npm. As verificações de manifesto evitam reinstalar `node_modules` em toda abertura. Após mudanças em `package.json` ou no lockfile do Remotion, reinstala somente o conjunto afetado.
6. **Chrome Headless Shell do Remotion:** executa a verificação oficial `remotion browser ensure`, baixando o navegador compatível quando necessário. Depois disso o primeiro render não depende de descobrir um Chrome ainda ausente.

As ferramentas que forem baixadas ficam em **`.tools/` dentro do Content Lab** (ignorada pelo Git), sem alterar o Node de outros projetos nem as variáveis PATH globais. O primeiro setup requer internet e espaço em disco para os binários, o modelo (~148 MB) e os pacotes npm e o navegador do Remotion; as próximas aberturas podem funcionar offline usando o que já estiver instalado. O compilador Linux é a única parte que pode exigir permissão administrativa.

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

A interface mantém **quatro áreas de trabalho**: Vídeos e cortes, Transcrição, Editor automático e Documentação. O antigo Guia do projeto foi incorporado à Documentação, que agora inclui o primeiro acesso, uma árvore de pastas com arquivos gerados automaticamente, regras para caminhos `project://` e `builtin://`, um `edit_plan.json` completo de exemplo e a verificação de assets. Links antigos com `#guide` abrem diretamente a Documentação. Não há duplicação de abas nem de downloads.

A skill ZIP contém `SKILL.md`, a documentação oficial completa em Markdown e HTML, diagramas SVG, schema único e exemplos de edição. O HTML baixado é autossuficiente e inclui os diagramas sem precisar de internet para consultá-los. O Markdown referencia as figuras SVG versionadas no repositório.

Arquivos de referência: [Documentação Markdown](docs/Documentacao-ContentLab.md) · [Documentação HTML](docs/Documentacao-ContentLab.html).

O manual é gerado automaticamente a partir de `schemas/edit_plan.schema.json`, `server/docs-fields.mjs`, `server/docs-content.mjs` e `server/docs-diagrams.mjs`:

```bash
npm run docs:generate
npm run docs:check
```

Ao alterar o schema, os estilos ou as capacidades reais, revise as descrições, gere novamente e execute os testes. A validação automatizada verifica se todos os campos possuem explicação e se os arquivos publicados continuam sincronizados.

## Render e cache

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

Ao criar um projeto no Studio e selecionar sua narração, o Content Lab vincula o arquivo ao plano, aplica `audio.voice.autoTrimSilence`, `audio.narrationTrim` ou `audio.sourceCuts`, `audio.silenceInserts`, salva `audio/narration.prepared.wav` e **transcreve esse arquivo preparado** para gerar automaticamente `transcript.json`, `transcript.txt` e `transcript.srt`. Não é obrigatório subir uma transcrição. Necessário instalar `whisper-cli` e modelo whisper.cpp (padrão `base`).

`sources.transcript` aponta automaticamente para `transcript.json`. Alterações no relógio da voz (cortes, pausas, troca do áudio) tornam a transcrição desatualizada e disparam uma nova geração após salvar; há também botão **Atualizar transcrição**. O render não aplica `sourceCuts`/`silenceInserts` novamente sobre timestamps de uma transcrição já gerada da narração preparada. Caso haja correções manuais, o Content Lab preserva um backup antes de substituir o arquivo numa regeneração. Textos podem ser normalizados manualmente ou com IA, mas os tempos devem continuar ligados à gravação real.


## Novos exemplos de motion reutilizável e música (outubro de 2026)

A auditoria do VD_0005 resultou em quatro **exemplos TSX agnósticos ao roteiro** dentro de [`examples/custom-scenes/`](examples/custom-scenes): `NarrativePath.tsx` (travelling por argumento), `EvidenceConstellation.tsx` (rede de personagens/evidências), `PixelNotification.tsx` (notificação com contador visual SVG sem fonte externa) e `ComicMotionKit.tsx` (linguagem HQ: painéis, tinta, balão, impacto, split). Referência: [`VD0005_REUSABLE_REVIEW.md`](VD0005_REUSABLE_REVIEW.md). **São exemplos copiáveis para `<projeto>/custom-scenes/`, não presets nativos da interface, nem parte do vídeo já finalizado.** Ainda requerem render de prova para homologação visual.

A [auditoria musical](MUSIC_LIBRARY_DIAZVERSO.md) confirma três músicas do vídeo já internas e três candidatas a importação **local**. O script [`scripts/import-diazverso-music.mjs`](scripts/import-diazverso-music.mjs) instala os MP3s obtidos legitimamente no ContentLab do operador após confirmação da licença; não baixa nem comita músicas para distribuição pública. Para novos vídeos Diazverso, a direção HQ em movimento é **opção experimental**, sem alterar o edit_plan ou cenas do VD_0005.
