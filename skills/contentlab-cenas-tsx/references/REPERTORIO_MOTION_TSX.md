# Repertório de motion design espacial — TSX / Remotion

Guia técnico e criativo complementar a `contentlab-cenas-tsx/SKILL.md`, `contentlab-motion/SKILL.md`, `contentlab-timeline-audio/SKILL.md` e ao schema atual. Técnicas abaixo são exemplos, não presets obrigatórios. O ContentLab não promete reconstrução 3D automática, separação semântica automática de vídeos ou bibliotecas não instaladas.

## 1. Exemplos que já existem no Diazverso
Os arquivos ficam no próprio vídeo `VD_0005/custom-scenes/`, não na pasta global de presets. O `edit_plan.json` foi ampliado posteriormente; a contagem de cenas e componentes deve ser lida do plano canônico, não presumida a partir deste exemplo:
- **PerguntaAbertura.tsx**, cena `01_abertura_pergunta` (+0 a +3,68 s): palco horizontal de 7.000 unidades, câmera percorre palavras em pontos diferentes e chega ao personagem Batman. Entrada do PNG termina em +2,91 s, antes de a palavra “Batman” começar em +2,93 s.
- **ConflitoCentral.tsx**, cena `05_conflito_texto` (99,96–106,19 s absolutos): uma rota SVG liga três argumentos com câmera que muda o foco; mídia de filme escurecida permanece na base.
- **OutraRazao.tsx**, cena `21_outra_razao` (534,9–537,483 s): frases ocupam posições distintas na tela e a rota as conecta. A entrada de “OUTRA RAZÃO” é programada para terminar antes de sua enunciação.
- **LegadoEmRede.tsx**, cena `21_legado_carrossel` (540,643–548,468 s): elementos ligados em rede, camera travelling e zoom da parte para o conjunto.
- **ArgumentosEmConflito.tsx**, cena `06_argumentos_estrelas`: vários beats na mesma composição com fundo animado de estrelas.
- **ConstelacaoFamilia.tsx** aparece em duas cenas com parâmetros/recortes de personagens diferentes.

Não reaproveitar texto, timing, assets de personagem nem roteiro desses exemplos automaticamente. Usá-los para estudar mecanismos e definir **novas coreografias**.

## 2. Timing: a animação termina na palavra, não começa nela
Para uma palavra `w` fornecida pela transcrição da narração preparada e uma cena com `scene.start`, calcular:
- `localStart = w.start - scene.start`;
- `localEnd = w.end - scene.start`;
- `enterEnd <= localEnd` (limite obrigatório);
- preferir `enterEnd <= localStart` quando isso não antecipa spoiler/informação;
- `holdEnd >= localEnd`, com respiro para leitura e contexto.

Se o beat se inicia no frame zero, o visual precisa estar legível no frame zero; não animar a partir de preroll negativo. Se a palavra for curta, encurtar a animação, usar corte direto ou agrupar frase: jamais atrasar a informação só para manter uma animação “bonita”. Em vídeo, imagem e destino de câmera, a regra vale para o instante em que o sujeito **já está identificável**.

Exemplo conceitual (não aplicar estes segundos indiscriminadamente):
```tsx
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

export default function ExemploFoco() {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
  // Se a palavra começa em 1.50 s, a posição já estará definida em 1.48 s.
  const x = interpolate(t, [1.08, 1.48], [900, 250], clamp);
  const y = interpolate(t, [1.08, 1.48], [100, 600], clamp);
  const opacity = interpolate(t, [1.08, 1.48], [0, 1], clamp);
  return <AbsoluteFill style={{background: '#101827', color: '#fff'}}>
    <div style={{position: 'absolute', left: x, top: y, opacity, fontSize: 100}}>IDEIA</div>
  </AbsoluteFill>;
}
```
Para uma câmera percorrendo o palco, transformar **um contêiner do mundo** em X/Y/scale e manter legenda/HUD fora do contêiner. `spring()` é válido se a conclusão de seu assentamento for medida e terminar a tempo. Não usar CSS keyframes/transition ou relógio de navegador.

## 3. Catálogo variado e propósito de narrativa

