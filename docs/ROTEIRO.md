# Roteiro em capítulos e blocos

O editor permite adicionar, renomear, remover e reordenar capítulos. Em cada capítulo, adicione blocos de **Narração**, **Cena / som original** e **Direção visual**, repetindo e alternando conforme a história. Use as setas para reordenar, o seletor para mover um bloco a outro capítulo e **Desfazer** para recuperar uma alteração. Fontes ficam ao final, fora da fala. Projetos antigos são exibidos sem perda de texto e passam a capítulos ao editar os blocos.

Um bloco de narração pode ter vários períodos e parágrafos naturais. Só seu texto é enviado à voz, como um take; título do vídeo, títulos de capítulos/blocos, descrições de cenas, direção e fontes nunca são falados. Na tela de gravação, essas falas ficam agrupadas por capítulo, com títulos apenas de orientação. Depois da montagem, gere a transcrição por palavra com Whisper `large-v3` (`narration_transcribe`) e consulte `narration_transcript` antes de editar. Renomear ou mover mantém o ID e o áudio em cache; mudar a fala exige nova geração. Remover todos os capítulos deixa o roteiro vazio, sem recuperar a fala antiga.

Cena é uma descrição editorial, não uma mídia pronta: informe a função narrativa, duração estimada, obra/trecho e o som pretendido. O bloco não baixa nem insere vídeo ou áudio, nem interrompe sozinho a narração no modo composição. A seleção, direitos e montagem precisam ser conferidos na edição.

## Contrato

`creative.script.chapters` é um array ordenado; `null` indica projeto antigo com `hook`, `development`, `payoff` e `visual`. Quando `chapters` é um array, ele é a fonte do roteiro, inclusive se vazio. Cada capítulo tem `{ id, title, blocks }`; cada bloco tem `{ id, type, title, text }`. `type` é `narration`, `scene` ou `direction`. IDs são únicos no roteiro e permanecem estáveis. `creative.script.sources` guarda as fontes. O núcleo valida o mesmo contrato na interface, CLI e MCP; o pacote e `output/entrega/roteiro.md` preservam a estrutura e as instruções.

## MCP

Para criar a primeira versão, use `creative_write`:

```json
{
  "path": "/pasta/do/projeto",
  "script": {
    "chapters": [{
      "id": "origem",
      "title": "Origem — antes da transformação",
      "blocks": [
        { "id": "fala_origem", "type": "narration", "title": "", "text": "O alienígena não criou a crueldade dele." },
        { "id": "cena_origem", "type": "scene", "title": "Transformação", "text": "4–6 segundos da transformação, com áudio original e sem narrador. Selecionar e conferir a mídia na edição." },
        { "id": "direcao_origem", "type": "direction", "title": "", "text": "Se não houver trecho autorizado, mover a câmera sobre a capa e usar desenho sonoro." },
        { "id": "fala_consequencia", "type": "narration", "title": "", "text": "Ele já havia escolhido esse caminho." }
      ]
    }],
    "sources": "Obras e fontes verificadas do roteiro."
  }
}
```

Para alterar, leia `script_get({ path })` e use a revisão retornada em `script_edit`:

```json
{
  "path": "/pasta/do/projeto",
  "baseRevision": 7,
  "operations": [
    { "op": "block.update", "blockId": "fala_origem", "changes": { "text": "A crueldade dele existia antes do simbionte." } },
    { "op": "block.add", "chapterId": "origem", "beforeId": "fala_consequencia", "block": { "id": "cena_reacao", "type": "scene", "title": "Reação", "text": "Trecho curto da reação, sem narrador." } }
  ]
}
```

Operações disponíveis:

- `chapter.add`: `chapter`, `beforeId` opcional.
- `chapter.update`: `chapterId`, `title`.
- `chapter.remove`: `chapterId` (remove também seus blocos).
- `chapter.move`: `chapterId`, `beforeId` opcional.
- `block.add`: `chapterId`, `block`, `beforeId` opcional.
- `block.update`: `blockId`, `changes` com `type`, `title` e/ou `text`.
- `block.remove`: `blockId`.
- `block.move`: `blockId`, `chapterId` de destino, `beforeId` opcional.

Sem `beforeId`, o item vai ao fim. O lote é atômico; `dryRun: true` valida e devolve a prévia sem gravar. Em `REVISION_CONFLICT`, releia e recalcule. A resposta de escrita devolve revisão e IDs, sem repetir toda a fala. A leitura e edição usam o núcleo de projetos, sem editar manifestos diretamente.
