# Content Lab

Aplicação local para baixar vídeos ou áudios do YouTube, criar cortes e gerar
transcrições. Os vídeos completos ficam em cache para serem reutilizados em
novos cortes.

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
```

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
```

O primeiro comando também verifica a existência da narração e dos assets. Um
plano estruturalmente correto pode retornar código 2 enquanto os arquivos do
projeto exemplo ainda não tiverem sido adicionados.

O renderer inicial gera `output/rough_cut.mp4` e `output/render_report.json`.
Ele executa imagens, vídeos, fundos sólidos, cortes secos, narração, texto de
impacto, `kinetic_text` palavra por palavra e captions karaoke. Um vídeo de
apresentador pode ser colocado sobre um background usando `cells` do grid 3×3,
inclusive com o layout `nox`. Quando a transcrição possui word
timestamps eles são usados diretamente; caches antigos com timestamps por
segmento recebem uma distribuição determinística das palavras.

Grid com múltiplos elementos, transições diferentes de `cut`, `sourceCuts`,
música e SFX aparecem como warnings no relatório até suas fases de render
correspondentes serem implementadas.

A interface chama a API Flask no mesmo endereço, portanto não há etapa de
compilação para o frontend.

## Dados e cache

- O primeiro processamento guarda a fonte completa no cache.
- Cortes, áudio e transcrições posteriores reutilizam essa fonte.
- Apagar um item pelo gerenciador de cache não remove arquivos já exportados.
- Os modelos do `faster-whisper` são baixados na primeira transcrição.

O servidor escuta apenas em `127.0.0.1`; ele não fica exposto à rede local.
