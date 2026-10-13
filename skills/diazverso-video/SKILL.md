---
name: diazverso-video
description: Aplica identidade e escolhas editoriais do canal Diazverso às composições Content Lab, preservando voz natural, Nox, quadrinhos, legibilidade e edição de baixa interferência.
---

# Diazverso — Direção audiovisual no Content Lab

## Fonte de verdade
Antes de editar conteúdo do canal, consulte `DIAZVERSO_MASTER_CONTEXT.md` quando disponível no projeto do ChatGPT. A grafia oficial é **Diazverso**, sempre com Z. Este módulo é um perfil de marca; as mecânicas de composição, timeline e JSON vêm das skills Content Lab. Em conflito editorial, prevalece o pedido explícito atual, respeitada a identidade que o criador pediu preservar.

## Identidade editorial
Canal brasileiro de cultura geek, narrativo, interpretativo e opinativo, com foco principal em super-heróis (Marvel/DC) e possibilidade de outros temas. Priorize histórias e argumentos; não transformar vídeo em noticiário, resumo enciclopédico ou lista genérica.
- Texto narrado com pensamento encadeado, natural, conversacional e confiante; sem performance publicitária ou frases de efeito em sequência.
- Começo direto, sem apresentação genérica; desenvolvimento por causa, consequência, reação e opinião argumentada.
- A voz é o elemento humano principal; criador não aparece em câmera.
- Decupagem visual deve representar personagem, cena, acontecimento ou ideia mencionada, sempre que possível, sem induzir fatos errados ou spoilers antecipados.
- Não usar cortes e animações apenas para preencher silêncio. Duração da peça depende da tese, não de uma fórmula rígida.

## Montagem e motion
**Baseline: baixa interferência.** Se voz e imagem bastarem, corte simples. Use picos seletivos para hook, revelação, reação, comparação, virada e payoff. O aprendizado do vídeo @thejplabs é sobre direção de composição, coreografia e continuidade; não replicar cada movimento em todo vídeo.
- Texto curto e funcional. Palavras destacadas devem acrescentar ênfase real.
- Painéis de HQ, retículas e divisórias são linguagem visual possível, nunca obrigação que dificulte a leitura.
- Zoom, glitch, transição e SFX só com propósito; evitar especialmente whoosh repetido, poluição visual e música competindo com voz.
- Nox é marca/reação/humor; não inserir em toda cena. Respeitar o personagem oficial: capuz preto, rosto sem traços, olhos amarelos grandes e glitch dimensional azul/vermelho controlado; nunca redesenhá-lo.
- Paleta derivada de preto, azul elétrico, vermelho vivo e amarelo, com branco/cinzas auxiliares. Bangers e Anton para funções de destaque; respeitar referência visual aprovada antes de qualquer descrição textual.

## Direção de arte preferida — moderno, limpo e animado
O criador aprovou como referência visual o **Content Lab Studio**: estética editorial premium inspirada no cuidado visual de interfaces Apple, **sem copiar uma interface Apple**. Priorizar esse acabamento em gráficos explicativos, cartões de comparação, abertura de bloco, diagramas e cenas TSX, combinando-o com a identidade do Diazverso.
- **Fundos:** variar conforme o beat entre off-white, cinza-gelo, cinza-azulado, carvão, preto, azul profundo ou gradiente sutil. Evitar usar sempre o mesmo fundo preto ou sempre papel; selecionar fundo por legibilidade/atmosfera.
- **Cards e painéis:** superfície branca ou grafite, cantos arredondados, borda quase imperceptível, sombra suave, hierarquia de texto e respiro; realces pontuais em azul elétrico, vermelho ou amarelo do canal. Layouts limpos são preferíveis a overlays saturados.
- **Tipografia:** sans-serif de UI com acabamento próximo a Inter para narrativas explicativas e texto secundário, desde que esteja disponível no projeto; **Anton** como título de impacto, **Bangers** para acento HQ deliberado. O CSS do Studio lista fontes do sistema, inclusive nomes da Apple, mas não acompanha um arquivo de fonte Apple nem autoriza sua redistribuição.
- **Hierarquia editorial:** título grande em carvão/white; frase auxiliar em cinza com contraste legível, como o contraste entre “Crie cena por cena.” e “Sem complicar.” no Studio. Palavras, textos, personagens e cards não precisam competir pela atenção.
- **Motion premium:** movimentos suaves, aceleração/desaceleração deliberadas, poucos pixels de deslocamento, entradas com escala/opacity moderadas, stagger por função, hold real e saída coerente. Um contraste forte pode ficar *parado* para ser compreendido; não converter elegância em animação constante.
- **Equilíbrio geek:** segmentos literais de filmes, quadrinhos e jogos seguem fundamentais. HQ/glitch/Nox aparecem como assinatura nos momentos certos, não em todos os cards. Cenas TSX servem para casos complexos, como cronologias, relações e universos.
Para especificações, delegar composição a `contentlab-composicao`, movimento a `contentlab-motion`, e TSX a `contentlab-cenas-tsx`. Manter a **baixa interferência** como baseline narrativo, mas sem impedir cenas elaboradas quando elas explicam melhor.

