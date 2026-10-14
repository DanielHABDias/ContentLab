---
name: contentlab-motion
description: Planeja coreografia de motion design no Content Lab: keyframes, easing, stagger, estados, movimento por frame, câmera e transições com continuidade.
---

# Content Lab — Movimento e coreografia

## Whip blur forte e riser completo — Diazverso Shorts (14/10/2026)

Para **Shorts Diazverso** especificamente, a duração recomendada do `blur_left/right/up/down` passou a ser `transitionDuration:0.20` segundo a 30 fps (6 frames). O compositor `server/compose.mjs` aplica um blur gaussiano anisotrópico **ao quadro inteiro**, com `sigma=56:sigmaV=22` para deslocamento horizontal e `22:56` para vertical, e peso máximo de 99,5% no centro do efeito. O arquivo do compositor recebeu nova assinatura de cache para invalidar frames de transições antigas. Nunca presumir que apenas alterar o JSON torna o blur mais forte: usar a versão mais recente do ContentLab e validar frames centrais do render.

Antes do primeiro whoosh, o `builtin://sfx/Riser metálico.mp3` deve tocar **inteiro**, não apenas 0,6 s. Na mixagem atual, `config.preserveFullSource:true` impede corte automático de início/fim e `config.alignEndAt:<tempo do whoosh>` calcula o começo a partir da duração real do arquivo (nesta biblioteca, cerca de 2,82 s). Não definir `config.duration` para limitar esse riser nem `fadeOut` artificial; o whoosh dispara já dentro da nova cena, tipicamente +0,02 s. Caso um arquivo seja maior do que o trecho disponível antes do whoosh, o motor sinaliza erro em vez de truncar. Música após a transição. Direção sonora específica, nunca padrão imposto em vídeo longo ou em GSB.



## Primeiro blur dos Shorts Diazverso — timing operacional (14/10/2026)

No compositor atual, `blur_left/right/up/down` estão implementadas: a transição usa o último frame da cena anterior e os primeiros frames da próxima, ocupando o **início da próxima cena**. A duração de partida ~0,4 s deve ser conferida no MP4 a 30 fps, e o Woosh inicia audivelmente durante `[nextScene.start,nextScene.start+transitionDuration)`, não antes da troca nem depois do movimento. Riser fica na saída do gancho, música só após o primeiro blur. O mecanismo completo exige verificação audiovisual; transição declarada no JSON não garante perceptibilidade.



## Motion Diazverso — padrão HQ contemporâneo consolidado (14/10/2026)

Com o perfil Diazverso, criar motion design moderno/cinematográfico com estruturas discretas de HQ: câmera recua do footage para revelar painéis em página 2.5D, viaja até outro painel cinza/dessaturado, esse quadro ganha cor ao ser focado e a câmera entra na próxima cena real. É **exemplo de coreografia**, não transição mandatória em todos os cortes. Manter gutters, retícula sutil, caixas retangulares de narração, Anton para palavra gigante/fundo colorido, Bangers para lettering; evitar balões de diálogo/pensamento e cartoon infantil. Em explicações, considerar TSX com frequência, desde que o filme, jogo ou personagem mencionado possa ser visto full screen ou no próprio painel. O áudio segue o contrato de movimentos com SFX iniciando audivelmente durante a animação. Shorts conservam explosão Minecraft 0–3s, riser pré-transição, blur + whoosh durante o movimento, música pós-blur e CTA; não estender vinheta a vídeos longos nem a marcas diferentes. VD_0005 permanece fechado.



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

