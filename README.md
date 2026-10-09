# Content Lab

Aplicação local para baixar vídeos ou áudios do YouTube, criar cortes, gerar
transcrições e produzir uma edição automática a partir de `edit_plan.json`,
narração e assets. Os vídeos completos ficam em cache para serem reutilizados
em novos cortes. A fonte pode vir de um link do YouTube, de um item já em cache
ou de um vídeo existente no computador. No caso local, o Content Lab copia o
arquivo para o cache persistente sem mover nem alterar o original. O editor gera
render final e rough cut, mantendo relatórios de validação e renderização.

## Estrutura

```text
backend/                 servidor Flask e processamento de mídia
backend/remotion/        motor de cenas 0.2 em React e TypeScript
frontend/templates/      página HTML
frontend/static/         JavaScript, estilos e imagens
run.sh                   inicialização no Linux
iniciar.bat              inicialização no Windows
debug.bat                inicialização com logs no Windows
build.bat                geração do executável para Windows
ContentLab.spec          configuração do PyInstaller
schemas/                 contrato JSON do plano de edição
examples/                exemplos de planos
tests/                   testes unitários e aceite integrado
MVP_ACCEPTANCE.md        checklist de aceite da fase 10
VISUAL_TESTING.md        harness visual + Iris para Codex/Claude Code/agentes MCP
AGENTS.md                instruções de validação para coding agents
skillContentLabEdicao.zip  skill para o GPT criar planos de edição JSON
EDIT_PLAN_REFERENCE.md  funções e parâmetros do editor automático
```

## Como organizar um projeto de edição

Crie **uma pasta por vídeo**. Você pode começar só com uma pasta vazia:
na aba **Transcrição**, escolha visualmente essa pasta e a narração. O Content
Lab criará `audio/` e salvará `transcript.json`, `transcript.txt` e
`transcript.srt` nela. **O `edit_plan.json` só é necessário depois**, quando
você abrir o Editor automático. Alternativamente, **Editor automático →
Criar** prepara antecipadamente `edit_plan.json`, `audio/` e `assets/`.
A aba **Guia do projeto** mostra a estrutura final recomendada:

```text
meu-video/
├── edit_plan.json              plano de edição (necessário para abrir o projeto)
├── audio/
│   ├── narracao.wav            voz usada no render
│   ├── musica.mp3              opcional
│   └── impacto.wav             opcional
├── assets/
│   ├── abertura.mp4            vídeos e imagens
│   ├── personagem.png
│   └── personagens/
│       └── heroi.png           subpastas são permitidas
├── transcript.json             gerado pela aba Transcrição; tempos por palavra
├── transcript.txt              leitura humana com timestamps
├── transcript.srt              legendas tradicionais
└── output/                     criado após renderizar
```

Os nomes acima são exemplos. **O arquivo e o caminho no JSON devem corresponder
exatamente**, incluindo extensão e, no Linux, maiúsculas/minúsculas. Use `/`
como separador nos caminhos do JSON, inclusive no Windows. A narração usa um
caminho relativo à raiz do projeto: `"narration": "audio/narracao.wav"`.
Imagens, vídeos, músicas e efeitos usam URIs com `project://` seguido do
caminho **a partir da raiz do projeto**:

```json
{
  "sources": {"assets": "assets", "transcript": "transcript.json"},
  "audio": {
    "narration": "audio/narracao.wav",
    "music": [{"asset": "project://audio/musica.mp3", "start": 0, "end": 30}]
  },
  "timeline": [{
    "id": "intro", "start": 0, "end": 5,
    "elements": [
      {"type": "video", "asset": "project://assets/abertura.mp4"},
      {"type": "image", "asset": "project://assets/personagens/heroi.png"}
    ]
  }]
}
```

O trecho acima demonstra os caminhos, **não é um plano completo**; um arquivo
válido precisa também de `version` e `project`. Veja
[o exemplo mínimo](examples/minimal-edit-plan.json) e
[a referência completa](EDIT_PLAN_REFERENCE.md). `sources.assets` registra
uma pasta preferida, mas **não adiciona `assets/` automaticamente** aos URIs:
escreva o caminho completo em cada `asset`. Arquivos embutidos no aplicativo
usam `builtin://`; arquivos próprios usam `project://`. O resolver bloqueia
caminhos que tentem sair dessas raízes. No editor, **Listar** mostra os URIs
dos arquivos e **Validar JSON** aponta os ausentes antes do render.