| Estratégia | Linguagem TSX | Quando usar |
| --- | --- | --- |
| Palco horizontal/vertical/diagonal | Grupos em coordenadas amplas + câmera comum | Percurso de uma pergunta até a resposta |
| Vídeo como placa em profundidade | `perspective(...)`, `rotateY`, `rotateX` contidos | Apresentar mídia como objeto editorial |
| Tipografia no espaço | Textos em posições e orientações diferentes, foco sequencial | Termos ligados por causa/consequência |
| Explosão e remontagem de planos | Peças SVG/DOM ou recortes PNG movem-se em Z/X/Y | Mostrar os elementos de um sistema |
| Parallax de fundo/meio/frente | Camadas independentes guiadas por driver de câmera | Criar percepção de profundidade |
| Uma pessoa, uma rede | Zoom em detalhe seguido de visão geral de nós | Relações/família/legado |
| Transição por molduras HQ | Câmera viaja por painéis, mantendo ordem narrativa | Evolução temporal ou contraposição |
| Mídias em galeria inclinada | Vários vídeos/imagens em planos distintos | Comparar versões/personagens |
| Caminho SVG | Linha desenhada + marcos revelados no tempo | Conectar evidências |
| Diagrama que se transforma | Um nó gera ramificações e depois síntese | Consequências e mudança de escala |
| Corte seco e hold | Composição estática limpa | Peso/clareza depois de motion denso |

Alterar **estrutura, câmera, hierarquia, ritmo e finalidade**, não só paleta ou direção do slide. Nenhuma cena é obrigada a conter movimento, e Nox só entra quando tiver função.

## 4. Dividir cena em camadas — versão realizável
Composição 2.5D de três a cinco planos:
1. **Fundo** (mídia ou desenho com área suficiente para mover).
2. **Meio** (personagem/objeto como PNG transparente ou máscara correta).
3. **Primeiro plano** (recortes, texto, grafismos).
4. **HUD** fixo fora da câmera, se necessário.

Planos independentes podem deslocar-se em intensidades distintas, abrir-se espacialmente, girar ligeiramente e recompor-se. Para tela em camadas use `transformStyle: 'preserve-3d'`, `perspective`, `translateZ`, controle de escala e oclusão; isso produz perspectiva simulada, **não 3D real**. Uma foto ou vídeo achatado não fornece automaticamente recortes independentes. Se não houver máscaras corretas, preparar assets verificáveis ou usar divisão em cartões retangulares propositalmente gráficos. Verificar recortes/halos/furos quando as partes se separam.

## 5. Vídeo deslocado e inclinado no espaço
Para um vídeo existente declarado em `customComponent.assets`, usar a mídia já suportada pelo projeto (nos TSX do VD_0005, `Video` de `@remotion/media`) dentro de painel/câmera; aplicar, por exemplo, `transform: 'perspective(1400px) rotateY(-12deg) rotateX(4deg)'`. Animar angles e posição **por frame**, em função do áudio. A mídia deve estar reconhecível e legível na pronúncia correspondente. Não exagerar ângulo, corte ou blur; conferir proporção e render final.

## 6. Checklist: código, contrato e QA
- O `edit_plan.json` canônico fica na raiz do vídeo; TSX fica no `custom-scenes/` desse mesmo vídeo, com `project://custom-scenes/Arquivo.tsx`.
- `mode: 'replace'` e `mode: 'overlay'` seguem as regras do motor; `props` e `assets` são os campos existentes. Não inventar novos campos de câmera/3D no JSON.
- Antes de renderizar, obter as âncoras temporais da **voz preparada**, não da leitura estimada do roteiro.
- Conferir frame zero, primeira sílaba, fim da palavra, hold, fim de cena, oclusão, safe area, vídeo/fontes/recortes.
- A entrada do termo/objeto tem de estar concluída até o fim da palavra e idealmente antes do começo; a câmera também já deve apontar para o foco.
- Testar TSX com MP4 real, não só JSON válido; verificar cache e vínculo de assets.
- Comparar com a cena anterior para detectar repetição cansativa. Deixar espaço para imagens originais da obra e respiro.


## 7. Novas técnicas e receitas reproduzíveis (13/10/2026)

Ver a [matriz de disponibilidade](../../../MOTION_TECHNIQUES.md) e o [toolkit TSX demonstrativo](../../../examples/custom-scenes/MotionDesignToolkit.tsx). Estão implementadas **no exemplo**, e não automaticamente no editor, dezesseis variantes parametrizáveis: cinética por letras, morph SVG de contornos equivalentes, desenho por `strokeDashoffset`, física com `spring`/quique amortecido, blob líquido deformável, partículas determinísticas, gráfico de barras/contador, 2.5D parallax, glitch em bandas, circular mask reveal, motion blur estilizado e passagens internas slide/whip/flip/zoom/cortina.

Checklist para reaproveitamento: escolher uma variante coerente com a fala; copiar TSX de `examples/` para `custom-scenes/` do vídeo; fornecer `title/nextTitle/values/color/background` relevantes; adaptar tempos ao trecho efetivo da narração; mapear SFX externo no JSON; validar compilação, frame zero/chegada/hold/fim; escutar MP4 renderizado. Não usar dados artificiais do exemplo em narração factual. Não inferir 3D físico de `perspective` CSS. Não registrar `transition_whip` etc no `transitionOut` sem ampliar motor/schema.
