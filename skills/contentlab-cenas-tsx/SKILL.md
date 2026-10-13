---
name: contentlab-cenas-tsx
description: Cria cenas Remotion complexas como arquivo TSX completo para download/salvamento manual e integração via customComponent no edit_plan.json, economizando tokens.
---

# Content Lab — Cenas programáveis TSX

## Quando acionar
Use para cenas em um mesmo espaço visual: câmera acompanhando trajetórias, diagramas procedurais, linha do tempo, multiverso, grafos, geometria SVG, grades, partículas, grupos de cards coordenados ou tipografia com muitos keyframes. Para cenas simples, preferir componentes declarativos do JSON. O critério não é "parecer bonito", é reduzir complexidade de autoria e manter uma cena coesa.

## Contrato instalado (não inventar integração)
O Content Lab suporta `timeline[].customComponent` com `module`, `mode`, `props` e `assets`. `module` deve referir `project://custom-scenes/Arquivo.tsx`; a pasta é na **raiz do projeto de vídeo**, não na pasta do repositório ContentLab. `replace` substitui a composição visual normal; `overlay` apresenta o TSX sobre a renderização da cena. A narração e o mixer FFmpeg continuam no projeto; não criar um segundo player/renderer.

O arquivo TSX precisa **exportar um componente React como default**. Recebe propriedades vindas de `props` e um objeto `assets` com URLs dos assets declarados. O arquivo gerado por ChatGPT precisa ser baixado/salvo e copiado manualmente para `custom-scenes/`. Não alegar que o site o instala automaticamente ou que o JSON aceita código executável.

## Entrega econômica de tokens
1. Identifique só os dados que faltam: duração, proporção, beats/fala, elementos centrais, assets existentes e identidade visual.
2. Decida se é **uma cena contínua** com mundo/câmera próprios ou várias cenas independentes. Se a câmera percorre um cenário persistente, em geral escolha uma cena.
3. Gere **um arquivo `MinhaCena.tsx` completo**, sem trazer o código inteiro para uma longa explicação. Se ferramentas de arquivo estiverem disponíveis, entregar o TSX como arquivo; caso contrário, um único bloco de código. Não afirmar download criado quando não criou.
4. Forneça um **fragmento JSON mínimo** para `customComponent` ou uma cena completa apenas se o usuário pedir; nunca reimprimir todo o `edit_plan.json` sem necessidade.
5. Se estiver revisando uma cena existente, altere o menor trecho de código possível, preserve os demais arquivos/IDs e evite retransmitir TSX ou JSON inalterado.

## Biblioteca visual recomendada para TSX — Modern Editorial UI
Quando o briefing pedir o acabamento refinado do Studio do Content Lab, criar no próprio componente **primitivas React/SVG reutilizáveis** (`Card`, `SectionTitle`, `AccentPill`, `SoftPanel`, `TimelineNode`) sem depender de downloads para cada forma. Evitar pacote NPM extra se SVG/CSS bastar.
- Tokens de referência *adaptáveis*: `#F5F6F8` (canvas claro), `#FFFFFF` (card), `#171A22` (texto), `#8B93A0` (secundário), `#E3E6EB` (borda), `#1769E0` (acento); variante dark `#0D111B` com painel `#19263D`/gradiente azul e detalhes de marca somente quando significativos.
- Tipografia de UI: `Inter` quando fornecida com licença e asset resolvido, ou sans-serif disponível no render; no Studio há uma pilha CSS com fontes Apple como fallback, **não um arquivo SF Pro distribuído**. Anton/Bangers continuam possíveis para títulos de impacto.
- Desenhar cantos arredondados, linhas finas, sombras difusas, hierarquia título/subtítulo com contraste e respiro proporcional à resolução, não importar screenshots do site como assets.
- Animar por frame: card sobe poucos pixels com opacidade, vira/funde entre estados, foco troca suavemente e depois faz hold; não duplicar padrões de hover CSS. `interpolate/spring` com limites para não provocar overshoot inútil.
- Aplicar os princípios à informação narrada: comparações, linhas do tempo, rankings, relações, mapas, cards de contexto. Para matéria real, usar o asset verificado como mídia principal e cards como apoio.
- Gerar **um arquivo TSX completo + JSON mínimo** e revisar pequenos patches para economizar tokens. Não converter cada card em um novo arquivo.
A composição deve parecer um vídeo editorial sofisticado, não uma gravação de interface ou uma imitação de marca comercial.

## Implementação recomendada
- `useCurrentFrame()`, `useVideoConfig()`, `interpolate()`, `spring()` e SVG/React para movimento determinístico; calcule cada instante sem `setInterval`, `Date.now`, CSS keyframes/transition ou estado dependente da ordem dos frames.
- Agrupe objetos e movimento de câmera em um sistema de coordenadas consistente; mantenha HUD/legendas fixas fora do grupo transformado pela câmera.
- Use React/SVG para grades, linhas, círculos, conectores, cartões e painéis sempre que forem geometria, em vez de solicitar imagens externas.
- Use `assets` do JSON para imagens e fontes verificadas (URIs `project://` ou `builtin://`), sem URLs externas inventadas. Em TSX, consuma `assets.logo`, `assets.nox` etc. Não presuma bibliotecas NPM não instaladas.
- Separe composição de entrada, transformação, hold e saída, sincronizadas com beats; uma cena pode conter vários momentos sem cortar o cenário persistente.
- `props` recebe parâmetros serializáveis (textos, cores, valores), para facilitar reaproveitamento e evitar regeração de código. O TSX pode importar módulos locais em `custom-scenes/`; evite dependências arbitrárias.
- Respeite 9:16 e 16:9 por layout/reflow ou componentes apropriados; não dependa de crop automático.

## Ativar e validar
Código TSX é executável e **não está em sandbox**. Exigir revisão de origem e opt-in local `CONTENTLAB_TRUST_CUSTOM_TSX=1`. Não sugerir ativação irrestrita para código desconhecido. A verificação do JSON não compila o TSX: renderizar, olhar checkpoints de frames, conferir clipping/timing e ouvir áudio final.
O cache por cena deve perceber alterações das fontes dentro de `custom-scenes/`; preservar IDs estáveis e nunca concluir paridade pixel-perfect com a referência sem comparação de frames.

## Exemplo oficial
`examples/custom-scenes/FollowDot.tsx` + `examples/programmatic-motion-edit-plan.json`. É uma demonstração procedural validada no CI, não cópia do vídeo fonte. Para trabalhar com um roteiro real, usar a narração preparada e assets próprios.
