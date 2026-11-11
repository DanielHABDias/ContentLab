# Benchmark técnico e audiovisual

Pesquisa realizada em 11 de novembro de 2026. As referências servem para decisões e não autorizam cópia de código ou assets.

## Editores e runtimes

| Referência | Evidência útil | Licença/risco | Decisão |
| --- | --- | --- | --- |
| Remotion | Player React e render programático; composição parametrizada | licença própria; elegibilidade precisa ser conferida para cada distribuição | adotar atrás de adaptador, com FFmpeg para operações de mídia |
| Hyperframes | HTML/TS, timelines aninhadas e render determinístico frame a frame | Apache-2.0 no repositório consultado; projeto ainda muda rapidamente | não usar como núcleo; observar componentes HTML/agent-first |
| FableCut | timeline JSON, MCP stdio, REST e resposta compacta | MIT; compositor browser tem paridade de exportação limitada | aproveitar princípios de contrato compacto e bind local, não código |
| OpenChatCut | mesma timeline para pessoa/agente, comandos validados e undo | AGPL-3.0; incompatível com incorporação casual | apenas benchmark arquitetural |
| Timeline Studio | planos revisionados, dry-run, IDs idempotentes e projeto portátil | MIT, mas pesos/assets têm licenças próprias | adotar operações transacionais e revisão-base |
| Legado Content Lab | experiência real com Remotion/FFmpeg, cache e áudio | código próprio, porém arquitetura acoplada e módulos removidos | reutilizar aprendizados/testes pontuais, não a estrutura |

MCP local usa transporte `stdio`. A documentação oficial exige preservar `stdout` exclusivamente para JSON-RPC; diagnósticos irão a `stderr`. Ferramentas serão semânticas, paginadas/compactas e compartilharão schemas com a CLI.

## Motion design estudado

Princípios extraídos de documentação, breakdowns e showreels, convertidos em presets originais:

- Movimento nasce da hierarquia narrativa: entrada, leitura, ênfase e saída; nenhum efeito existe só para preencher tempo.
- Tipografia cinética usa grupos de palavras, antecipação curta e settle; evita animar cada palavra da mesma forma.
- Easing padrão `ease-out` para entradas e `ease-in` para saídas; springs exigem limite de overshoot e duração determinística.
- Cortes e transições se alinham a frase, beat ou mudança de argumento. J-cuts/L-cuts preservam continuidade quando a imagem muda.
- Composição HQ usa retícula, recortes e parallax com parcimônia; glitch azul/vermelho é acento de 2–6 frames, não ruído contínuo.
- Layout parte de coordenadas normalizadas e safe areas; 9:16 recebe composição própria quando crop/anchor não basta.

Presets iniciais planejados: `kinetic-emphasis`, `panel-reveal`, `halftone-push`, `chromatic-hit` e `evidence-callout`. Cada preset terá parâmetros, duração, redução de movimento e teste de primeiro/último frame.

## Escolhas

1. React + Node + Zod, com um monorepo simples antes de haver justificativa para workspaces.
2. Projeto e timeline JSON versionados são a fonte de verdade; preview e render são projeções determinísticas.
3. Remotion/FFmpeg por adaptadores. Hyperframes fica como referência, não dependência.
4. Persistência local com journal, snapshots e conteúdo endereçado por hash.
5. Sem React Flow inicialmente: a lista de workflow é mais clara que um grafo para o fluxo linear com retornos.
6. Transcrição e voz terão um modelo escolhido por benchmark local, não catálogo de opções frágeis.

## Fontes primárias

- https://modelcontextprotocol.io/docs/develop/build-server
- https://www.remotion.dev/docs/player
- https://www.remotion.dev/docs/renderer/render-media
- https://www.remotion.dev/docs/licensing
- https://github.com/heygen-com/hyperframes
- https://github.com/ronak-create/FableCut
- https://github.com/0xsline/OpenChatCut
- https://github.com/MartinDelophy/ai-video-editor
