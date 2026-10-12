# Direção de motion design — Remotion + referências HyperFrames

> Decisão arquitetural registrada em 2026-10-12. Este documento orienta próximas implementações; **não** significa que uma migração integral já foi executada.

## Objetivo

Tornar o Content Lab um sistema de motion design programável, com animações de qualidade cinematográfica e autoria simples via JSON e, futuramente, editor visual por cena. Priorizar estética útil para narrativas geek do Diazverso: personagens PNG, quadrinhos, cenas de games, tipografia cinética, comparações e storytelling visual.

## Referências técnicas

- HyperFrames (HeyGen): https://github.com/heygen-com/hyperframes
- HyperFrames, contrato de composições: https://github.com/heygen-com/hyperframes/tree/main/skills/hyperframes-core
- HyperFrames, biblioteca de técnicas: https://github.com/heygen-com/hyperframes/tree/main/skills/hyperframes-animation
- Remotion: https://www.remotion.dev/docs/
- Remotion, Player: https://www.remotion.dev/docs/player
- Remotion, edição com timeline: https://www.remotion.dev/docs/building-a-timeline
- Exemplo externo de integração HyperFrames + Remotion (referência, não dependência): https://github.com/notivn/AIEV

A referência HyperFrames é sua arquitetura de **animações determinísticas e seekable**, biblioteca de receitas, direção visual, composições reutilizáveis, sequências, camadas, easing, stagger, parallax, máscaras, SVG e movimento 2.5D. Não transplantar GSAP/HTML arbitrariamente para uma composição Remotion nem assumir compatibilidade automática entre runtimes. Se necessário, avaliar `@remotion/gsap` conforme compatibilidade da versão instalada e regras de seek por frame.

## Decisão arquitetural

1. **Remotion é o renderizador visual canônico para cenas `0.2` e sucessoras.** Hoje já é o padrão em `backend/contentlab/render.py` e `backend/remotion/src/scene.tsx`. Investir nele, não em ampliar paralelamente o compositor Python.
2. **Preservar o JSON `edit_plan.json` como contrato de autoria**, com versões e migrações validadas. A interface e a IA devem gerar uma descrição de cena — não código arbitrário a executar.
3. **Biblioteca tipada de componentes/presets Remotion** traduz intenções visuais do JSON em animações complexas. Reutilizar o mesmo componente no render e no futuro Player.
4. **FFmpeg continua para corte de fontes, áudio, mixagem, mux/concatenação e tarefas em que ele é mais eficiente.** “Totalmente Remotion” significa unificar a autoria e renderização das cenas visuais; não remover FFmpeg de operações em que ele é adequado.
5. **Cache persistente por ID de cena e dependências** (ver `SCENE_CACHE.md`) é obrigatório: renderizar apenas as cenas afetadas, preservar as demais e invalidar peças/transições dependentes.
6. **HyperFrames inicialmente como referência e banco de padrões**, não como segundo renderizador obrigatório. Avaliar um adaptador opcional de composições HyperFrames somente após demonstrar um caso que Remotion não resolva bem. Se existir, sua saída deve ser um segmento com o mesmo FPS, resolução, ID e contrato de cache.
7. **Compatibilidade:** manter planos `0.1` e fallback Python legados funcionando até testes de paridade. Não reescrever o produto de download/transcrição/cortes.

## Onde estamos hoje

- `backend/remotion/src/scene.tsx`: implementação React única com lógica de layout, elementos, textos e keyframes.
- `backend/contentlab/render.py`: escolhe Remotion para cenas `0.2`, Python quando solicitado e FFmpeg para composição/mixagem.
- `backend/contentlab/scene_cache.py`: cache de clipes e peças, que deve continuar independente dos componentes visuais.
- `frontend/static/visual_editor.js`: editor visual ainda limitado; não há Player interativo por cena.
- `backend/remotion/package.json`: versões do Remotion fixadas no projeto; qualquer atualização exige compatibilidade e testes.
- Estado: base funcional, porém a variedade expressiva de animações ainda é pequena. Trocar apenas o comando do render não melhora o motion design automaticamente.

## Plano incremental

### Etapa 1 — Motor de componentes e presets

Separar `scene.tsx` em componentes, sem alterar inicialmente a semântica do JSON:

