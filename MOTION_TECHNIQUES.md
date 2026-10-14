# Repertório oficial de técnicas de motion design (TSX)

> Revisão técnica: 13/10/2026. Este catálogo descreve **o que o motor realmente faz** e o que somente pode ser construído dentro de `custom-scenes/*.tsx`. Uma técnica aparecer no repertório **não** a torna automaticamente disponível como `transitionOut` ou tipo novo do JSON.

## Matriz de capacidade

| Técnica | Nativo no JSON/renderizador | Disponível via TSX Remotion | Situação / ação |
| --- | --- | --- | --- |
| Tipografia cinética | `kinetic_text`, `text`, `caption`, estilos de word stack/stream | Sim, glyphs stagger, travelling e máscaras | **Existente**; variar composição sem perder leitura |
| Shape morphing | Não há preset `shape_morph` no schema | Sim, interpolação de contornos SVG com topologia compatível | **Receita incorporada** no toolkit |
| Stroke draw | Não há primitiva declarativa | Sim, `strokeDasharray` + `strokeDashoffset` | **Já em TSX**; receita incorporada |
| Spring physics | Apenas `pop_in` estilizado, não física configurável | `spring()`/trajetória amortecida por frame | **Receita incorporada**; amortecimento, tempo de assentamento e hold |
| Liquid shapes | Não nativo | SVG deformado deterministicamente; união real de blobs requer geometria/filtro específico | **Receita de blobs deformáveis**, não afirmar simulação física |
| Partículas | Não nativo | Arrays seedados/SVG/DOM sincronizados por frame | **Receita incorporada**, evitar `Math.random()` no render |
| Data visualization | Não há gráfico tipado no schema do vídeo | SVG bars, counters, sparklines a partir de dados fornecidos | **Receita de barras/counters**; usar quando há dado verificável |
| Parallax e 3D | Câmera 2D/scale; não oferece geometria 3D real | CSS perspective, planos PNG/SVG separados, translateZ/rotateY | **2.5D**; 3D real só com solução dedicada verificada |
| Glitch | Footage, overlay e SFX podem usar material glitch | Cortes de bandas, deslocamento cromático calculado por frame | **Receita incorporada**, usar com parcimônia |
| Mask reveal | `center_reveal`, `center_close` | `clipPath`, máscara SVG, paths animados | **Existente / receita mais ampla** |
| Motion blur | `blur_left/right/up/down` em composição final | Ecos e blur orientado pela velocidade | **Existente / aproximação demonstrada**; não confundir com optical flow |
| Transições slide | `slide_left`; outros sentidos não estão no contrato do JSON | Sim, composição A → B no mesmo TSX | **Preset TSX** fornecido |
| Transições whip | Não declarativo no contrato atual | Slide acelerado + blur no TSX | **Preset TSX** fornecido |
| Transições flip | Não declarativo no contrato atual | `perspective` + `rotateY` em um palco TSX | **Preset TSX** fornecido como 2.5D |
| Transições zoom | Não declarativo no contrato atual | Escala de saída/entrada com blend controlado | **Preset TSX** fornecido |
| Transições cortina | Não declarativo no contrato atual | `clipPath: inset(...)`/máscara de painel | **Preset TSX** fornecido |

## Exemplo reutilizável, instalado no repositório

Arquivo: [`examples/custom-scenes/MotionDesignToolkit.tsx`](examples/custom-scenes/MotionDesignToolkit.tsx).

- Exporta **default** `MotionDesignToolkit`; não requer biblioteca fora das dependências já declaradas pelo Remotion do ContentLab.
- Propriedade `variant`: `kinetic_typography`, `shape_morph`, `stroke_draw`, `spring_physics`, `liquid_shapes`, `particles`, `data_vis`, `parallax_25d`, `glitch`, `mask_reveal`, `motion_blur`, `transition_slide`, `transition_whip`, `transition_flip`, `transition_zoom`, `transition_curtain`.
- Propriedades opcionais: `title`, `nextTitle`, `values`, `color`, `background`.
- Copiar o TSX para a pasta **do projeto** `custom-scenes/`. Exemplos não são carregados automaticamente por todos os projetos.
- Referenciar pelo contrato existente (sem alterar schema):

```json
{
  "customComponent": {
    "module": "project://custom-scenes/MotionDesignToolkit.tsx",
    "mode": "replace",
    "props": {
      "variant": "shape_morph",
      "title": "UMA REGRA",
      "color": "#F22932"
    },
    "assets": {}
  }
}
```

**Importante:** esse JSON é um fragmento; o arquivo TSX tem de estar na pasta local do projeto, o `edit_plan.json` mantém `start/end`, áudio e SFX e a narração determina a duração. As variantes `transition_*` exibem uma passagem **dentro da mesma cena TSX**; **não** são novos valores válidos de `scene.transitionOut`. Para usá-las como transições entre cenas separadas é preciso expandir schema, validador e compositor com testes completos.

## Direção obrigatória para próximos TSX

1. **Escolha contextual**, não bingo visual: considerar as técnicas pertinentes ao argumento antes de optar pelo primeiro `slide_left` ou `fade`; preservar cenas estáticas quando o peso narrativo pedir.
2. **Continuidade entre estados:** quando possível, o elemento que sai deve fornecer cor, forma, movimento, máscara ou hierarquia ao que entra. Uma sucessão de presets sem relação não é motion fluido.
3. **Relógio local:** `t = useCurrentFrame()/fps`, keyframes relativos à cena. Qualquer duração real é derivada de `durationInFrames/fps`, sem `setTimeout`, `Date.now`, CSS keyframes ou RNG não seedado.
4. **Sincronismo com voz:** entrada concluída até o fim da palavra-chave e preferencialmente antes de seu começo, sem spoilers; hold para leitura; saída preparada para a informação seguinte.
5. **SFX alinhado a eventos:** manter mapa externo de movimentos, `sfx.at` absolutos, volumes/fades e verificação auditiva; não adicionar áudio no TSX desnecessariamente.
6. **Assets e profundidade:** fotos/vídeos planos não viram camadas 3D reais; usar PNGs separados, painéis gráficos ou máscaras verificadas.
7. **Dados honestos:** gráficos precisam de valores fornecidos pelo projeto. Dados de exemplo do toolkit **não devem** aparecer como números reais de um roteiro.
8. **QA:** amostrar frames de entrada, meio, chegada, fim de fala, hold e saída; verificar clipping, legibilidade, artefatos de SVG, coerência e ausência de saltos. Só chamar de aprovado após render real.

## Limites de implementação

Atualmente `server/plan.mjs` reconhece apenas `cut`, `fade`, `blur_left`, `blur_right`, `blur_up`, `blur_down` e `slide_left`. Não escrever valores novos no `transitionOut` sem implementação e teste do compositor. As receitas TSX são **exemplos de código reutilizáveis**, não efeito já disponível na UI por clique, nem garantia de render final sem testes de cada projeto.

## Evolução do renderizador (engenharia)

Para incorporar os novos nomes no JSON, implementar em conjunto: schema (enum), validador, compositor FFmpeg, preview com paridade, cache e teste visual de primeiro/último frame. Priorizar `slide_right/up/down`, `curtain`, `whip`, `zoom` e `flip`, sempre garantindo que o último frame da transição já seja exatamente o primeiro estado visível da cena seguinte.
