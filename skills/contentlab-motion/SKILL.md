---
name: contentlab-motion
description: Planeja coreografia de motion design no Content Lab: keyframes, easing, stagger, estados, movimento por frame, câmera e transições com continuidade.
---

# Content Lab — Movimento e coreografia

## Propósito
Definir **por que, quando e como** a composição muda. Movimento deve guiar atenção e explicar relações; não acrescentar atividade visual artificial.

## Unidade fundamental
A cena tem estado de entrada → estabelecimento do foco → desenvolvimento → hold legível → saída. Elementos podem ter trajetórias coordenadas e tempos sobrepostos. Preserve o foco durante a animação: não mova quatro coisas concorrentes sem hierarquia.

## Gramática de movimento
- **Revelação:** dar entrada a nova informação.
- **Destaque:** reposicionar hierarquia com escala, cor, opacidade ou máscara.
- **Relação:** conectar, agrupar ou comparar elementos.
- **Transformação:** um painel vira um detalhe, uma carta vira parte de uma interface, uma representação se reorganiza.
- **Transição:** cena seguinte herda ou substitui o foco.
- **Respiração:** corte simples, pausa visual ou permanência sem efeito.

## Keyframes e easing
- Especifique mudanças relativas ao tempo da cena; use timeline absoluta apenas quando o contrato exigir.
- Priorize trajetórias que cheguem com desaceleração coerente. Curvas lineares continuam adequadas para progresso contínuo.
- `ease_out` sugere entrada rápida e acomodação; `ease_in` acelera rumo à saída; `ease_in_out` suaviza ambos os extremos. Spring, overshoot e elasticidade só quando combinarem com a identidade e o conteúdo.
- Evite overshoot excessivo, saltos, efeitos de quique repetidos e movimentos muito curtos para serem percebidos.
- FPS não altera duração editorial. Em 30 fps, 0,1 s fornece aproximadamente 3 quadros; em 60 fps, 6. Aumentar duração para mascarar pouca suavidade é erro.

## Stagger e dependências
- Planeje uma janela compartilhada: título estabelece contexto, painel aparece, conteúdo se revela, destaque assume protagonismo.
- O início de B pode ser relativo ao início ou ao término de A; sobreposições são legítimas, desde que mantenham legibilidade.
- Preferir grupos e movimentos relativos quando vários componentes formam um único objeto visual.
- Evitar padrões automáticos iguais para todas as cenas: escolha a cadência pelo significado, não por alternância mecânica de efeitos.

## Continuidade entre cenas
- Se um elemento persiste, identifique-o e planeje transformação de posição/escala/hierarquia sem teleportar.
- Use cortes secos quando uma transformação não trouxer ganho real.
- Preserve o timing exato definido pela edição: `enterDuration`, `exitDuration`, `transitionDuration` e `keyframe.t` não devem ser ampliados automaticamente por preferência estética.
- Entradas, saídas, keyframes e câmera podem usar interpolação suave; `linear` explícito mantém a intenção linear. Não confundir suavidade com velocidade.

## Áudio e sincronismo
Defina âncoras de fala/evento antes de coreografar. Movimentos não devem revelar uma resposta antes que a narração prepare o público, nem atrasar o entendimento depois da fala. SFX é pontuação seletiva, não obrigatório em todo corte.

## Coreografia procedural com TSX
Para uma trajetória animada única com vários beats, usar `contentlab-cenas-tsx`: ela cria um componente `export default` com quadro determinado por `useCurrentFrame` e `useVideoConfig`. Uma cena pode durar vários segundos e conter diversos momentos de tipografia, geometria e câmera sem divisões artificiais. Separar transformações dos objetos da câmera e de sobreposições fixas, sincronizar efeitos com narração, dar hold real e minimizar animações que não informam. Pedir ao ChatGPT o `.tsx` como arquivo e apenas o fragmento JSON para render, poupando tokens.

## Implementação e inspeção
Produção baseada em frames determinísticos e estado calculável para qualquer instante; sem relógio do sistema ou aleatoriedade sem seed. Compare frames antes, durante e depois do movimento, verificando trajetória, clipping e hold. Se o contrato atual não expuser alguma interpolação avançada, mantenha a intenção registrada como requisito de engenharia — não invente propriedades JSON.
