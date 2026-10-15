---
name: contentlab-composicao
description: Planejamento de composição visual para cenas Content Lab, com hierarquia, tipografia, painéis, câmera, profundidade e adaptação 9:16/16:9.
---

# Content Lab — Composição visual

## Crop obrigatório de footage horizontal em Shorts Diazverso (14/10/2026)

Quando o projeto for **Short 9:16 do Diazverso**, vídeo de origem 16:9 deve manter proporção e ocupar **toda a composição**: usar `background.fit: "cover"` ou `objectFit: "cover"; objectPosition: "center center"` no TSX. O espectador vê prioritariamente a **coluna central do vídeo original**; **não encaixar todo o 16:9 dentro do 9:16 com barras** (`contain`). Reenquadramento horizontal só com intenção e teste explícitos. Em painéis internos de HQ, o crop pode ser escolhido por painel, mas o fundo full-bleed conserva cover.

Para Shorts dinâmicos, alternar **formas diferentes de motion**, em vez de repetir o mesmo título em todos os beats: câmera/página HQ, prova/dossiê, split, zoom-out/zoom-in, clip dessaturado que ganha cor, tipografia Anton com fundo mutável, timeline, máscara e composições com clips reais verificáveis. Nenhum vídeo sobre uma obra deve virar só abstracionismo de TSX. Os Shorts continuam com a assinatura sonora Minecraft (0–3 s), riser antes da primeira transição, blur direcional com Woosh durante, música pós-blur e CTA final. Não aplicar essa assinatura a longos.



## Perfil Diazverso — composição final revisada 15/10/2026

A identidade visual vigente é **HQ editorial simples**, não UI genérica nem densidade alta de TSX. Caixas de narrador frequentes (principal branca/creme e etiqueta amarela superior com sombra preta) podem indicar nome de obra no canto superior esquerdo, contexto ou uma nova ideia. Halftone/molduras/papel e lettering Bangers apoiam imagens e cenas relevantes; Anton grande em frases fortes, em fundo sólido ou sobre vídeo escurecido. Não impor balões, grafos complexos, cards modernos ou painéis repetitivos. Poucos TSX 16:9 reutilizáveis para longos; TSX 9:16 só em Shorts e em momentos selecionados. Texturas recorrentes podem ser PNG/overlay transparente sem script novo.

Imagens completas/ilustrações NUNCA imóveis: zoom-in/out suave ou pan; para deslocamento, redimensionar a imagem de modo que ultrapasse a área visível por TODA a animação, sem borda preta inesperada. PNGs RECORTADOS entram/saem animados, pairam/balançam suavemente e podem surgir sobre clipe escurecido, papel, estrelas ou painel HQ. Clips pertinentes variam sem repetir o mesmo continuamente e sem spoilers; uma cena pode continuar enquanto a fala avança, não cortar a cada palavra. Longos preservam proporção original de footage; filmes/animações/séries usam CRT sobreposto e games NÃO usam por padrão. Shorts mantêm a explosão Minecraft e legendas Bangers obrigatórias abaixo do centro com contorno fino e sombra. Não impor assinatura de Shorts a longos.

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

## Design editorial contemporâneo — repertório do Studio
Quando o projeto pedir estética moderna, elegante ou `premium`, use os princípios observados no próprio Content Lab Studio (`frontend/static/studio.css`): **hierarquia de informação, espaço negativo, contraste controlado e materialidade sutil**. Referência de acabamento associada a interfaces Apple, **sem copiar telas, marcas nem depender de fontes proprietárias**.

