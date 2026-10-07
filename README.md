# Content Lab

Aplicação local para baixar vídeos ou áudios do YouTube, criar cortes, gerar
transcrições e produzir uma edição automática a partir de `edit_plan.json`,
narração e assets. Os vídeos completos ficam em cache para serem reutilizados
em novos cortes. O editor gera preview, render final e rough cut, mantendo
relatórios de validação e renderização.

## Estrutura

```text
backend/                 servidor Flask e processamento de mídia
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
skillContentLabEdicao.zip  skill para o GPT criar planos de edição JSON
EDIT_PLAN_REFERENCE.md  funções e parâmetros do editor automático
```

## Como organizar um projeto de edição

Crie **uma pasta por vídeo**. A opção **Editor automático → Criar** prepara
`edit_plan.json`, `audio/` e `assets/`; você acrescenta as mídias. A aba
**Guia do projeto** mostra esta estrutura dentro do aplicativo:

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

Requisitos: Python 3.9 ou superior, suporte a `venv`, FFmpeg e FFprobe.

No Ubuntu/Debian:

```bash
sudo apt install python3 python3-venv ffmpeg
./run.sh
```

No Fedora, instale `python3` e `ffmpeg` com `dnf`. No Arch Linux, use os
pacotes `python` e `ffmpeg`. O script cria `.venv`, instala as dependências,
abre o navegador quando há uma sessão gráfica e inicia o servidor em
<http://127.0.0.1:5000>.

Se o seletor gráfico de pastas não estiver disponível, digite diretamente no
campo da interface um caminho absoluto, como `/home/usuario/Vídeos`.

No Linux, o cache fica em `${XDG_CACHE_HOME:-~/.cache}/contentlab/cache/videos`.

## Windows

Execute `iniciar.bat`. Na primeira execução, o script cria `.venv` e instala
as dependências. O aplicativo abre no navegador e permanece disponível no
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

Na fase 6, `transitionOut` aceita `cut`, `fade` e `blur_left` (blur horizontal).
As transições são descobertas em `backend/contentlab/transition_plugins/` e
aplicadas apenas entre cenas contíguas. Os demais nomes antigos ainda não têm
implementação e agora são rejeitados pela validação, em vez de virar um corte
silencioso. `audio.music` suporta `trimDb`, `fadeIn` e `fadeOut`; elementos
`sfx` usam `at` e podem limitar a duração via `config.duration`. Elementos
`overlay` aplicam chroma key verde, configurável por `config.keyColor`,
`config.similarity` e `config.blend`. O relatório lista as transições e
camadas de áudio aplicadas, além de avisos.

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
render. **Gerar preview** usa no máximo 960 px no maior lado e 15 FPS,
salvando em `output/preview/preview.mp4`. **Render final** respeita a
resolução e o FPS do plano e salva em `output/final/final.mp4`. Cada modo
possui seu próprio `render_report.json`; a prévia pode ser reproduzida na
página. Um projeto não executa dois renders simultâneos. O editor textual
permite carregar, validar e salvar `edit_plan.json`; alterações não salvas
bloqueiam o render. A página lista os assets resolvidos, plugins disponíveis,
progresso e warnings. Se o arquivo mudar fora da página, o salvamento é
recusado para evitar sobrescrever a edição externa — recarregue o projeto.

A interface está organizada em três abas: **Vídeos e cortes**, **Transcrição**
e **Editor automático**. Ao carregar outra fonte de vídeo, o rascunho de
cortes em lote, a validação e os resultados anteriores são limpos; a pasta de
destino permanece selecionada. Trocar apenas de aba não descarta o trabalho
em andamento.

Na aba **Transcrição**, selecione a pasta de um projeto já criado e carregue a
narração. Escolha a qualidade do reconhecimento (`tiny`, `base`, `small` ou
`medium`), o idioma (português, inglês, espanhol ou detecção automática) e
como mostrar os tempos no TXT (por palavra ou por trecho). O processamento
local com faster-whisper sempre grava `transcript.json` com tempos por palavra,
além de `transcript.txt` e `transcript.srt` na raiz do projeto. A primeira
execução de cada modelo pode precisar baixá-lo e demorar; resultados devem
ser revisados, especialmente nomes próprios. Se o mesmo projeto estiver
aberto no editor, os campos `audio.narration` e `sources.transcript` são
preenchidos no rascunho do plano; salve o JSON antes do render. Esses arquivos
podem ser fornecidos ao GPT junto com a skill `skillContentLabEdicao.zip` para
orientar a criação do `edit_plan.json`.

A interface chama a API Flask no mesmo endereço, portanto não há etapa de
compilação para o frontend.

Na fase 10, o painel também cria a estrutura inicial de um projeto, importa a
narração, lista os assets, permite cancelar um render e oferece aceleração
NVIDIA/NVENC opcional (com fallback automático para CPU). Preview e render
final reutilizam o resultado quando plano, arquivos e código do renderer não
mudaram. O relatório registra cache, encoder, tempo de render e duração dos
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
`edit_plan.json` na pasta do projeto, valide no Content Lab e gere o preview
antes do render final. A skill auxilia na autoria do plano; os arquivos de
áudio, imagem e vídeo referenciados precisam existir no projeto.
O ZIP também pode ser baixado pelo botão **Baixar skill (.zip)** na aba
**Guia do projeto**; a mesma rota funciona no aplicativo empacotado para
Windows. Instale a skill no ambiente ChatGPT/Cloud compatível seguindo as
instruções do próprio pacote.
