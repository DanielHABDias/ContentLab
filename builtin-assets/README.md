# Biblioteca interna de mídia

Coloque aqui somente arquivos autorizados para distribuição com o Content Lab.
O motor aceita `builtin://backgrounds/arquivo.png`,
`builtin://music/faixa.mp3` e `builtin://sfx/efeito.wav` no JSON. Os nomes são
os nomes reais dos arquivos, inclusive maiúsculas e extensão. Subpastas em
`backgrounds/` também fazem parte do URI: um arquivo
`backgrounds/colecao/fundo.png` usa
`builtin://backgrounds/colecao/fundo.png`.

- `backgrounds/`: imagens estáticas e vídeos de fundo; a biblioteca pode ter
  coleções em subpastas. O editor lista automaticamente os arquivos instalados.
- `music/`: faixas usadas por `audio.music[].asset`.
- `sfx/`: efeitos usados por elementos `sfx`.
- `transitions/`: vídeos de transição com fundo verde; use como elemento
  `overlay` no JSON com `style: "green_screen"` e `config.keyColor`,
  `config.similarity` e `config.blend`. Não são presets de `transitionOut`.

Na aba **Guia do projeto**, o botão **Baixar catálogo para IA** gera um Markdown
com a lista atual dos arquivos instalados e as referências do JSON. O catálogo
é reconstruído a cada download: adições feitas amanhã aparecem sem editar código.

Fundos de cor sólida não precisam de arquivo: use `background.color`, por
exemplo `"#16233F"`. Texturas de papel ou outros fundos fornecidos pela pessoa
podem ficar em `assets/` do projeto e ser referenciados via `project://`.

Antes de incluir músicas, efeitos ou imagens no aplicativo público, registre
origem e licença, e confirme que a redistribuição é permitida.
