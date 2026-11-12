# Estilo HQ: cenas animadas, trilha e Shorts

O Content Lab monta vídeos no estilo HQ maduro, o mesmo que o plugin Diazverso planeja. São cenas animadas em Remotion, trilha que baixa sob a voz, efeitos nas trocas de cena, Shorts 1080×1920 com áreas seguras, capítulos e a lista do que foi conferido. Funciona pela interface e pelo MCP, com o mesmo núcleo.

As cenas, a trilha e os efeitos são **originais do Content Lab**. O plugin Diazverso foi usado só como referência e nada dele é copiado. A trilha e os SFX são sintetizados no seu computador (FFmpeg, sem samples de terceiros), então os direitos são próprios e servem para canal monetizado.

## Cenas HQ

Cada cena ocupa a tela inteira com fundo próprio e deixa o terço de baixo livre para a legenda. Campos do tipo *texto* aceitam várias linhas, uma por item.

| Cena (`componentId`) | Para quê | Campos principais |
| --- | --- | --- |
| `hq_abertura` | Gancho: título entra palavra por palavra | `title`, `kicker` |
| `hq_cartoes` | Ideias, etapas ou evidências ligadas | `items` (uma por linha) |
| `hq_linha_tempo` | Trajetória com datas | `items` no formato `ano \| fato` |
| `hq_comparativo` | Dois lados frente a frente, com "VS" | `leftTitle`, `leftItems`, `rightTitle`, `rightItems` |
| `hq_dialogo` | Encenação curta em balões | `lines` no formato `Nome: fala` |
| `hq_citacao` | Tese ou frase-chave revelada palavra a palavra | `text`, `author`, `highlight` |
| `hq_chamada` | Payoff ou pergunta final em estouro de quadrinho | `text`, `subtext` |
| `kinetic_emphasis` | Palavra em destaque sobre o vídeo | `text`, `color` |

Todas têm cores configuráveis (`background`, `accent`). Não use `hq_dialogo` para inventar fala de personagem de obra real.

## Montagem automática

1. Narração gerada e montada.
2. **Trilha e efeitos:** Produção assistida → *Gerar trilha e efeitos sonoros* (MCP `audio_library`).
3. **Montar no estilo HQ** (MCP `timeline_auto_assemble` com `scenes: "auto"`, `music: true`, `sfx: true`):
   - Cenas: uma cena por trecho do roteiro, na trilha **Cenas**, com início e fim nos tempos reais da narração. O plano automático põe abertura no gancho, linha do tempo onde há datas, cartões onde há várias frases curtas, frase em destaque no resto e encerramento no payoff.
   - Trilha: fica em volume baixo e abaixa sozinha enquanto há fala (*ducking* por sidechain).
   - Efeitos: whoosh nas trocas de cena e ding no encerramento.
   - Legendas: sincronizadas por cena e sempre por cima das cenas.
   - Shorts: em 9:16, aplica as áreas seguras (a legenda termina em cerca de 78% da altura, longe da interface da plataforma).
4. Troque qualquer cena na timeline: os campos aparecem no painel do clip. Pelo MCP, o agente pode usar `scene_list`, que mostra o plano sugerido, e mandar a própria lista em `scenes`.
5. Render em *Full HD*: 1920×1080 no longo e 1080×1920 no Short, a 30 fps.
6. **Pasta de entrega** (`output/entrega/`):
   - `roteiro.md`
   - `embalagem.md`, com capítulos nos vídeos longos (tempos da narração)
   - thumbnails A/B
   - `video.mp4`
   - `verificacao.md`, que lista roteiro, embalagem, direitos, render conferido com ffprobe, legendas, capítulos e aprovação final

## Comparação com o que o Diazverso planeja

| Diazverso | Content Lab |
| --- | --- |
| Roteiro aprovado, títulos A/B, thumbnails A/B | Etapas com aprovação e thumbnails A/B geradas |
| Cenas HQ Remotion (`Sequence` por beat) | Cenas HQ próprias na trilha Cenas, uma por trecho |
| Fundos procedurais HQ (meio-tom, papel, grade) | Fundo próprio em cada cena |
| SFX originais (whoosh, ding, boom, riser) | Gerados localmente por `audio_library` |
| Música sob a narração | Trilha original com ducking |
| Preset vertical 1080×1920, 30 fps, área de legenda | Áreas seguras de Shorts aplicadas na montagem |
| Legenda sincronizada com a fala | Por cena, a partir dos tempos reais dos takes |
| Capítulos conferidos no render | Calculados dos tempos da narração montada |
| Gates antes do kit | `verificacao.md` só marca o que foi conferido de fato |
| Publicação manual pelo criador | Igual: o Content Lab nunca publica |

## Limites conhecidos

- **Nox:** o personagem não está embutido. Para usá-lo, importe a imagem como mídia com direitos próprios e coloque-a na timeline.
- **Fonte das cenas:** as cenas usam Anton ou Impact quando instaladas; se não houver nenhuma, usam DejaVu Sans Bold. Nenhuma fonte é baixada automaticamente.
- **Sincronia das legendas:** a legenda segue a proporção de caracteres dentro de cada cena, sem alinhamento por palavra. Confira o render antes de publicar.
- **Escuta:** a trilha e os efeitos têm sinal medido, mas a escuta e o gosto continuam com você.

O teste real está em `npm run qa:hq`, com relatório em [QA_HQ.md](QA_HQ.md).
