# PyClips
Ferramenta em python para criação de clips a partir de video de uma série, filme ou video longo.

# Configuração do FFmpeg

## Instalando o FFmpeg no Windows (guia rápido para README)

O FFmpeg é necessário para processamento de áudio e vídeo (MoviePy,
Whisper, etc.).

------------------------------------------------------------------------

### 1) Baixar o FFmpeg

Acesse:

https://www.gyan.dev/ffmpeg/builds/

Baixe o pacote:

    ffmpeg-release-essentials.zip

------------------------------------------------------------------------

### 2) Extrair os arquivos

Extraia o conteúdo para uma pasta, por exemplo:

    C:\ffmpeg

Você deve ter:

    C:\ffmpeg\bin\ffmpeg.exe

------------------------------------------------------------------------

### 3) Adicionar ao PATH do Windows

1.  Abra **Configurações avançadas do sistema**
2.  Clique em **Variáveis de Ambiente**
3.  Em **Path**, clique em **Editar**
4.  Clique em **Novo**
5.  Adicione:

```{=html}
<!-- -->
```
    C:\ffmpeg\bin

6.  Confirme tudo.

------------------------------------------------------------------------

### 4) Reiniciar o terminal/IDE

Feche e abra novamente o terminal ou VS Code.

------------------------------------------------------------------------

### 5) Testar instalação

No terminal, execute:

``` bash
ffmpeg -version
```

Se aparecer a versão do FFmpeg, está funcionando.

------------------------------------------------------------------------

### Alternativa (sem mexer no PATH)

No Python, pode-se adicionar temporariamente:

``` python
import os
os.environ["PATH"] += os.pathsep + r"C:\ffmpeg\bin"
```

------------------------------------------------------------------------

### Problemas comuns

-   FFmpeg não adicionado ao PATH.
-   Terminal não reiniciado após alteração.
-   Caminho incorreto da pasta `bin`.

------------------------------------------------------------------------

# Como Rodar

1) Habilitar a venv e instalar libs:
    - Habilitar Scripts: Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
    - Ativar venv: venv\Scripts\activate
    - Instalar Libs: pip install -r requirements.txt

2) Configurar o config.py.

3) Baixar video .mp4 e adicionar ao diretório.

4) Rodar o arquivo principal: python main.py