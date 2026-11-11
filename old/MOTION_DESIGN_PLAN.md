# Plano de evolução de motion design

O Content Lab usa uma **única** estrutura `edit_plan.json`, interpretada pelo Remotion. O backend-alvo é Node.js. O HyperFrames é referência de composição determinística e animações visuais, não um segundo motor obrigatório.

## Prioridades

1. Unificar servidor, parser, cache, áudio, download e transcrição em Node.js, removendo o código Python antigo.
2. Preservar os MP4s e manifestos de cache por cena e transição, sem Preview completo duplicado.
3. Concluir paridade de áudio, transições, chroma key, assets, legendas e UI no Zorin e Windows.
4. Extrair componentes ReMotion reutilizáveis: `CharacterSpotlight`, `ImpactTitle`, `ComicPanelReveal`, `ParallaxDepth`, `SplitScreenCompare`.
5. Criar editor visual por ID de cena, com Player sincronizado ao mesmo código do render final.
6. Medir desempenho em cenas reais do projetos reais de validação.

Os itens de migração são detalhados em `CURRENT_ARCHITECTURE.md`. Os componentes novos são propostas, não recursos disponíveis no schema ainda.
