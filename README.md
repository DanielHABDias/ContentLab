# Content Lab — Node.js + Remotion

Editor automático e utilitários de vídeo para o Diazverso, com servidor Node.js, interface JavaScript, Remotion e FFmpeg. A migração do backend foi executada e os testes automatizados de Linux e Windows estão disponíveis no GitHub Actions. A validação estética com todos os assets reais do VD_0005 ainda precisa ser realizada.

## Tecnologias

- **Node.js 22+**: servidor HTTP, validação, projetos, cache, cortes, áudio e automações.
- **JavaScript e React/TypeScript**: interface web atual e composições Remotion.
- **Remotion**: renderizador visual das cenas, com keyframes, textos, PNGs, vídeo e câmera.
- **FFmpeg/FFprobe**: cortes, concatenação, transições, normalização, mixagem e verificação do MP4.
- **YouTube.js (`youtubei.js`)**: cliente JavaScript para fontes do YouTube.
- **whisper.cpp**: ferramenta local de transcrição executada diretamente pelo servidor Node.

Remotion concentra a renderização visual; o FFmpeg continua responsável por áudio, cortes e composição final. O código de servidor utiliza exclusivamente Node.js.

## Instalação

1. Instale Node.js 22+, npm, FFmpeg e FFprobe no PATH.
2. Execute `npm install` e `npm ci --prefix backend/remotion`.
3. Execute `npm start` para desenvolvimento (primeiro plano), `./run.sh` ou o atalho no Linux e `iniciar.vbs` no Windows para abrir sem deixar terminal rodando.
4. Abra `http://127.0.0.1:5000`.

No Zorin/Ubuntu, use `sudo apt install ffmpeg` para as ferramentas de mídia. O browser Chrome/Chromium pode precisar ser instalado/baixado pelo Remotion.

**Abertura sem terminal:** no Zorin rode `bash instalar-atalho.sh` uma vez e depois abra **Content Lab** pelo menu de aplicativos. No Windows execute `iniciar.vbs` por duplo clique. O servidor inicia em segundo plano e abre o navegador; o botão **Encerrar** finaliza o serviço. Para encerrar manualmente, use `node server/launcher.mjs --stop`.

### Migração de planos anteriores

Existe **um único** schema: [`schemas/edit_plan.schema.json`](schemas/edit_plan.schema.json). O JSON não possui `version` no topo.

Para converter um `edit_plan.json` existente, preservando cópia de segurança:

```bash
npm run migrate:plan -- "/caminho/para/VD_0005"
```

O script adapta planos existentes ao contrato único, valida todos os campos e preserva um backup. Em caso de erro, não sobrescreve o arquivo.

### Comandos

```bash
npm test
npm run render -- "/caminho/para/VD_0005"
npm run render -- "/caminho/para/VD_0005" --rebuild
node server/cli.mjs validate "/caminho/para/VD_0005"
node server/smoke.mjs
```

## Contrato de autoria

Estrutura resumida:

```json
{
  "project": {"name": "Meu vídeo", "format": "youtube_long", "profile": "generic"},
  "sources": {"assets": "assets", "transcript": "transcript.json"},
  "audio": {"narration": "audio/narration.wav"},
  "timeline": [{
    "id": "batman",
    "start": 0,
    "end": 5,
    "layout": "3x3",
    "background": {"color": "#182238"},
    "elements": [{
      "id": "personagem",
      "type": "image",
      "asset": "project://assets/batman.png",
      "cells": [2, 5, 8],
      "transform": {"scale": 1.2}
    }]
  }]
}
```

Detalhes: [referência do JSON](EDIT_PLAN_REFERENCE.md), [motion design](MOTION_DESIGN_JSON.md) e [exemplos](examples/).

## Novo estúdio visual

A interface foi reformulada com uma identidade própria, monograma **CT**, navegação lateral, cores suaves e um storyboard por cena. No **Editor automático**, a lista à esquerda permite localizar cenas por ID, tempo ou texto. Selecione qualquer uma para ver seu MP4 salvo em cache (ou a versão anterior, caso o JSON tenha mudado), ajustar tempos, adicionar camadas, inserir, duplicar e excluir trechos — sem começar pelo JSON.

Os detalhes de câmera, fundo, animações e elementos permanecem acessíveis em uma área avançada. Alterações ficam como rascunho até você **Validar JSON → Salvar plano**.

