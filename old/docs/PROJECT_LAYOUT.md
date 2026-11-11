# Estrutura canônica de projeto — Content Lab

O projeto universal é uma pasta única. Conteúdo editorial e entregáveis ficam visíveis; metadados transitórios e caches pertencem a `.contentlab/`. Não crie pastas opcionais vazias por simples inspeção.

```text
PROJETO/
├── edit_plan.json                # plano de edição, quando usado
├── transcript.json               # transcrição oficial
├── transcript.txt / .srt         # exportações, se geradas
├── audio/                        # narração e tomadas
├── assets/                       # mídia importada
├── transcripts/                  # transcrições avulsas das fontes
├── custom-scenes/                # cenas TSX locais, quando necessárias
├── thumbnails/
│   └── project.json              # rascunho editável, quando salvo
├── output/
│   ├── final.mp4                 # vídeo renderizado
│   ├── TH_A.jpg                  # primeira thumbnail final (exemplo)
│   ├── TH_B.jpg                  # segunda thumbnail final (exemplo)
│   └── ...                       # PNG/WebP também permitidos
└── .contentlab/
    ├── build/
    │   ├── narration.build.json
    │   └── transcript.build.json
    └── render/
        ├── scenes/
        ├── pieces/
        ├── logs/
        └── render_report.json
```

## Thumbnails finais

- **Exportar imagem selecionada:** salvar em `output/TH_A.jpg`, depois `output/TH_B.jpg`, `TH_C.jpg` etc., respeitando o formato selecionado (JPG, PNG ou WebP). Depois de `TH_Z`, seguir `TH_AA`.
- **Destino na interface:** escolher *Nova thumbnail* (padrão, sem sobrescrita) ou *Substituir TH_X.ext* (somente uma imagem existente do mesmo formato).
- **Substituição:** exige seleção explícita e revisão do arquivo desde a listagem; arquivos diferentes nunca devem ser alterados.
- **Exportar todas:** salvar cada variante como um novo `TH_` em `output/`, mantendo também o ZIP portátil com imagens e `projeto-thumbnail.json`.
- **Rascunho editável:** continua em `thumbnails/project.json`. Não confundir com imagem final.
- **Legado:** imagens antigas em `thumbnails/` não são apagadas nem movidas automaticamente. Apenas imagens finais com nomes `TH_*.jpg/png/webp` presentes em `output/` aparecem na seleção de substituição.

## Arquivos internos

- `.contentlab/build/` contém metadados de preparação de narração e transcrição. São dados técnicos, não devem ser enviados como entregáveis editoriais.
- Leitores de metadados procuram primeiro `.contentlab/build/` e, para compatibilidade, aceitam `narration.build.json` e `transcript.build.json` antigos na raiz.
- Uma nova gravação de metadados vai para o caminho canônico e retira a cópia antiga após sucesso. A transcrição oficial `transcript.json` permanece visível.
- O cache do render continua sob `.contentlab/render/`; a saída final de vídeo continua sendo `output/final.mp4`, sem criar `output/final/`.
- Projetos antigos com `output/final/final.mp4` continuam sujeitos ao fluxo de compatibilidade já implementado.
