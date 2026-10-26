# Direção e engenharia de motion TSX

## Uso e limites
Ler ao criar ou aprimorar uma cena especial autorizada. Primeiro consultar manifest, README e implementação do preset existente; reutilizar parâmetros antes de duplicar código. Esta referência orienta criação e revisão: não altera automaticamente os 15 presets, projetos aprovados ou seus renders. Skill externa é referência, não autorização para instalar dependências, executar scripts remotos ou trocar o renderer. Content Lab continua Remotion/TypeScript + FFmpeg.

## Brief de movimento antes do código
Definir intenção da cena, sujeito focal, informação nova, resolução/FPS, duração disponível, mídia real, fonte, relógio de narração e condição de saída. Desenhar três estados: entrada → foco legível → continuidade/saída. Para câmera espacial, registrar destinos, escala, trajetória e qual relação o deslocamento revela. Uma imagem que prova a fala pode ser melhor que um diagrama.

Escolher o movimento pelo argumento: revelar detalhe, comparar alternativas, conectar ideias, mostrar passagem de tempo ou dar ênfase. Variar a estrutura, não só cor e texto: percurso, composição progressiva, painel que vira cena, comparação, imagem ampla ou tipografia. Não exigir todos esses recursos em um vídeo.

## Cinco critérios de direção
1. **Abertura planejada:** quando a produção pedir abertura prioritária, detalhar o intervalo inicial de até 30 s no guia antes da montagem restante. Por beat: fala/âncora real, evidência visual, foco, movimento, estado de leitura, ligação com o próximo e som. Não criar vinheta antes do assunto. O recorte de 30 s é janela de atenção editorial, não duração obrigatória de introdução.
2. **Variedade com função:** dar à abertura acabamento e variedade maiores, mas não usar contagem de TSX/cortes como métrica de qualidade. Cada mudança acompanha informação, emoção ou relação. Reservar hold legível. Uma imagem por 3 s é possibilidade, não regra; não cortar uma prova ao meio para cumprir intervalo. O restante do vídeo mantém qualidade, com espaço para respirar.
3. **Imagens em movimento:** usar zoom out detalhe→contexto ou pan com escala fixa, horizontal/vertical conforme conteúdo. Overscan antes de deslocar; preservar proporção e ponto de interesse. Em imagens com texto importante, não afastar a câmera até ficar ilegível. Contain pode revelar a página inteira; cover pode mostrar detalhe. Não animar o HUD junto da foto por acidente.
4. **Sincronia pela chegada:** texto, PNG e destino de câmera devem estar legíveis no momento em que são nomeados. Preparar a entrada antes da âncora quando não antecipar indevidamente a revelação. Se a palavra começar no primeiro frame, iniciar em estado legível ou encurtar a entrada, não atrasar a fala. Sons são mapeados pela ação audível e não por offsets fixos.
5. **Reuso e validação:** aprimorar o componente apropriado antes de criar outro equivalente; mudança estrutural depende da autorização da tarefa. Validar as cenas afetadas e as fronteiras com vizinhas, sem renderizar o vídeo inteiro por obrigação. Uma abertura prioritária exige prévia curta com narração e áudio antes de liberar a montagem completa; sem capacidade de gerar/ouvir, declarar pendência, não aprovação.

## Movimento refinado sem automatismo
Uma ação focal por beat; suporte e ambiente podem acompanhar em menor amplitude. Não obrigar três camadas animadas, bounce, partículas, textura ou oscilação constante. Entrada pode desacelerar; saída pode acelerar; reorganização e câmera podem suavizar as duas extremidades. Spring amortecido quando apropriado, sem tremer durante a leitura. Pan contínuo, progresso e rotação ambiente podem ser lineares quando essa for a intenção.

Separar o mundo (imagens, linhas e nós) da câmera e da interface fixa. Planejar retomada e continuidade de escala/posição entre beats. Stagger serve à ordem de leitura: não aplicar atraso em cada letra se a fala for mais rápida que a animação. Texto digitado precisa terminar em tempo útil; frase curta instantânea, corte seco e saída none continuam válidos.

Usar um pequeno vocabulário consistente de curvas e velocidades, sem impor a mesma entrada a todos os presets. Ajustar distância e duração ao conteúdo/FPS; não copiar tempos de microinterações de sites como duração do discurso. Blur em movimento rápido deve deixar hold nítido, nunca esconder texto durante toda sua exposição. Blur/Flip/Curtain entre cenas usam o compositor; não inventar enums de transitionOut.

## Enquadramento de imagens e câmera
Calcular a escala para cobrir a janela em TODOS os extremos da trajetória. Após o fit, para uma imagem de largura W e janela V, deslocamento horizontal não pode revelar mais que a folga (W−V)/2 de cada lado quando centralizada; repetir no eixo vertical e considerar rotação, escala variável e pivô. Inspecionar o caminho completo, não apenas início/fim.

