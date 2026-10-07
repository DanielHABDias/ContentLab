# Motion design — plano de ação

Status: primeira implementação `0.2` disponível para cenas com imagens estáticas, PNG transparente, texto e SFX. O contrato `0.1` continua compatível. Vídeos dentro da composição, legendas cinéticas e editor visual de keyframes ficam para as próximas etapas.

## Objetivo

Criar cenas contínuas em que o fundo permanece, enquanto PNGs, textos e outros objetos entram, saem, mudam de posição e a câmera virtual passeia pelo mesmo espaço. A edição deve acompanhar a narração final timestampada, sem exigir um corte de cena para cada novo personagem.

## Decisões de contrato

- Manter `0.1` intacto e renderizável. O `0.2` inicial tem escopo deliberadamente menor: imagens estáticas, texto e SFX.
- Uma `scene` representa uma composição contínua; `background` é persistente durante toda a cena. `elements` possuem intervalos e animações independentes. `camera` transforma a composição visual inteira, não o áudio.
- Coordenadas normalizadas de composição (`x` e `y` em 0–1), `scale` adimensional, `rotation` em graus, `opacity` em 0–1; `t` em segundos relativos ao início da cena. Definir origem, âncoras, ordem de transformações e comportamento fora de 0–1 antes de implementar.
- Keyframes de posição, escala, rotação e opacidade, com easing explícito. Atributos omitidos herdam o valor anterior. Interpolação determinística e igual em preview e render final.
- Elementos conservam `asset`, `text`, `start`, `end` e `z` do contrato atual, mas recebem `id`, `transform` inicial e `keyframes`. Movimentos pré-definidos continuam disponíveis como atalho; não devem conflitar com keyframes da mesma propriedade.
- Usar tempos da narração **final**, depois de `audio.sourceCuts`. Timestamps por palavra podem guiar entradas de texto; não inferir alinhamento inexistente.
- Assets seguem os URIs existentes (`project://`, `builtin://`, profiles). PNG com transparência é o caso prioritário; preservar proporção, canal alfa e safe area.

## Etapas e critérios de aceite

1. **Contrato e exemplos.** Schema `0.2` separado, parser com validação de keyframes e exemplo de cena contínua. Aceite: tempos inválidos rejeitados; `0.1` preservado. **Implementado inicialmente.**
2. **Protótipo visual.** Produzir um trecho de 10–15 s com fundo persistente, dois PNGs, texto sincronizado e câmera que revela o segundo personagem. Comparar FFmpeg atual com um motor dedicado apenas se os requisitos de qualidade/preview exigirem. Aceite: sem cortes involuntários, sem bordas vazias e com leitura boa em preview e exportação.
3. **Motor de animação.** Implementar keyframes, easing, transformações, ordem de camadas e câmera global; manter áudio e cenas `0.1` funcionando. Aceite: resultado determinístico, sincronia com narração final e testes de continuidade, alfa, resolução e FPS. **Primeiro corte implementado para imagem e texto; ampliar para vídeo, presets e desempenho.**
4. **Interface.** Exibir a cena contínua e seus elementos/câmera de modo editável; oferecer presets simples e prévia. Aceite: usuário consegue carregar, ajustar, validar, salvar e renderizar o plano sem editar keyframes à mão para o caso comum.
5. **Documentação e skills.** Atualizar referência, guia, exemplos e skills para distinguir capacidade implementada de próximos passos. Aceite: exemplos passam pela validação real quando os assets estão presentes; skills refletem o suporte efetivo.

## Regras editoriais

Motion design serve à ideia narrada; não animar toda palavra por padrão. Uma composição contínua deve ajudar a comparar, revelar ou conectar conceitos/personagens. Evitar movimento de câmera sem propósito, excesso de camadas e fundos inadequados ao contraste. Respeitar direitos de uso de imagens/personagens fornecidos pelo usuário.

Veja [o exemplo de JSON](examples/motion-design-proposal.v0.2.json). Ele requer os arquivos de mídia e narração citados para renderizar.