Veja [STUDIO_UI.md](STUDIO_UI.md) para o funcionamento do novo storyboard, cache e navegação.

## Sincronização, SFX e transições

Inserir ou duplicar uma cena no storyboard preserva o alinhamento das falas seguintes por meio de pausas explícitas na narração. SFX têm silêncio removido **somente nas bordas**, antes de serem inseridos no instante `at` do JSON; pausas internas são preservadas. Transições passam a usar os frames reais da cena entrante sem alterar a duração total. O cache visual não é invalidado por mudanças exclusivamente sonoras. O editor também permite desfazer/refazer e avisa sobre textos potencialmente sobrepostos.

Veja [CORRECOES_CACHE_AUDIO_TRANSICOES.md](CORRECOES_CACHE_AUDIO_TRANSICOES.md).

## Documentação e skill oficiais

A aba **Documentação** do site oferece o manual completo com navegação lateral, busca por campos, exemplos de JSON e diagramas SVG gerados por JavaScript. Há **somente três downloads de documentação**: **Documentação .md**, **Documentação .html** e **Skill .zip**.

A skill ZIP contém `SKILL.md`, a documentação oficial completa em Markdown e HTML, diagramas SVG, schema único e exemplos de edição. O HTML baixado é autossuficiente e inclui os diagramas sem precisar de internet para consultá-los. O Markdown referencia as figuras SVG versionadas no repositório.

Arquivos de referência: [Documentação Markdown](docs/Documentacao-ContentLab.md) · [Documentação HTML](docs/Documentacao-ContentLab.html).

O manual é gerado automaticamente a partir de `schemas/edit_plan.schema.json`, `server/docs-fields.mjs`, `server/docs-content.mjs` e `server/docs-diagrams.mjs`:

```bash
npm run docs:generate
npm run docs:check
```

Ao alterar o schema, os estilos ou as capacidades reais, revise as descrições, gere novamente e execute os testes. A validação automatizada verifica se todos os campos possuem explicação e se os arquivos publicados continuam sincronizados.

## Render e cache

No Editor automático:

- **Aproveitar cache**: mantém clipes por ID em `output/final/scenes/`; gera apenas cenas cuja assinatura mudou; reaproveita peças de composição válidas.
- **Refazer tudo**: com confirmação, limpa `output/` do projeto e gera tudo novamente. O sistema impede a exclusão se um asset de entrada estiver nessa pasta.

Os manifestos são persistidos antes da montagem final. Se houver falha na concatenação, a maior parte dos clipes continua disponível. Veja [SCENE_CACHE.md](SCENE_CACHE.md).

O resultado é `output/final/final.mp4`, com relatório `render_report.json`, narração preparada e listagem de cenas reaproveitadas.

## Transcrição

O adaptador de transcrição usa o executável `whisper-cli` e um modelo `ggml-*.bin` do whisper.cpp. Configure `CONTENTLAB_WHISPER_CLI` e `CONTENTLAB_WHISPER_MODEL` ou armazene o modelo na pasta `~/.cache/whisper.cpp/`. A segmentação e a precisão dos timestamps ainda precisam de comparação com o motor anterior.

## Estado e limites de validação

- Validação do contrato único e cache por cena: testes automáticos em Node.
- Render de ponta a ponta com Remotion + FFmpeg: smoke test na CI da branch.
- Downloads, corte, transcrição, CLI e HTTP: adaptadores Node implementados; ainda precisam de testes reais de compatibilidade.
- Empacotamento Windows, efeitos chroma/overlay, importação e recursos de interface: **paridade ainda não confirmada**.
- A skill do editor é gerada dinamicamente a partir do schema e dos guias atuais pela rota de download do aplicativo.
- Os módulos de runtime legados foram excluídos e a aplicação não depende mais de Python para abrir, renderizar, baixar mídia ou controlar projetos.

## Próximos passos de qualidade

1. Validar render do VD_0005 com assets reais e comparar frames, áudio e transições.
2. Concluir testes de downloads e transcrição nativa, revisar limites de APIs externas.
3. Corrigir diferenças visuais e testes, atualizar skill e instalador Windows.
4. Medir desempenho de render e aprimorar os componentes de motion design Remotion/HyperFrames.
5. Integrar a branch ao `main` após os testes de aceitação.

[Direção Remotion/HyperFrames](MOTION_ENGINE_STRATEGY.md).