## Cenas complexas com Content Lab
Quando uma explicação do Diazverso exigir linha temporal de universos, mapas de relações, painel de evidências animado, tipografia coreografada ou câmera percorrendo o mesmo ambiente, usar a skill `contentlab-cenas-tsx` para criar **um arquivo Remotion TSX completo**. Pedir ao ChatGPT esse arquivo com a composição pronta para o formato e os tempos, baixar/salvar manualmente no `custom-scenes/` do projeto e integrar por `customComponent.module` em vez de despejar a lógica no `edit_plan.json`. Para economizar tokens, pedir o TSX uma vez e depois só pequenos patches e `props`/fragmentos JSON.

Não usar TSX apenas porque está disponível. O padrão Diazverso continua sendo **baixa interferência**, com B-roll narrativo real e cortes simples sempre que suficientes. SVGs, cards e linhas podem nascer do código; cenas de filmes, Nox e imagens autorais continuam sendo assets reais em `customComponent.assets`. Não redesenhar Nox. O site não importa automaticamente arquivos criados pelo ChatGPT; o TSX local renderiza sem configuração extra, mas continua sendo código executável sem sandbox e exige projeto confiável.

## Checagens aprendidas com VD_0005
- Em perguntas narradas rapidamente, agrupe a tipografia em unidades de pensamento legíveis; não force uma troca por palavra. Se a pergunta termina com um personagem, o PNG pode substituir a palavra, mas enquadre o corpo/cabeça dentro da área segura e confira a prévia com a câmera efetiva.
- Nox deve ter presença visual clara nas cenas pixeladas sem encobrir as legendas Bangers nem os textos laterais. Ajuste escala por composição e inspecione os momentos de zoom; não amplie todas as aparições cegamente.
- Sobre papel branco, use tipografia escura. Capas e páginas de HQ são elementos de composição, não backgrounds; alinhe seu centro visual ao centro do quadro durante o hold, inclusive após a animação de entrada.
- Em carrosséis de argumentos, quando houver uma cena real imediatamente anterior ou subjacente, mantenha-a visível porém escurecida atrás das palavras; evite tampa preta 100% opaca se isso eliminar contexto visual. A placa de texto deve continuar contrastada.
- Em painéis conectados por linhas, desenhe o caminho na frente dos cartões quando a leitura pedir continuidade, mas fora da região das etiquetas e rostos. A linha não deve parecer escondida pela caixa.
- Use TSX para substituir cartões de texto quando uma trajetória, relação causal ou câmera pelo mesmo plano ajudar a explicar a tese. Teste os beats com `transcript.words`; preserve os clipes reais, Nox e CTAs. O VD_0005 usa `PerguntaAbertura`, `ConflitoCentral` e `OutraRazao` como exemplos, não como moldes obrigatórios para todo vídeo.
- Transições `blur_*` do Content Lab ocupam o começo da cena seguinte. O whoosh limpo deve soar no **meio audível** dessa janela: calcule o `at` a partir do início da cena entrante e da duração real do SFX após o trim das bordas. Confira o blur em quadros intermediários, não apenas na lista de efeitos.
- Uma cama instrumental discreta pode iniciar em `-26 dB` com ducking da narração, fade-in/out e ajuste após escuta. Não incluir música como padrão automático: respeite o pedido do vídeo e deixe voz e efeitos mais claros.

## Packaging e formatos
O título, thumbnail e o conteúdo devem fazer promessas consistentes. Para vídeos verticais, recomponha painéis/legendas respeitando margens; para horizontal, preserve leitura e fluxo do olhar. Verifique a escrita Diazverso em qualquer elemento público. Não inferir aceitação estética sem render inspecionado.

## Roteamento
Carregue `skills/contentlab-direcao/SKILL.md` como entrada geral e os módulos de composição, motion, timeline, contrato e revisão conforme a tarefa. Este perfil modifica decisões estéticas; não altera por conta própria campos de schema. Se houver arquivo de identidade oficial mais recente, ele prevalece.

## Não confundir
Este perfil não é, por definição, a skill de GSB. Mantenha os dois perfis independentes salvo se o usuário documentar explicitamente que se referem à mesma configuração.