A transcrição é opcional para cenas sem texto sincronizado. Para legendas
karaoke, carregue a narração na aba **Transcrição** e use
`"sources": {"transcript": "transcript.json"}`. O JSON da transcrição também
ajuda o GPT, junto da skill `skillContentLabEdicao.zip`, a gerar um plano
alinhado aos tempos da voz.

## Linux

Requisitos: Python 3.9 ou superior, suporte a `venv`, FFmpeg e FFprobe. Para o
seletor visual de pastas, tenha Tkinter ou Zenity disponível em uma sessão
gráfica; se não houver, os campos aceitam o caminho digitado.

No Ubuntu/Debian:

```bash
sudo apt install python3 python3-venv ffmpeg
./run.sh
```

No Fedora, instale `python3` e `ffmpeg` com `dnf`. No Arch Linux, use os
pacotes `python` e `ffmpeg`. O script cria `.venv`, instala as dependências
Python e Remotion e prepara uma cópia local do Node quando necessária,
abre o navegador quando há uma sessão gráfica e inicia o servidor em
<http://127.0.0.1:5000>.

Se o seletor gráfico de pastas não estiver disponível, digite diretamente no
campo da interface um caminho absoluto, como `/home/usuario/Vídeos`.

No Linux, o cache fica em `${XDG_CACHE_HOME:-~/.cache}/contentlab/cache/videos`.

### Vídeo já existente no computador

Na aba **Vídeos e cortes**, a fonte possui três modos:

- **Link do YouTube** — baixa a fonte completa uma vez e mantém no cache;
- **Vídeo em cache** — reutiliza uma fonte já preparada;
- **Arquivo do computador** — abre o seletor nativo, copia o vídeo para o cache
  e preserva o arquivo original.

A importação local aceita `.mp4`, `.mkv`, `.webm`, `.mov`, `.m4v` e
`.avi`. Depois da cópia, a fonte recebe uma referência interna
`contentlab-cache://...` e passa pelo mesmo pipeline dos vídeos do YouTube:
preview, corte único, extração de áudio, transcrição e cortes em lote.

Para vários clipes, habilite **múltiplos** e use:

```text
tempo inicial;tempo final;título
00:15:22;00:15:35;005_reencontro
00:42:10;00:42:28;006_confronto
```

A transcrição completa, quando gerada, fica no mesmo cache da fonte e é
reutilizada em pedidos posteriores. Os timestamps exportados continuam
referenciando o vídeo-fonte original, o que permite montar o CSV de cortes
diretamente a partir da localização das cenas.

## Windows

Execute `iniciar.bat`. Na primeira execução, o script cria `.venv` e instala
as dependências Python e Remotion. O Node também é preparado localmente se
não estiver instalado. O aplicativo abre no navegador e permanece disponível no
ícone da bandeja.

O FFmpeg é localizado no `PATH`, WinGet, Chocolatey ou Scoop. Se ele não for
encontrado, o próprio aplicativo baixa a versão compatível para
`%LOCALAPPDATA%\ContentLab\ffmpeg\bin`.

Para criar o executável independente, execute `build.bat`. O resultado fica
em `dist\ContentLab.exe`.

## Desenvolvimento

Com o ambiente virtual ativo, inicie somente o servidor:

```bash
python -m backend.app
```

Valide um plano de edição ou liste as capacidades registradas:

```bash
python -m backend.contentlab.cli validate examples/minimal-edit-plan.json
python -m backend.contentlab.cli plugins
python -m backend.contentlab.cli render caminho/para/edit_plan.json
python -m backend.contentlab.cli render caminho/para/edit_plan.json --mode final
```

O primeiro comando também verifica a existência da narração e dos assets. Um
plano estruturalmente correto pode retornar código 2 enquanto os arquivos do
projeto exemplo ainda não tiverem sido adicionados.

