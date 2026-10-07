# Biblioteca interna de mídia

Coloque aqui somente arquivos autorizados para distribuição com o Content Lab.
O motor aceita `builtin://backgrounds/arquivo.png`,
`builtin://music/faixa.mp3` e `builtin://sfx/efeito.wav` no JSON. Os nomes são
os nomes reais dos arquivos, inclusive maiúsculas e extensão. Não há mídia
copiada do Drive nesta etapa.

- `backgrounds/`: imagens estáticas e, para cenas `0.1`, vídeos de fundo.
- `music/`: faixas usadas por `audio.music[].asset`.
- `sfx/`: efeitos usados por elementos `sfx`.

Fundos de cor sólida não precisam de arquivo: use `background.color`, por
exemplo `"#16233F"`. Texturas de papel ou outros fundos fornecidos pela pessoa
podem ficar em `assets/` do projeto e ser referenciados via `project://`.

Antes de incluir músicas, efeitos ou imagens no aplicativo público, registre
origem e licença, e confirme que a redistribuição é permitida.