- **Sistema visual:** base clara em branco-gelo (`#F5F6F8`), superfície branca (`#FFFFFF`), cinzas (`#F4F5F7`, `#8B93A0`), texto carvão (`#171A22`); versão escura em carvão (`#0D111B`), grafite e azul profundo. Usar cor saturada apenas como acento significativo, conforme o perfil de marca.
- **Fundos não monótonos:** alternar conscientemente papel branco/off-white, cinza suave, cinza-azulado, carvão, degradê azul profundo e superfície ligeiramente texturizada. Fundo deve apoiar legibilidade e tema do beat; não variar só para parecer agitado. Gradiente sutil e glow localizado podem sugerir profundidade.
- **Cards e painéis:** retângulos com cantos arredondados proporcionais ao quadro, contorno fino e claro, sombras difusas de baixa opacidade, preenchimento distinto do fundo, espaçamento interno generoso e hierarquia título → conteúdo → detalhe. Em fundo escuro, usar painel grafite e borda iluminada discreta; evitar vidro desfocado excessivo.
- **Tipografia:** sans-serif contemporânea, preferencialmente **Inter** ou outra fonte legível que esteja *realmente disponível e licenciada no projeto*, para títulos, frases editoriais e interface; contraste com **Anton** e **Bangers** nos impactos seletivos. O site usa fallback CSS `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", sans-serif`, não uma fonte Apple embutida. Não inventar disponibilidade ou distribuir SF Pro sem direitos.
- **Título principal + secundário:** copiar o princípio, não o layout literal, de “Crie cena por cena.” em destaque e “Sem complicar.” em cinza secundário: tamanho e peso hierarquizados, segunda mensagem em menor contraste, boa entrelinha e espaçamento levemente fechado, sem sacrificar legibilidade.
- **Composição primeiro:** numa comparação, uma lista ou uma linha do tempo, alinhar pela grade, estabelecer foco e respiro e depois animar. Evitar transformar todo vídeo em mockup de aplicativo; os cards são uma linguagem de explicação, não obrigação estética.
- **Identidade do projeto:** esse é um repertório **opcional** do Content Lab; a skill de marca define onde usá-lo. No Diazverso, compatibilizar com preto/azul/vermelho/amarelo e com B-roll de filmes/jogos, sem trocar cena literal útil por card decorativo.

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

## Quando entregar a cena como TSX
Se a composição exigir **mundo virtual contínuo**, câmera seguindo trajetórias, dezenas de formas desenhadas, máscaras ou muitas relações de transformação entre objetos, passe um mapa simples dos estados visuais à `contentlab-cenas-tsx` e mantenha a cena inteira coesa. Não descreva individualmente centenas de retângulos no JSON: as formas geométricas devem ser geradas em SVG/React. Declare os poucos assets reais via `customComponent.assets`. A skill especializada gera o componente, enquanto esta determina foco, layout e reflow por formato.

## Entrega ao módulo de motion
Forneça uma intenção clara por elemento: estado inicial, estado focal, duração de leitura, saída e eventual objeto compartilhado com a próxima composição. Não dite easing antes de a disposição visual estar resolvida.

## Regras de consistência
A identidade gráfica vem do perfil (Diazverso/GSB), não desta skill. Evite poluição visual, tipografia espremida, interfaces pseudorreais sem função e elementos de impacto que roubam atenção da explicação.

## Composição espacial e profundidade por camadas

Pense a cena como um palco 2D/2.5D maior que o viewport: palavras, clipes, fotos e gráficos têm coordenadas, profundidades aparentes e relações; a câmera leva o foco de um destino para outro **chegando antes ou durante a palavra que o nomeia**, nunca só depois da enunciação. Texto em diagonal superior direita seguido de assunto abaixo pode ser uma rota contínua, não dois cartões genéricos.

Para efeito de separar camadas, identificar planos independentes **de verdade**: fundo, recorte transparente de sujeito, primeiro plano, grafismo/HUD. Animar parallax, z-order, oclusão e perspectiva de forma coordenada; não prometer que uma foto achatada vira volumetria 3D sem segmentação. Quando não houver recortes, usar painéis geométricos explicitamente estilizados. Cuidado com clipping, deformação de personagens, texto em ângulo ilegível e proporção de vídeo.

O Diazverso deve preferir cenas/ilustrações, cortes simples e poucos TSX HQ reutilizáveis; grafos, mapas e movimentos espaciais complexos ficam disponíveis apenas quando pedidos ou necessários para compreensão. Variar conceito espacial antes de variar enfeites.


## Referência HQ aprovada para novos projetos Diazverso

Priorizar caixas retangulares de narrador, calhas/painéis simples, sombra preta, retícula/halftone sutil, Bangers para HQ e Anton para afirmações de impacto. Desenhar poucos modelos com Codex, validar visualmente e reutilizar. Balões de fala, onomatopeias, câmera 2.5D e geometrias elaboradas dos antigos kits são repertório técnico opcional — não identidade padrão nem motivo para criar mais TSX. VD_0005 fechado não recebe migração retroativa.