### Testes visuais com Iris e coding agents

Alterações de renderer/UI não devem ser consideradas visualmente corretas apenas
porque o código compila ou os unit tests passam. O projeto possui um harness
determinístico que renderiza fixtures sintéticas com o próprio Content Lab:

```bash
python -m unittest discover -s tests -q
python -m tests.visual_acceptance
python -m backend.app
```

Depois abra:

```text
http://127.0.0.1:5000/visual-tests
```

A página permite escolher checkpoints como `word-stack`, `crt-dim-png`,
`caption-highlight`, `blur-left`, `blur-right` e `blur-up`. Ela pausa
o vídeo de teste no tempo previsto e marca `data-visual-ready=true` quando o frame
está pronto para captura.

Para agentes MCP, o projeto recomenda [Iris](https://github.com/brijr/iris)
como câmera visual. No Codex CLI:

```bash
codex mcp add iris -- iris mcp
```

Se o Chrome-family browser não for encontrado automaticamente, passe o caminho,
por exemplo `iris mcp --chrome /usr/bin/brave-browser`. Outros clientes MCP,
incluindo Claude Code, podem apontar um servidor stdio para o comando
`iris mcp`.

O fluxo esperado é **alterar → unit tests → gerar fixtures → abrir checkpoint
→ capturar com Iris → inspecionar pixels → corrigir**. Iris não substitui
FFprobe, render reports nem avaliação de áudio/movimento ao longo do tempo.
Veja [VISUAL_TESTING.md](VISUAL_TESTING.md) para instalação, casos disponíveis
e prompts recomendados para agentes.

O renderer gera `output/rough_cut.mp4` e `output/render_report.json`.
Ele executa imagens, vídeos, fundos sólidos, cortes secos, narração, texto de
impacto, `kinetic_text` palavra por palavra e captions karaoke. Um vídeo de
apresentador pode ser colocado sobre um background usando `cells` do grid 3×3,
inclusive com o layout `nox`. Os layouts `three_columns`, `character_vs` e
`left_right` atribuem regiões automaticamente a imagens e vídeos sem `cells`.
Cada elemento visual pode usar `box.padding`, `box.radius`, `box.shadow` e
`box.background`; `fit` aceita `cover`, `contain` e `stretch`. Quando a
transcrição possui word
timestamps eles são usados diretamente; caches antigos com timestamps por
segmento recebem uma distribuição determinística das palavras.

Para imagens e vídeos, `animation.enter` aceita `cut`, `fade` e `slide_up`;
`animation.idle` aceita `none`, `float_soft`, `slow_zoom_in`, `slow_zoom_out`
e `pan`; `animation.exit` aceita `cut` e `fade_out`. O movimento usa o intervalo
`start`/`end` do elemento. Presets registrados em fases incompatíveis são
rejeitados na validação.

Nas transições atuais, `transitionOut` aceita `cut`, `fade`, `slide_left`, `blur_left`, `blur_right` e `blur_up`.
As transições são descobertas em `backend/contentlab/transition_plugins/` e
aplicadas apenas entre cenas contíguas. Os demais nomes antigos ainda não têm
implementação e agora são rejeitados pela validação, em vez de virar um corte
silencioso. `audio.music` suporta `trimDb`, `fadeIn` e `fadeOut`; elementos
`sfx` usam `at` e podem limitar a duração via `config.duration`. Elementos
`overlay` aplicam chroma key verde, configurável por `config.keyColor`,
`config.similarity` e `config.blend`. Vídeos, overlays e backgrounds em vídeo
podem preservar o áudio original com `muted: false`; `muted: true` silencia.
Por compatibilidade, omitir `muted` mantém a mídia silenciosa. `preset`,
`trimDb`, `fadeIn` e `fadeOut` controlam essa faixa, e `loop: true` repete
também o áudio. O relatório lista as transições e camadas de áudio aplicadas,
além de avisos.

Na fase 8, `audio.sourceCuts` representa as regiões **mantidas** do áudio
original, em segundos, ordenadas e sem sobreposição. O renderer as une em
`narration.cleaned.wav`; se houver transcrição de origem, os timestamps das
palavras são remapeados para a nova timeline. A voz recebe high-pass opcional
e normalização de loudness configurável por `audio.voice`. Música e SFX são
normalizados antes do ganho relativo (`trimDb` ou `preset`), a música sofre
ducking pela voz (`audio.ducking`) e o mix termina com limiter. O relatório
registra cortes, parâmetros de normalização, camadas, ducking e limiter.
Veja [o exemplo de áudio](examples/audio-phase8-edit-plan.json); ele requer
`audio/narration.wav`, `audio/music.wav` e `audio/impact.wav` na mesma pasta
do projeto. Para testar via CLI, execute
`python -m backend.contentlab.cli render examples/audio-phase8-edit-plan.json`
após adicionar esses arquivos. Os alvos de loudness do exemplo são pontos de
partida configuráveis, não uma calibração específica do canal.

Na interface, a seção **Editor automático** abre uma pasta contendo
`edit_plan.json`, mostra a timeline e verifica assets antes de iniciar o
render. **Render final** respeita a resolução e o FPS do plano e salva em `output/final/final.mp4`. O render gera `render_report.json` e o MP4 pode ser reproduzido na página. Um projeto não executa dois renders simultâneos. O editor textual
permite carregar, validar e salvar `edit_plan.json`; alterações não salvas
bloqueiam o render. A página lista os assets resolvidos, plugins disponíveis,
progresso e warnings. Se o arquivo mudar fora da página, o salvamento é
recusado para evitar sobrescrever a edição externa — recarregue o projeto.

A interface está organizada em quatro abas: **Vídeos e cortes**,
**Transcrição**, **Editor automático** e **Guia do projeto**. Ao carregar outra fonte de vídeo, o rascunho de
cortes em lote, a validação e os resultados anteriores são limpos; a pasta de
destino permanece selecionada. Trocar apenas de aba não descarta o trabalho
em andamento.

Na aba **Transcrição**, clique em **Escolher pasta** para selecionar uma pasta
existente — ela pode estar vazia e não precisa ter `edit_plan.json`. Depois,
selecione o arquivo da narração no computador. Escolha a qualidade do
reconhecimento (`tiny`, `base`, `small` ou
`medium`), o idioma (português, inglês, espanhol ou detecção automática) e
como mostrar os tempos no TXT (por palavra ou por trecho). O processamento
local com faster-whisper sempre grava `transcript.json` com tempos por palavra,
além de `transcript.txt` e `transcript.srt` na pasta escolhida. A primeira
execução de cada modelo pode precisar baixá-lo e demorar; resultados devem
ser revisados, especialmente nomes próprios. Use **Abrir pasta dos arquivos**
para localizar as saídas e envie a transcrição à IA para criar o plano. Se um
projeto da mesma pasta já estiver
aberto no editor, os campos `audio.narration` e `sources.transcript` são
preenchidos no rascunho do plano; salve o JSON antes do render. Esses arquivos
podem ser fornecidos ao GPT junto com a skill `skillContentLabEdicao.zip` para
orientar a criação do `edit_plan.json`. Salve o plano gerado na mesma pasta;
então abra essa pasta no Editor automático.

A interface chama a API Flask no mesmo endereço, portanto não há etapa de
compilação para o frontend.

### Montagem visual do edit_plan.json

Na aba **Editor automático**, escolha uma pasta e crie um projeto (ou abra um
existente). O bloco **Montagem visual do plano** edita o mesmo
`edit_plan.json` que a IA pode gerar: **+ Nova cena** cria a próxima cena;
selecione-a para ajustar início, fim, fundo, layout, câmera, transição e
camadas. Em cada objeto, **+ Campo** mostra as opções disponíveis no contrato
JSON; em listas, **+ Camada** ou **+ Item** acrescenta elementos, música,
keyframes e outros itens. Os campos de asset sugerem os arquivos do projeto
e os arquivos padrão instalados. O campo `z` define a ordem visual das
camadas. Use **Validar JSON** e **Salvar plano** antes do render final.

O painel lateral carrega `transcript.json` da pasta do projeto ou permite
importá-lo. Os botões **Usar início** e **Usar fim** copiam o tempo de uma
frase para a cena selecionada. Também é possível deixar intervalos entre
cenas; o render os preenche com tela preta enquanto a narração continua.
Planos 0.1 existentes podem ser ajustados e ampliados visualmente sem mudar a
versão; projetos novos passam ao contrato 0.2 quando a primeira cena é
adicionada. A edição textual continua
disponível e os campos que já existem no JSON são preservados ao alterar
outros campos pela interface.

Na fase 10, o painel também cria a estrutura inicial de um projeto, importa a
narração, lista os assets, permite cancelar um render e oferece aceleração
NVIDIA/NVENC opcional (com fallback automático para CPU). O render final reutiliza o resultado quando plano, arquivos e código do renderer não mudaram. O relatório registra cache, encoder, tempo de render e duração dos
streams; um arquivo com duração inconsistente não é publicado como resultado.

Para executar o aceite técnico integrado de 60 segundos, com mídias sintéticas:

```bash
python -m unittest discover -s tests -q
python -m tests.mvp_acceptance
```

O roteiro completo, incluindo as verificações manuais ainda necessárias no
Windows e no CapCut, está em [MVP_ACCEPTANCE.md](MVP_ACCEPTANCE.md).
O contrato completo do JSON, as funções implementadas e os parâmetros aceitos
estão em [EDIT_PLAN_REFERENCE.md](EDIT_PLAN_REFERENCE.md).

## Filtros de camada no motion design

O `edit_plan 0.2` possui o elemento genérico `filter`. `style: "dim"`
escurece as camadas que estiverem visualmente abaixo dele; `style: "crt_tv"`
adiciona scanlines, vinheta e flicker/jitter discretos. Como toda camada, o
efeito é controlado por `z`, permitindo manter um PNG ou título acima do
filtro. PNGs estáticos também podem usar `animation.idle: "wiggle_soft"`.

Assets de textura continuam podendo ser usados como `video` com
`transform.opacity` reduzido quando o efeito desejado já existe em arquivo.

## Texto digitado e motions pelo centro

No `edit_plan 0.2`, `text` com `reveal.charactersPerSecond` revela
caracteres — inclusive a cadência dos espaços — e agora faz quebra de linha
somente entre palavras. Palavras não são partidas/hifenizadas para caber:
quando necessário, o tamanho é reduzido.

Também estão disponíveis os motions genéricos
`animation.enter: "center_reveal"` e
`animation.exit: "center_close"`, que abrem do centro para fora e fecham das
bordas para o centro. Cenas 3×3 podem combinar vários blocos de texto com
`camera.keyframes` para a câmera acompanhar uma frase por células sem cortar
palavras.
## Pilha vertical de palavras

No `edit_plan 0.2`, `kinetic_text` aceita
`style: "word_stack_vertical"`. O preset mantém a palavra ativa no centro,
a anterior abaixo e a próxima acima; as palavras inativas ficam com opacidade
reduzida e a pilha desliza suavemente a cada novo timestamp. O padrão usa
Anton em caixa alta, mas `textStyle` pode substituir fonte/cor. Ajustes de
`inactiveOpacity`, `transitionDuration` e `slotGap` ficam em `config`.
Veja `examples/word-stack-v0.2.json`.

## Caption com palavra ativa

No `edit_plan 0.2`, o estilo genérico `bangers_highlight_block` mostra um
chunk inteiro em Bangers branca e aplica um bloco colorido arredondado somente
atrás da palavra ativa, seguindo os timestamps da transcrição. O preset usa
azul/vermelho/preto por padrão e pode ser configurado no `config` do
elemento. A legenda normal existente continua disponível separadamente.

## Motion design

O JSON `0.2` aceita cenas contínuas com fundo de cor, imagem ou vídeo,
elementos em camadas, câmera virtual, keyframes e grid 3×3. Imagens podem
ultrapassar suas células: `scale: 1.2` as torna 20% maiores. Há também
entrada deslizante por preset. O [exemplo de dois personagens no mesmo
fundo](examples/motion-grid-v0.2.json) demonstra o caso; a
[sequência completa de motion design](examples/motion-storyboard-v0.2.json)
mostra fundo de vídeo em loop, texto letra a letra, câmera que acompanha a
escrita, transição com slide e blur, pop, balanço leve e SFX sincronizados. Os
arquivos citados nesse exemplo são referências a serem fornecidas, não mídia
inclusa. Anton e Bangers já vêm com o aplicativo; use `style: "anton"`
ou `style: "bangers"`. A fonte Anton não impõe cor nem maiúsculas: escolha-as
separadamente em `textStyle.color` e `textStyle.uppercase`. Em planos 0.2, `textStyle` permite cor, maiúsculas,
contorno e sombra personalizados, e `reveal.charactersPerSecond` produz a
escrita letra por letra.
A [referência completa](MOTION_DESIGN_JSON.md) explica todos os parâmetros
para pessoas e IAs. O [plano de ação](MOTION_DESIGN_PLAN.md) registra as
decisões e verificações. O JSON `0.1` continua aceito.

As cenas visuais `0.2` são desenhadas pelo Remotion em TypeScript. O Python
continua validando o mesmo `edit_plan.json`, resolvendo os assets, preparando
a narração, aplicando transições e mixando o áudio. A ponte envia ao Remotion
uma cena já validada, com tempos, posições, animações e referências locais
aos arquivos. Novos vídeos usam o mesmo motor com outro JSON. Para comparar
com o renderizador anterior, defina `CONTENTLAB_MOTION_ENGINE=python` antes
de iniciar o aplicativo. A versão `0.1` segue no fluxo FFmpeg existente.

### Assets internos e assets do vídeo

A biblioteca do aplicativo fica em `builtin-assets/backgrounds/`,
`builtin-assets/music/` e `builtin-assets/sfx/`. Os backgrounds já instalados
aparecem no seletor do editor; músicas e sons ainda dependem de arquivos
adicionados. Referencie um arquivo interno como
`builtin://backgrounds/colecao/arquivo.mp4`, `builtin://music/tema.mp3` ou
`builtin://sfx/impacto.wav`, sempre com o caminho real. Arquivos
exclusivos de um vídeo ficam na pasta `assets/` do projeto e usam
`project://assets/nome.png`. Fundos sólidos usam `background.color` e não
precisam de arquivo. Veja [o guia da biblioteca](builtin-assets/README.md).

## Dados e cache

- O primeiro processamento guarda a fonte completa no cache.
- Cortes, áudio e transcrições posteriores reutilizam essa fonte.
- Apagar um item pelo gerenciador de cache não remove arquivos já exportados.
- Os modelos do `faster-whisper` são baixados na primeira transcrição.

O servidor escuta apenas em `127.0.0.1`; ele não fica exposto à rede local.

## Skill compartilhável de edição

`skillContentLabEdicao.zip`, distribuída na raiz do projeto, é a skill que
ajuda o GPT a criar um `edit_plan.json` para o editor automático. Entregue ao
GPT o roteiro, a narração ou transcrição, a lista de assets disponíveis e as
preferências visuais; peça um plano conforme
[a referência do JSON](EDIT_PLAN_REFERENCE.md). Depois, salve o resultado como
`edit_plan.json` na pasta do projeto, valide no Content Lab e gere diretamente o render final. A skill auxilia na autoria do plano; os arquivos de
áudio, imagem e vídeo referenciados precisam existir no projeto.
O ZIP também pode ser baixado pelo botão **Baixar skill (.zip)** na aba
**Guia do projeto**; a mesma rota funciona no aplicativo empacotado para
Windows. Instale a skill no ambiente ChatGPT/Cloud compatível seguindo as
instruções do próprio pacote.
# Catálogo para IA

Na aba **Guia do projeto**, baixe o catálogo Markdown com todos os assets padrão
instalados, seus URIs exatos, o contrato JSON e o grid do motion design. Ele é
gerado a cada download a partir de `builtin-assets/`, portanto novos arquivos
em `backgrounds/`, `music/`, `sfx/` ou `transitions/` entram automaticamente.
Vídeos de fundo verde em `transitions/` são camadas `overlay` com chroma key,
não presets de `transitionOut`.