- `components/SceneCanvas`, `MediaLayer`, `CharacterLayer`, `TextLayer`, `CaptionLayer`, `CameraRig`.
- `motion/presets`: entradas, pausas e saídas reutilizáveis, com parâmetros e validação.
- Componentes artísticos iniciais: **ComicPanelReveal**, **CharacterSpotlight**, **ParallaxDepth**, **ImpactTitle**, **KineticWordBurst**, **MaskReveal**, **CameraPush**, **SplitScreenCompare**, **GlitchTransition**.
- Efeitos que dependem do tempo devem ser calculados a partir de `useCurrentFrame()` / `useVideoConfig()`, ou de runtime comprovadamente sincronizado ao frame. Evitar `setTimeout`, `Date.now()`, `Math.random()` sem seed e tweens orientados apenas por relógio real.

Cada preset deve definir: parâmetros, duração, limites, easing, relação com safe area, prioridade de camadas e exemplo de JSON. Referências de HyperFrames devem ser **reimplementadas/adaptadas**, sem copiar assets licenciados de terceiros.

### Etapa 2 — DSL de animação mais expressiva

Evoluir o schema por versão para permitir algo como:

```json
{
  "id": "03_batman",
  "type": "image",
  "asset": "project://assets/batman.png",
  "animation": {
    "preset": "character_spotlight",
    "params": {
      "scaleFrom": 0.92,
      "scaleTo": 1.25,
      "enterSeconds": 0.45,
      "overshoot": 0.08
    }
  }
}
```

**Exemplo conceitual: não é formato suportado hoje.** Projetar schema, parser, validador e migração antes de aceitar o novo campo. Não permitir JS executável ou HTML arbitrário vindo do plano.

### Etapa 3 — Iteração visual rápida (sem preview de render completo)

- Integrar `@remotion/player` em uma área React isolada dentro da interface Flask existente.
- Seleção por ID, seek por frame, reprodução de uma única cena, manipulação de `position / scale / rotation` e parâmetros do preset.
- Exibir **antes/depois**: MP4 anterior do cache ao lado da composição atual em Player.
- Manter “Aproveitar cache” e “Refazer tudo” para render final, sem ressuscitar o antigo botão que codificava um segundo vídeo completo.
- Garantir que o Player não difira do export final nos frames escolhidos.

### Etapa 4 — Consolidação e performance

- Medir tempo por cena, tempo de captura, concatenação, mixagem, memória, velocidade com cache e tamanho dos arquivos.
- Continuar preservando vídeos 16:9 sem zoom implícito; `contain` para mídia narrativa, `cover` apenas quando deliberadamente selecionado.
- Reuso de assets, pré-carregamento previsível, limites de paralelismo, logs de renderer e políticas de limpeza do cache.
- Testar no Linux/Zorin e Windows. Se migrar peças de transição/áudio para Remotion, fazê-lo somente quando houver prova de paridade e ganho real.

## Critérios de aceitação das mudanças visuais

- Testes do schema e paridade de planos existentes `0.1`/`0.2`.
- Frames dourados em tempos fixos: entrada, ápice e saída; textos sem sobreposição, personagens centralizados, transparência íntegra.
- Clipe 1920×1080 em projeto 1920×1080 sem ampliação não solicitada.
- Áudio, captions, transições e duração/fps alinhados.
- Cache de cena reaproveita tudo quando nada visual mudou; alteração isolada do Batman invalida apenas os dependentes.
- Rodar `python -m unittest discover -s tests -q` e `python -m tests.visual_acceptance`; inspecionar os pixels e um render real antes de declarar paridade visual.

## Cuidados

- Remotion e HyperFrames têm modelos de autoria diferentes; combiná-los no caminho crítico pode duplicar custos de inicialização, captura de frames e manutenção.
- Conferir termos de licenciamento do Remotion para o contexto de uso; HyperFrames oficial anuncia licença Apache-2.0. Não presumir que o licenciamento de templates de terceiros seja igual ao do motor.
- Preservar a identidade editorial do Diazverso: motion design deve reforçar raciocínio e narrativa, não criar movimento gratuito.

**Próxima entrega recomendada:** um preset `CharacterSpotlight` e um `ImpactTitle` feitos em componentes Remotion, com demonstração em cenas do VD_0005, frames de regressão e comparação de render antes/depois. Só então expandir a biblioteca.
