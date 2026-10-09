# Motion design — plano de ação

Status: motor `0.2` e fluxo de edição entregues para cenas contínuas, incluindo grid 3×3, câmera, keyframes, entradas/saídas deslizantes, texto letra a letra, fundos de vídeo em loop, transição slide com blur, balanço leve de câmera, imagens, vídeos, overlays, captions, música e SFX. O contrato `0.1` continua compatível. A biblioteca de backgrounds já começou a ser preenchida; efeitos sonoros, músicas e arquivos numerados ainda dependem de etapas posteriores.

## Objetivo

Criar cenas contínuas em que o fundo permanece, enquanto PNGs, textos e outros objetos entram, saem, mudam de posição e a câmera virtual passeia pelo mesmo espaço. A edição deve acompanhar a narração final timestampada, sem exigir um corte de cena para cada novo personagem.

## Decisões de contrato

- Manter `0.1` intacto e renderizável; `0.2` acrescenta composição contínua sem misturar versões no mesmo JSON.
- Uma `scene` representa uma composição contínua; `background` é persistente durante toda a cena. `elements` possuem intervalos e animações independentes. `camera` transforma a composição visual inteira, não o áudio.
- Coordenadas normalizadas de composição (`x` e `y` em 0–1), `scale` adimensional, `rotation` em graus, `opacity` em 0–1; `t` em segundos relativos ao início da cena. Âncoras, ordem das transformações e limites estão definidos em [MOTION_DESIGN_JSON.md](MOTION_DESIGN_JSON.md).
- Keyframes de posição, escala, rotação e opacidade, com easing explícito. Atributos omitidos herdam o valor anterior. Interpolação determinística e igual em render final.
- Elementos conservam `asset`, `text`, `start`, `end` e `z` do contrato atual, mas recebem `id`, `transform` inicial e `keyframes`. Presets de movimento são atalhos e prevalecem na entrada/saída se também houver keyframes da mesma propriedade.
- Usar tempos da narração **final**, depois de `audio.sourceCuts`. Timestamps por palavra podem guiar entradas de texto; não inferir alinhamento inexistente.
- Assets seguem os URIs existentes (`project://`, `builtin://`, profiles). PNG com transparência é o caso prioritário; preservar proporção, canal alfa e safe area.

## Etapas e critérios de aceite

1. **Contrato e exemplos — entregue.** Schema `0.2` separado, parser com validação de keyframes, grid e exemplos; `0.1` preservado.
2. **Protótipo visual — entregue por testes de render.** Fundo persistente, dois PNGs com entradas em momentos diferentes, câmera e texto. Verificações automatizadas cobrem render e tempos; revisão estética com assets reais ainda depende dos arquivos escolhidos pelo usuário.
3. **Motor de animação — entregue.** Keyframes, easing, transformações, ordem de camadas, câmera global, grid 3×3 com oversize, vídeo e overlay; áudio e cenas `0.1` preservados. O render por frames usa CPU e pode ser lento em cenas longas/alta resolução.
4. **Interface — entregue para o caso comum.** Formulário cria cena com dois personagens no grid, atraso e escala; o editor JSON permite controle fino, validação e render final. Uma timeline visual de keyframes com arraste não faz parte desta entrega.
5. **Documentação e skills — entregue.** [Referência do JSON motion](MOTION_DESIGN_JSON.md), schema, [storyboard](examples/motion-storyboard-v0.2.json), skill genérica do projeto e skill específica do usuário atualizados. A escolha/importação de mídia recorrente fica para a etapa posterior solicitada pelo usuário.

## Regras editoriais

Motion design serve à ideia narrada; não animar toda palavra por padrão. Uma composição contínua deve ajudar a comparar, revelar ou conectar conceitos/personagens. Evitar movimento de câmera sem propósito, excesso de camadas e fundos inadequados ao contraste. Respeitar direitos de uso de imagens/personagens fornecidos pelo usuário.

Veja [o exemplo de JSON](examples/motion-design-proposal.v0.2.json). Ele requer os arquivos de mídia e narração citados para renderizar.