## Motion refinado de interface, adaptado ao vídeo
Usar a fluidez observada no Studio como referência de acabamento, mas **renderizar por frame** no Content Lab/Remotion; a duração da fala e o tempo de leitura têm prioridade sobre o CSS do site.
- **Microinterações:** opacidade e deslocamento sutil, expansão de highlight, revelação por máscara, entrada de card com leve escala + elevação. Usar easing não linear controlado (`ease_out` no assentamento, `ease_in_out` nas transformações) ou spring bem amortecido **quando implementado em TSX**. Evitar bounce repetitivo, overshoot grande, jitter e zoom brusco.
- **Cadência de referência, não preset fixo:** aproximadamente 0,15–0,3 s para detalhe curto e 0,3–0,55 s para entrada/reorganização com foco; ajustar ao FPS, quantidade de informações, beats de voz e hold de leitura. Não alongar arbitrariamente 0,1 s para “parecer suave”.
- **Card premium em movimento:** entra junto à informação, acomoda sem tremor, permanece legível, depois se transforma ou sai por relação com o próximo foco. Se o texto secundário é cinza, ainda deve oferecer contraste suficiente no vídeo vertical.
- **Câmera:** movimentos suaves e pontuais que revelam relações, com trajetória e parada previsíveis. Camadas do mundo acompanham câmera, HUD/legenda fixos não; evitar parallax e depth decorativos.
- **Hierarquia de movimento:** apenas um foco principal em movimento por vez; staggering leve nos suportes e silêncio visual deliberado depois de picos. Uma interface premium não significa animar cada elemento.
- **Técnica:** presets declarativos só nos limites do renderer; para transformações sofisticadas usar `contentlab-cenas-tsx` com `useCurrentFrame`, `interpolate`, `spring` e inspeção de frames. Não usar CSS transition ou relógio real para determinar os frames do MP4.

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
Defina âncoras de fala/evento antes de coreografar. Movimentos não devem revelar uma resposta antes que a narração prepare o público, nem atrasar o entendimento depois da fala. SFX é obrigatório para movimentos/animações editoriais intencionais; cenas completamente estáticas e cortes secos não exigem um som artificial. Consultar a política detalhada abaixo.

## Coreografia procedural com TSX
Para uma trajetória animada única com vários beats, usar `contentlab-cenas-tsx`: ela cria um componente `export default` com quadro determinado por `useCurrentFrame` e `useVideoConfig`. Uma cena pode durar vários segundos e conter diversos momentos de tipografia, geometria e câmera sem divisões artificiais. Separar transformações dos objetos da câmera e de sobreposições fixas, sincronizar efeitos com narração, dar hold real e minimizar animações que não informam. Pedir ao ChatGPT o `.tsx` como arquivo e apenas o fragmento JSON para render, poupando tokens.

## Implementação e inspeção
Produção baseada em frames determinísticos e estado calculável para qualquer instante; sem relógio do sistema ou aleatoriedade sem seed. Compare frames antes, durante e depois do movimento, verificando trajetória, clipping e hold. Se o contrato atual não expuser alguma interpolação avançada, mantenha a intenção registrada como requisito de engenharia — não invente propriedades JSON.

## Sincronismo de conclusão e linguagem de espaço (aprendizado de produção)

A narração preparada define **quando cada objeto já está plenamente visível**, não simplesmente quando a animação inicia. Para cada palavra focal, anotar início/fim da fala, início da entrada, conclusão da entrada, hold e saída. **Invariante:** entrada concluída até o fim da palavra, preferencialmente até o começo; imagem/vídeo/diagrama seguem a mesma regra. Se a entrada levar mais tempo que a fala, diminuir duração ou começar antes sem revelar indevidamente a informação. Se a palavra ocorre no frame zero, o visual já deve estar no estado de leitura. O movimento entre dois destinos termina quando a voz nomeia o segundo destino.

Para TSX, considerar: texto distribuído em X/Y numa cena maior que a tela; câmera indo de uma palavra diagonal a outra abaixo; vídeo em perspectiva com `rotateY`/`rotateX` discretos; camadas de profundidade com parallax e oclusão; explosão e remontagem de painéis; zoom detalhe → relação geral; movimento de caminho SVG entre conceitos. Separar geometria do mundo da interface fixa; o mesmo driver temporal deve coordenar as camadas. Não presumir Three.js nem processamento 3D verdadeiro.

Usar `useCurrentFrame`, `useVideoConfig`, `interpolate` com clamp e `spring` moderado testado; nunca CSS animations/transitions nem relógio externo. Um efeito dominante por beat, com hold de leitura, e descanso após cenas densas. Conferir frames antes, durante e depois da palavra. Repertório: `contentlab-cenas-tsx/references/REPERTORIO_MOTION_TSX.md`.

