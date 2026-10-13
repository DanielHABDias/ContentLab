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

## Packaging e formatos
O título, thumbnail e o conteúdo devem fazer promessas consistentes. Para vídeos verticais, recomponha painéis/legendas respeitando margens; para horizontal, preserve leitura e fluxo do olhar. Verifique a escrita Diazverso em qualquer elemento público. Não inferir aceitação estética sem render inspecionado.

## Roteamento
Carregue `skills/contentlab-direcao/SKILL.md` como entrada geral e os módulos de composição, motion, timeline, contrato e revisão conforme a tarefa. Este perfil modifica decisões estéticas; não altera por conta própria campos de schema. Se houver arquivo de identidade oficial mais recente, ele prevalece.

## Não confundir
Este perfil não é, por definição, a skill de GSB. Mantenha os dois perfis independentes salvo se o usuário documentar explicitamente que se referem à mesma configuração.
