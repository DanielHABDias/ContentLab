# Motion design — plano de ação

Status: proposta de contrato; **não implementado**. O editor atual aceita apenas o contrato `0.1`. O JSON de motion design descrito aqui é uma proposta `0.2` e não deve ser enviado ao botão **Validar JSON** ou ao renderizador atual.

## Objetivo

Criar cenas contínuas em que o fundo permanece, enquanto PNGs, textos e outros objetos entram, saem, mudam de posição e a câmera virtual passeia pelo mesmo espaço. A edição deve acompanhar a narração final timestampada, sem exigir um corte de cena para cada novo personagem. Exemplo Diazverso: um personagem aparece sobre um fundo; a câmera se move para revelar outro; depois chega ao Homem de Ferro, ainda no mesmo fundo.

## Decisões de contrato

- Manter `0.1` intacto e renderizável. Criar `0.2` apenas quando parser, validação, preview e render suportarem o conjunto mínimo.
- Uma `scene` representa uma composição contínua; `background` é persistente durante toda a cena. `elements` possuem intervalos e animações independentes. `camera` transforma a composição visual inteira, não o áudio.
- Coordenadas normalizadas de composição (`x` e `y` em 0–1), `scale` adimensional, `rotation` em graus, `opacity` em 0–1; `t` em segundos relativos ao início da cena. Definir origem, âncoras, ordem de transformações e comportamento fora de 0–1 antes de implementar.
- Keyframes de posição, escala, rotação e opacidade, com easing explícito. Atributos omitidos herdam o valor anterior. Interpolação determinística e igual em preview e render final.
- Elementos conservam `asset`, `text`, `start`, `end` e `z` do contrato atual, mas recebem `id`, `transform` inicial e `keyframes`. Movimentos pré-definidos continuam disponíveis como atalho; não devem conflitar com keyframes da mesma propriedade.
- Usar tempos da narração **final**, depois de `audio.sourceCuts`. Timestamps por palavra podem guiar entradas de texto; não inferir alinhamento inexistente.
- Assets seguem os URIs existentes (`project://`, `builtin://`, profiles). PNG com transparência é o caso prioritário; preservar proporção, canal alfa e safe area.

## Etapas e critérios de aceite

1. **Contrato e exemplos.** Fechar semântica do JSON `0.2`, criar schema e exemplos válidos de cena contínua, e definir migração de `0.1`. Aceite: exemplos aprovados editorialmente e rejeição clara de campos/tempos inválidos.
2. **Protótipo visual.** Produzir um trecho de 10–15 s com fundo persistente, dois PNGs, texto sincronizado e câmera que revela o segundo personagem. Comparar FFmpeg atual com um motor dedicado apenas se os requisitos de qualidade/preview exigirem. Aceite: sem cortes involuntários, sem bordas vazias e com leitura boa em preview e exportação.
3. **Motor de animação.** Implementar keyframes, easing, transformações, ordem de camadas e câmera global; manter áudio e cenas `0.1` funcionando. Aceite: resultado determinístico, sincronia com narração final e testes de continuidade, alfa, resolução e FPS.
4. **Interface.** Exibir a cena contínua e seus elementos/câmera de modo editável; oferecer presets simples e prévia. Aceite: usuário consegue carregar, ajustar, validar, salvar e renderizar o plano sem editar keyframes à mão para o caso comum.
5. **Documentação e skills.** Atualizar referência, guia, exemplos e skills para distinguir capacidade planejada de implementada. Aceite: nenhum exemplo `0.2` é anunciado como executável antes de passar pela validação real; após entrega, ambas as skills sabem gerar JSON válido na versão suportada.

## Regras editoriais

Motion design serve à ideia narrada; não animar toda palavra por padrão. Uma composição contínua deve ajudar a comparar, revelar ou conectar conceitos/personagens. Evitar movimento de câmera sem propósito, excesso de camadas e fundos inadequados ao contraste. Respeitar direitos de uso de imagens/personagens fornecidos pelo usuário.

Veja [a proposta de JSON](examples/motion-design-proposal.v0.2.json). Ela é **ilustrativa e ainda não executável**.
