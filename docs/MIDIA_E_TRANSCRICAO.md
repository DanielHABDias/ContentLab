# Mídia, cache e transcrição

Arquivos importados recebem SHA-256 e são armazenados uma vez em cache endereçado por conteúdo. A fonte original nunca é movida ou alterada. Cortes usam a combinação hash + intervalo como identidade, permitindo gerar vários trechos sem novo download ou trabalho repetido.

URLs exigem HTTPS e `yt-dlp`; playlists e downloads acima de 4 GiB são bloqueados por padrão. O usuário continua responsável por acesso e direitos. FFprobe valida a mídia e FFmpeg gera cortes reproduzíveis. A limpeza remove derivados por padrão e só apaga objetos importados quando isso é pedido explicitamente.

## Transcrição escolhida

O único perfil suportado é Whisper `large-v3`, executado localmente por `whisper.cpp`, idioma fixado em português. A escolha prioriza precisão e timestamps; nesta máquina de validação há 15 GiB de RAM e 12 CPUs, mas binário/pesos ainda não estão instalados. O Content Lab diagnostica essa ausência e não baixa silenciosamente um modelo grande nem substitui por versão inferior. T12 fornecerá preparação verificável e retomável.

O resultado inclui JSON com alinhamento e SRT. Qualidade e tempo devem ser medidos com amostra PT-BR licenciada no hardware final antes de declarar o modelo pronto para produção.
