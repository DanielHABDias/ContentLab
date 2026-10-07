# Fase 10 — aceite do MVP

Este checklist separa a implementação da comprovação em ambiente real. O teste
integrado usa mídias **sintéticas** e não substitui a inspeção com a voz, o
apresentador e os assets finais do canal Dias Verso.

## Resultado técnico no Linux

Execute na raiz do repositório, com FFmpeg e FFprobe disponíveis:

```bash
python -m unittest discover -s tests -q
python -m tests.mvp_acceptance
```

O segundo comando gera um projeto temporário de 60 segundos, faz preview,
render final e rough cut, verifica H.264/AAC, duração dos streams de vídeo e
áudio, quadros-chave das cenas e reutilização do cache. O arquivo
`output/rough_cut.mp4` e os relatórios ficam no diretório temporário impresso
ao fim do teste. `render_report.json` registra `cacheHit`, `videoEncoder`,
`renderRealtimeFactor`, `outputProbe` e `outputBytes`.

## Critérios de aceite do roadmap

| Critério | Estado e evidência |
| --- | --- |
| Abrir a interface no Windows | **Pendente de execução no Windows.** `iniciar.bat` e `build.bat` foram revisados, mas não executados neste Linux. |
| Criar e abrir um projeto | **Verificado por teste de API e interface Linux.** O painel cria `edit_plan.json`, `audio/` e `assets/`; a UI abriu o projeto sintético. |
| Selecionar narração | **Verificado por teste de API.** O arquivo selecionado é copiado para `audio/`; seleção pelo diálogo nativo exige verificação manual. |
| Apontar para pasta de assets | **Verificado na UI Linux.** A listagem do projeto sintético identificou sete arquivos. |
| Carregar `edit_plan.json` | **Verificado na UI Linux.** Quatro cenas foram exibidas. |
| Validar o plano | **Verificado na UI Linux e em testes.** Todos os assets sintéticos foram resolvidos. |
| Gerar e reproduzir preview | **Render e arquivo verificados por teste integrado; reprodução visual no navegador deve ser conferida manualmente.** |
| Preview com 2+ clipes, texto de impacto, frase cinética, Nox com karaoke, grid 3×3 com 3 imagens, card com padding/radius/shadow, overlay/chroma, música e SFX | **Verificado com fixture sintética e quadros-chave.** São dois clipes base, um apresentador substituto, três imagens, CTA com chroma, narração, música e SFX. A identidade visual e o apresentador reais ainda precisam de inspeção. |
| Render final | **Verificado por teste integrado.** Vídeo e áudio têm 60 segundos; H.264/AAC. |
| `rough_cut.mp4` e relatório | **Verificado por teste integrado.** Ambos são produzidos. |
| Abrir o MP4 no CapCut | **Pendente de execução no CapCut.** O arquivo é H.264/AAC, mas compatibilidade de importação não foi atestada nesta máquina. |

## Fechamento manual no Windows

1. Em uma máquina Windows com FFmpeg disponível, execute `iniciar.bat`; se
   precisar do executável, execute `build.bat` e abra `dist\ContentLab.exe`.
2. Crie um projeto pela interface. Selecione uma narração real, a pasta de
   assets, carregue/salve um `edit_plan.json` representativo e valide o plano.
3. Gere e reproduza o preview, conferindo cada item visual e audível da tabela
   com os assets reais do canal. Gere o render final e confirme áudio, vídeo,
   duração e relatório.
4. Abra `output\rough_cut.mp4` (ou `output\final\final.mp4`) no CapCut e
   confira reprodução e sincronia. Registre eventuais divergências antes de
   considerar o MVP integralmente aceito.

NVENC é opcional: se não houver encoder NVIDIA funcional, o render usa
`libx264` e registra um aviso. O cache só vale quando plano, arquivos,
renderer e saída persistida continuam compatíveis.
