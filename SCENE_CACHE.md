# Cache incremental por cena — Content Lab

O cache é a base para revisar uma cena por ID sem recriar todos os frames.

## Modos do Editor automático

- **Aproveitar cache** (`reuse`): verifica assinatura, tamanho e timestamp de cada MP4. Clipes válidos sobrevivem à execução anterior e são reutilizados.
- **Refazer tudo** (`rebuild`): depois de confirmação, limpa `output/` e renderiza todas as cenas novamente. A remoção é bloqueada se um asset de entrada estiver dentro dessa pasta.

## Arquivos persistidos

```text
output/final/
  final.mp4
  render_report.json
  narration.cleaned.wav
  scenes/
    manifest.json
    <id>-<hash>.mp4
  pieces/
    manifest.json
    <trecho-de-composição>.mp4
```

A assinatura visual separa propriedades renderizadas pelo Remotion de propriedades apenas sonoras (`sfx`, fades/volume de áudio e transição de montagem). O motor é identificado por hash do conteúdo visual, não por horários dos arquivos do servidor. Alterar apenas o SFX ou deslocar uma cena inteira com suas camadas deixa o clipe visual aproveitável. O arquivo de mídia em si ainda usa metadados de arquivo para evitar hashear vídeos grandes a cada verificação. A primeira renderização após esta migração pode atualizar assinaturas antigas.

O manifesto é atualizado atomicamente **depois de cada MP4 concluído**, antes da montagem final. Se a composição final falhar, os clipes já concluídos permanecem disponíveis.

A identidade de um segmento inclui JSON da cena, ID, parâmetros globais de resolução/FPS, motor, arquivos referenciados, transcrição relevante e identidade do renderer. Alterar o `scale` do Batman invalida a própria cena, não todos os outros clipes. Alterações de fundo ou fonte podem exigir novo render da cena que os utiliza. Ajustes de áudio normalmente exigem nova mixagem, mas preservam os quadros visuais.

O cache de peças contém corpos de cena e transições. Uma transição vinculada à cena alterada também pode precisar ser recalculada.

## Relatório e uso futuro

`render_report.json` lista `sceneCache.rendered`, `sceneCache.reused` e contagens. No futuro, os MP4s por ID poderão alimentar um editor visual de cenas, com comparação antes/depois e Player sincronizado ao renderizador.

Os segmentos individuais são vídeos visuais sem a mixagem final. Nunca edite os manifestos manualmente nem coloque fontes importantes em `output/`.
