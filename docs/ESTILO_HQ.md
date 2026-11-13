# Cenas HQ do modo clips: imagens e legenda por palavra

O modo clips monta vídeos num padrão visual mínimo: imagem do assunto em cada cena, Anton, legenda palavra a palavra e troca visual frequente. Funciona pela interface e pelo MCP, com o mesmo núcleo. A montagem principal é o modo composição ([MOTION.md](MOTION.md)).

As cenas são código do Content Lab, em `src/timeline/components/hq/`. Os arquivos que elas usam ficam em `assets/kit/`:

- a fonte Anton, sob a SIL OFL, com a licença em `assets/kit/fonts/OFL.txt`;
- a página HQ (`backgrounds/comic-page.png`);
- os ícones SVG.

## O que o padrão exige

| Regra do padrão | Como o Content Lab cumpre |
| --- | --- |
| Imagem com assunto em toda cena | Cada beat recebe uma imagem do projeto (`media:<id>`) ou a página HQ. A montagem automática **recusa** projeto sem imagens do assunto (`VISUAL_EVIDENCE_MISSING`); slides de texto não contam |
| Troca visual a cada 4–8 s (longo) e 2–5 s (Short) | Um beat por frase ou grupo curto de frases: no máximo 7 s no longo e 4,5 s no Short |
| Não repetir o mesmo componente seguido | O plano alterna imagem com frases, página HQ de dois painéis e galeria de cartas |
| Anton | Embutida em `assets/kit`. Cenas e legendas usam Anton |
| Legenda palavra a palavra com tempos reais | `narration_transcribe` (Whisper local) gera os tempos de cada palavra; a legenda sai em blocos de até 3 palavras. Sem transcrição, cai para legenda por frase |
| Trilha licenciada | A trilha de `audio_library` é só **rascunho**. A verificação fica pendente até você importar uma faixa licenciada (YouTube Audio Library ou biblioteca sua) com papel *música* |
| SFX com função | Whoosh nas trocas de trecho e ding no payoff, originais |
| Legenda fora da cena no Short | A cena ocupa os 64% de cima; embaixo, uma faixa gerada (meio-tom e linha amarela) recebe a legenda |
| Short de 60 s ou mais | Aparece na verificação como decisão sua, sem bloquear |

## Cenas disponíveis

`scene_list` mostra cada cena com as suas props e um exemplo. Props do tipo JSON aceitam objetos e listas. Referências de arquivo dentro das props:

- `media:<id>`: imagem do projeto;
- `brand:anton` e `brand:comic-page`;
- ícones: `brand:escudo`, `brand:lampada`, `brand:balanca`, `brand:caminho`, `brand:mascara` e `brand:raio`.

| `componentId` | Para quê |
| --- | --- |
| `hq_imagem_frases_hq` | Imagem do assunto com 1–3 palavras de impacto (gancho, evidência, payoff) |
| `hq_pagina_hq_cenas` | Página HQ com 2–4 painéis de imagens ou clipes |
| `hq_galeria_cartas_hq` | Cartas com imagem e título em sequência |
| `hq_comparativo_ideias_hq` | Duas ideias ou consequências frente a frente |
| `hq_dialogo_hq` | Diálogo curto, por exemplo personagem × uma ideia. Nunca use fala canônica inventada |
| `hq_linha_do_tempo_hq` | Linha do tempo com clipes por marco |
| `hq_brainstorm_hq`, `hq_carrossel_frases_hq`, `hq_texto_hq`, `hq_quadro_hq_sobre_cena`, `hq_caixinha_hq`, `hq_barra_loading_hq`, `hq_personagem_espiral_legenda`, `hq_comic_page_cta` | Recursos pontuais (ênfase curta, orientação, CTA) |

## Fluxo

1. **Roteiro aprovado:** história ou trajetória, ou ensino através da história.
2. **Imagens do assunto:** importe imagens dos personagens, capas, painéis ou frames oficiais com direitos confirmados (`media_import_files`). Os direitos são confirmados na importação.
3. **Narração**, gerada e montada.
4. **`narration_transcribe`** + `job_wait`, para a legenda palavra a palavra. Leva cerca de 3× a duração do áudio em CPU.
5. **`scene_list`:** confira o plano, troque cenas ou imagens se quiser e mande a lista em `scenes`, ou use `"auto"`.
6. **`timeline_auto_assemble`** com `scenes`, `sfx: true` e a sua trilha licenciada (`music: true`).
7. **Render** em Full HD, depois **entrega**. O `verificacao.md` inclui:
   - imagem em cada cena;
   - trilha licenciada;
   - legendas;
   - capítulos;
   - direitos;
   - a duração do Short.

Na interface, o caminho é Produção assistida → *Montar no estilo HQ*. No painel do clip, as props JSON aparecem em campos editáveis.

## Limites

- **Imagens:** o Content Lab não busca nem baixa imagens de personagens. Escolher a imagem e confirmar os direitos é com você (ou com o agente, com a sua aprovação).
- **Transcrição:** a legenda vem do Whisper e pode errar nomes próprios. Corrija na timeline antes do render final.
- **Gosto:** escuta, visual e ritmo final continuam com você. A verificação só marca o que foi conferido.

O teste real está em `npm run qa:hq`, com relatório em [QA_HQ.md](QA_HQ.md).
