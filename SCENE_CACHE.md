# Cache incremental por cena — Content Lab

O Editor automático oferece dois modos de renderização. Não é um novo Preview: os dois geram vídeo final.

## Modos

- **Aproveitar cache** (`cacheMode: "reuse"`): compara cada cena com os dados anteriores, reaproveita clipes válidos e renderiza somente as cenas modificadas.
- **Refazer tudo** (`cacheMode: "rebuild"`): após confirmação, apaga integralmente a pasta `output` do projeto e renderiza tudo novamente.
- Se o vídeo final continua válido e o cache de cenas está completo, o modo reuse devolve o MP4 existente sem novo processamento.
- Antes de apagar, a aplicação verifica o plano e impede a limpeza quando há assets, narração ou transcrição utilizados dentro de `output`.

## Estrutura em disco

```text
projeto/
  edit_plan.json
  assets/
  audio/
  output/
    final/
      final.mp4
      narration.cleaned.wav
      render_report.json
      scenes/
        manifest.json
        <id-seguro>-<hash>.mp4
      pieces/
        manifest.json
        <trecho-intermediario>.mp4
```

Cada ID de cena é estável e se torna uma entrada do manifesto `scenes/manifest.json`. O nome do arquivo é derivado do ID por um slug seguro e um hash. Mudanças de posição na lista não exigem renomear clipes.

Os arquivos em `scenes/` representam apenas as imagens das cenas, sem a mixagem final de voz e trilhas. Transições e áudio são aplicados na composição do `final.mp4`.

## Como o cache decide

A assinatura SHA-256 de cada cena considera:

1. JSON inteiro daquela cena: tempos, fundo, elementos, células, escala, keyframes, efeitos, animações.
2. Resolução, FPS e seed do projeto.
3. Motor (Remotion, Python ou FFmpeg), encoder e opção de GPU.
4. Arquivos e fontes usados pela cena: caminho, tamanho e data de modificação de alta resolução.
5. Palavras de transcrição aplicáveis à cena, quando há legenda ou texto cinético.
6. Arquivos de código dos renderizadores e fontes empacotadas.

O MP4 também é verificado pelo tamanho e data de modificação. Se desapareceu, ficou vazio ou não corresponde aos metadados, a cena será renderizada de novo. Após cada cena, o manifesto é gravado atomicamente, para que trabalhos interrompidos possam continuar aproveitando clipes completos.

Se uma ferramenta modificar uma mídia e preservar exatamente tamanho e timestamp, o sistema poderá não perceber a alteração: nesse caso utilize **Refazer tudo**.

## Transições e composição

O cache `pieces/` armazena corpos de cena e transições calculadas pelo FFmpeg. Suas assinaturas incluem a identidade dos MP4s de origem, a duração, os parâmetros de codificação e o código do compositor. Alterar uma cena invalida o seu clipe e as peças que dependem dele; outras peças permanecem reutilizáveis.

A concatenação final e a mixagem do áudio ainda podem ser executadas para produzir o novo `final.mp4`. Alterações apenas na narração ou música invalidam o vídeo final, mas não exigem renderizar novamente as imagens das cenas.

## API e relatório

`POST /api/editor/render` recebe:

```json
{"projectRoot": "/caminho/projeto", "mode": "final", "cacheMode": "reuse", "hardwareAccel": false}
```

Para limpar use `"cacheMode": "rebuild"`. O relatório contém `sceneCache.rendered`, `sceneCache.reused`, `sceneCache.renderedCount` e `sceneCache.reusedCount`. O editor mostra as contagens.

## Segurança e futuras ferramentas

- Nunca armazene insumos ou documentos valiosos em `output/`, pois Refazer tudo apaga essa pasta.
- Execute no máximo uma renderização por projeto de cada vez.
- O cache é reconstruível: não altere os arquivos de manifesto manualmente.
- Um editor visual futuro poderá reproduzir individualmente o MP4 de cada cena pelo ID e compará-lo à versão que está sendo ajustada, sem um Preview completo duplicado.