## Política de sound design por movimento — obrigatória (outubro/2026)

**Toda cena que contenha movimento/animação editorial intencional deve receber cobertura sonora vinculada ao movimento**: entrada/saída animada, pop, zoom, travelling de câmera, painel/objeto que desloca, transição com movimento, tipografia kinetic, máscara, separação de camadas, rotação 2.5D. Em uma mesma cena TSX, identificar os vários eventos relevantes; um SFX pode cobrir movimento contínuo coerente, não é necessário um sample para cada keyframe. Animação ambiente em loop sem ação editorial pode usar textura ambiente existente, desde que a decisão seja explícita e o revisor consiga verificar cobertura coerente. Cena 100% estática e corte seco não exigem SFX artificial.

**Timing:** o disparo *audível* do SFX ocorre DENTRO do intervalo real da animação [movimentoInicio,movimentoFim], nunca antes de começar nem somente depois de acabar. O corpo/ataque audível deve coincidir perceptualmente com a ação (impulso, passagem, chegada, impacto). A duração do efeito pode ser menor ou maior que a animação: NÃO esticar áudio, NÃO estender animação por conveniência, NÃO atrasar disparo para “encaixar a cauda”. Se for excessivamente longo ou invadir o próximo beat, limitar `config.duration` e suavizar com `fadeOut` (valores reais do schema/mixer), de modo a evitar corte abrupto. Cauda suave depois do movimento é possível; início e evento perceptível precisam ocorrer durante o movimento. Caso o SFX tenha silêncio inicial, o ContentLab detecta/apara as bordas; alinhar pelo *início audível* no MP4, não pelo waveform bruto.

**Variedade obrigatória:** alternar famílias por função — whoosh leve/aireado/cinemático para deslocamento, pop/snap/click para surgimento e ações curtas, swish de painel/page flip para passagem, riser para tensão em transformação, glitch para ruptura digital, hit/impact para assentamento forte, ticks suaves para desenho/diagramas. Não usar `Whoosh 01` em todos os movimentos; inspecionar repetições consecutivas e adequação ao conteúdo. Voz inteligível tem precedência sobre ganho do SFX. Se clipe/CTA contém efeito audível exatamente sincronizado, contar esse áudio existente e **não duplicar**.

**Saída para a timeline:** entregar por evento: `scene.id`, `movementStart`/ `movementEnd` absolutos, função, asset SFX verificado, `at` absoluto dentro da janela, duração do trecho audível, fade quando preciso, ganho, e método de escuta/validação. Para TSX, derivar movimento de `useCurrentFrame()/fps + scene.start`. Revisão bloqueia movimento editorial sem áudio correspondente, início audível fora da janela, efeitos sempre iguais sem intenção ou corte áspero. Acionar `contentlab-revisao` antes do plano automático e depois do render.


## Repertório ampliado de motion design (13/10/2026)

**Consulta obrigatória para novas coreografias:** [`MOTION_TECHNIQUES.md`](../../MOTION_TECHNIQUES.md) e [`MotionDesignToolkit.tsx`](../../examples/custom-scenes/MotionDesignToolkit.tsx). Antes de repetir fade/slide, avaliar adequação de tipografia cinética, shape morphing, stroke draw, spring physics, liquid shapes, partículas, data visualization, parallax 2.5D, glitch, mask reveal, motion blur e transições slide/whip/flip/zoom/cortina.

Marcar técnica como **nativa no JSON**, **programável em TSX** ou **não disponível**; não prometer que um efeito TSX existe como valor `transitionOut`. As variantes de transição do toolkit ocorrem dentro de uma única cena TSX. É preciso implementar contrato + compositor + testes para estendê-las ao JSON. Não adicionar efeitos como checklist mecânico: escolher a mecânica que esclarece a fala e mantém ligação visual entre antes e depois. Planejar entrada, transformação, hold, saída, som e checkpoints para cada beat.
