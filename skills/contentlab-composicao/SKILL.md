---
name: contentlab-composicao
description: Planejamento de composição visual para cenas Content Lab, com hierarquia, tipografia, painéis, câmera, profundidade e adaptação 9:16/16:9.
---

# Content Lab — Composição visual

## Objetivo
Transformar a narrativa em cenas compreensíveis e visualmente expressivas, sem depender de um template rígido de duas imagens. Planejar a **cena inteira**, não elementos isolados.

## Contrato criativo de uma cena
Antes de especificar componentes, registrar de forma concisa:
- **Ideia comunicada:** o que se deve entender nesta janela de tempo.
- **Foco:** o elemento dominante, sua importância e como o olhar chega até ele.
- **Suportes:** texto, vídeo, imagem, painel, conectores, etiquetas, fundos e espaços vazios.
- **Estados visuais:** composição de abertura, desenvolvimento legível e estado de saída; o hold é deliberado.
- **Hierarquia:** escala relativa, contraste, alinhamento, legibilidade e camadas.
- **Relação com cenas adjacentes:** continuidade de elemento, corte ou transformação.
- **Tratamento por formato:** soluções específicas para 16:9 e 9:16.

## Layout e tipografia
- Use o grid e as células apenas quando ajudarem o enquadramento. Em 3x3, a coluna central é [2,5,8], e a célula central é [5].
- Evite blocos uniformes de texto. Destaque palavras essenciais por tamanho, peso, contraste, cor e timing; preservando leitura contínua.
- Dê preferência a quebra de linha planejada, margens seguras e espaço de respiro.
- Texto não deve fazer papel de legenda decorativa permanente. A frase importante pode ser representada por cena, símbolo, imagem ou interface.
- Componentes narrativos úteis: títulos de tese, comparação antes/depois, sequência progressiva, quadro de evidência, cartões conectados, interfaces explicativas e painel de resultado.
- Imagens e vídeos devem representar concretamente o assunto; não usar mídia genérica apenas para preencher tempo.

## Profundidade e câmera
- Distinga plano de fundo, contexto e foco. `z`, opacidade, sombras, máscaras, deslocamento e parallax são ferramentas, não metas.
- A câmera pode acompanhar uma informação, mas não deve ampliar um background ou recortar personagens sem uma decisão explícita.
- Separe movimento da câmera de movimento do objeto. Evite zoom em cada frase e movimentos simultâneos que competem pelo foco.
- Para transparência assimétrica de PNG, confira a caixa real visível e ajuste offsets; não confunda a borda transparente com o centro perceptivo.

## Reflow de formatos
- **9:16:** hierarquia vertical, leitura móvel, elementos empilhados, distribuição vertical equilibrada, safe areas.
- **16:9:** aproveite distribuição lateral, relações espaciais e respiro; não estique um layout vertical.
- Avalie cada proporção independentemente: legibilidade, posição do foco, clipping, sobreposição, movimentos e transições.
- `contain` preserva a mídia; `cover` implica recorte intencional. Não ampliar um 1920x1080 em outro 16:9 sem motivo.

## Entrega ao módulo de motion
Forneça uma intenção clara por elemento: estado inicial, estado focal, duração de leitura, saída e eventual objeto compartilhado com a próxima composição. Não dite easing antes de a disposição visual estar resolvida.

## Regras de consistência
A identidade gráfica vem do perfil (Diazverso/GSB), não desta skill. Evite poluição visual, tipografia espremida, interfaces pseudorreais sem função e elementos de impacto que roubam atenção da explicação.
