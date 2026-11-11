# Mídia, cache e transcrição

Arquivos importados recebem SHA-256 e são armazenados uma vez em cache endereçado por conteúdo. A fonte original nunca é movida ou alterada. Cortes usam a combinação hash + intervalo como identidade, permitindo gerar vários trechos sem novo download ou trabalho repetido.

URLs exigem HTTPS e `yt-dlp`; playlists e downloads acima de 4 GiB são bloqueados por padrão. O usuário continua responsável por acesso e direitos. FFprobe valida a mídia e FFmpeg gera cortes reproduzíveis. A limpeza remove derivados por padrão e só apaga objetos importados quando isso é pedido explicitamente.

## Transcrição escolhida

O único perfil suportado é Whisper `large-v3`, executado localmente por `whisper.cpp`, idioma fixado em português. A escolha prioriza precisão e timestamps; nesta máquina de validação há 15 GiB de RAM e 12 CPUs, mas binário/pesos ainda não estão instalados. O Content Lab diagnostica essa ausência e não baixa silenciosamente um modelo grande nem substitui por versão inferior. O assistente de dependências (F14) prepara `whisper-cli` (whisper.cpp v1.9.5, commit `d1be6fde11ac`) e `ggml-large-v3.bin` (3 095 033 483 bytes, SHA-256 `64d182b4…94d1e2`) em `.tools/`, com consentimento, retomada e verificação.

O resultado inclui JSON com alinhamento e SRT. Qualidade e tempo devem ser medidos com amostra PT-BR licenciada no hardware final antes de declarar o modelo pronto para produção.

## Fluxo na interface (F16)

- **Importar arquivos** (seleção múltipla) e **arrastar e soltar** (envio com progresso) criam jobs com progresso e cancelamento. Conteúdo repetido (mesmo SHA-256) não é duplicado; arquivos inválidos são relatados sem interromper os demais.
- Cada mídia guarda nome, origem (arquivo, upload ou URL), metadados do FFprobe (duração, resolução, codecs, taxa), direitos, cortes e estado da transcrição.
- **URL**: só HTTPS de um único vídeo, com direitos `own/licensed/authorized` confirmados; playlists e endereços locais/rede interna são recusados; usa o `yt-dlp` de `.tools`.
- **Preview** real (vídeo/áudio/imagem) via `/api/v1/media/file` com suporte a Range, restrito às mídias do projeto e a extensões de mídia.
- **Remover** mostra os usos (thumbnail e clips) e só desassocia com confirmação; o original nunca é apagado.
- **Cortes** não destrutivos (hash + intervalo) ficam no cache e são validados contra a duração.
- **Transcrição** em fila (WAV 16 kHz → `whisper-cli -l pt -pp -ojf -osrt`), com progresso e cancelamento; idempotente por SHA-256 + modelo + idioma. Saída bruta em `transcripts/<mídia>/raw.*`; correções em `revised.json` com revisão otimista, sem sobrescrever a saída bruta; SRT exportável; busca por texto (sem acento) ou timecode (`1:23`).
- Pendência: whisper.cpp + `large-v3` reais não foram executados nesta máquina (testes usam binário simulado com o mesmo formato de saída).
