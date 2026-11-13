# Mídia, cache e transcrição

Arquivos importados recebem SHA-256 e são armazenados uma vez em cache endereçado por conteúdo. A fonte original nunca é movida ou alterada. Cortes usam a combinação hash + intervalo como identidade, permitindo gerar vários trechos sem novo download ou trabalho repetido.

URLs exigem HTTPS e `yt-dlp`; playlists e downloads acima de 4 GiB são bloqueados por padrão. O usuário continua responsável por acesso e direitos. FFprobe valida a mídia e FFmpeg gera cortes reproduzíveis. A limpeza remove derivados por padrão e só apaga objetos importados quando isso é pedido explicitamente.

## Transcrição escolhida

O perfil de transcrição é Whisper `large-v3` completo, executado localmente por `whisper.cpp`, em português. Ele prioriza qualidade; não há troca automática para versões menores ou turbo. A tela Dependências verifica o motor e os pesos e oferece instalação com origem, tamanho, licença e consentimento.

O resultado inclui JSON com alinhamento e SRT. Qualidade e tempo devem ser medidos com amostra PT-BR licenciada no hardware final antes de declarar o modelo pronto para produção.

## Fluxo na interface

- **Importar arquivos** (seleção múltipla) e **arrastar e soltar** (envio com progresso) criam jobs com progresso e cancelamento. Conteúdo repetido (mesmo SHA-256) não é duplicado; arquivos inválidos são relatados sem interromper os demais.
- Cada mídia guarda nome, origem (arquivo, upload ou URL), metadados do FFprobe (duração, resolução, codecs, taxa), direitos, cortes e estado da transcrição.
- **URL**: só HTTPS de um único vídeo, com direitos `own/licensed/authorized` confirmados; playlists e endereços locais/rede interna são recusados; usa o `yt-dlp` de `.tools`.
- **Preview** real (vídeo/áudio/imagem) via `/api/v1/media/file` com suporte a Range, restrito às mídias do projeto e a extensões de mídia.
- **Remover** mostra os usos (thumbnail e clips) e só desassocia com confirmação; o original nunca é apagado.
- **Cortes** não destrutivos (hash + intervalo) ficam no cache e são validados contra a duração.
- **Transcrição** em fila (WAV 16 kHz → `whisper-cli -l pt -pp -ml 1 -sow -ojf -osrt`), com progresso e cancelamento; idempotente por SHA-256 + modelo + idioma. Saída bruta em `transcripts/<mídia>/raw.*`; correções em `revised.json` com revisão otimista, sem sobrescrever a saída bruta; SRT exportável; busca por texto (sem acento) ou timecode (`1:23`).

## Narração e edição

Montar a narração não inicia a transcrição: assim a pessoa pode tratar o áudio fora (por exemplo, num site) antes. Com a narração montada, o botão **Gerar transcrição palavra por palavra** fica liberado (ou `narration_transcribe` pelo MCP), para takes gravados e voz clonada. O job só conclui quando o áudio montado tem palavras com tempos reais de início/fim; uma saída só com frases não conclui. A Narração pode ser aprovada com o áudio montado; a edição automática e a conclusão da edição exigem a transcrição pronta. Áudio sem fala deve usar o modo sem narração.

A transcrição pertence ao arquivo final montado (hash, modelo e idioma). Remontar os takes muda a entrada e exige conferir a transcrição desse áudio; o cache não deve reutilizar tempos de outra mídia. Falhas preservam o áudio e permitem retomar com `narration_transcribe`. O MCP lê as palavras com `narration_transcript` (`offset`, `limit`), para posicionar mídia, cortes e legendas na fala real.

## Biblioteca visual

As mídias locais aparecem em uma grade adaptável de cartões, com miniaturas de imagens e vídeos, tipo, duração, tamanho e disponibilidade. Clique em um cartão para abrir a prévia ampliada, ouvir áudio no player de ondas, criar cortes ou revisar a transcrição. Feche a prévia para voltar à mesma grade; remover um arquivo é uma ação separada no cartão. Miniaturas e ondas são carregadas conforme aparecem na tela.