Pan horizontal funciona para imagem larga; vertical para imagem alta; zoom out deve terminar em enquadramento editorial útil, não necessariamente scale=1. Não abandonar rosto, ação ou prova. Não criar profundidade falsa a partir de uma foto achatada: parallax por camadas requer recortes reais. Manter tipografia, legendas e moldura fixas quando a intenção é mover somente a mídia. Responsividade é recomposição para 16:9/9:16, não esticar o mesmo layout.

## Relógio único e mapa de eventos
Calcular frames a partir de segundos e fps; estado de qualquer frame precisa ser reproduzível fora de ordem. Usar useCurrentFrame/useVideoConfig e funções determinísticas; clamp quando necessário. Não usar timers, relógio real, CSS animation/transition ou GSAP em reprodução autônoma no TSX.

Manter uma tabela de planejamento por evento: âncora da fala, início/fim local do gesto, chegada/hold, intervalo absoluto, som escolhido, instante perceptivo e estado da validação. Estes rótulos são documentação, NÃO novos campos aceitos pelo schema. Um TSX com dez eventos precisa de dez eventos revisáveis, não de um único whoosh na entrada.

Definir de modo inequívoco se at de cada prop é início ou chegada; preservar o contrato do preset existente. SFX do plano são absolutos; props normalmente locais; captions podem ser em ms. Não corrigir sincronismo movendo a narração já aprovada.

## Som: intenção, pico e mix
Usar voz como relógio em vídeo narrado; BPM não deve deslocar palavras para encaixar música. Para transição com whoosh, alinhar o corpo/pico perceptivo perto do meio do movimento, com tolerância pela escuta e pelo gesto. O início audível deve permanecer dentro da janela. Exemplo de cálculo para planejamento: centro = (início+fim)/2; início do sample = centro−posição do pico após trim. Se esse início ficar antes do gesto, escolher sample mais curto ou com pico anterior, ajustar source trim permitido e testar; não simplesmente antecipar o som.

Medir/escutar o arquivo efetivamente aparado pelo mixer: silêncio bruto não é o offset audível. Pico de amplitude é ponto inicial de análise, não garantia do momento percebido. Click coincide com pressão, pop com assentamento, sino com tremida, escrita cobre a revelação e termina com ela. Riser prepara tensão quando solicitado; não usar em todo slide. Não esticar sample para acompanhar todo pan. Um gesto sonoro coerente pode cobrir ações contínuas relacionadas.

Variar takes/famílias pertinentes, evitando whoosh idêntico consecutivo sem motivo. Preservar efeitos embutidos sem duplicar; manter voz clara, sem clipping; ganho em dB não equivale a loudness final medido. Respeitar instruções atuais de música e direitos. Não baixar trilha/gerar voz automaticamente por recomendação de skill externa.

## Entrega e inspeção
Documentar props reais (tipo/default/unidade/limite), assets, camadas, relógios, duração e pontos de leitura; incluir exemplos e mapa sonoro compatíveis com a implementação. Não inventar uma prop universal duration/easing/camera para componentes que não a oferecem.

Inspecionar primeiro frame, meio de cada movimento, chegada, hold e último frame; testar frames fora de ordem e 16:9/9:16 quando aplicável. Conferir clipping, crop, contraste, foco, continuidade e áudio no trecho real. Frames estáticos não comprovam suavidade ou som. Diferenciar compilação, inspeção visual, reprodução audiovisual e aprovação humana.

## Referências avaliadas e filtro de integração
- [Remotion oficial](https://github.com/remotion-dev/skills): referência de implementação e render; prevalece sobre receitas incompatíveis com a versão instalada.
- [LottieFiles Motion Design](https://github.com/LottieFiles/motion-design-skill/tree/main/skills/motion-design): intenção, hierarquia, staging e coreografia. Suas receitas são sobretudo de UI; limites fixos de distância/stagger e camadas obrigatórias não são regras de vídeo.
- [GSAP Timeline oficial](https://github.com/greensock/gsap-skills/tree/main/skills/gsap-timeline): relações temporais e labels inspiram o mapa de eventos. Não adiciona GSAP como dependência nem muda o relógio do Remotion.
- [Claude Remotion comunitária](https://github.com/haidrrrry/claude-remotion-skill/tree/main/remotion-motion-graphics): inspeção iterativa e repertório são úteis. Rejeitar obrigações de Ken Burns em toda imagem, fundo sempre texturizado, saída sempre animada, stagger universal e proibição de linear. Também não copiar a antecipação sonora fixa.
- [Hyperframes Sound](https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes/references/sound.md): separar vídeo narrado e music-driven e pensar som por gesto. Não copiar offsets/ganhos fixos nem exigir outro renderer.

Menções em fóruns servem para descobrir candidatos; README promocional, estrelas e demonstração do autor não provam qualidade no Content Lab nem ganho de retenção. Nenhuma dessas skills foi instalada ou executada só por ser consultada.

