# Carrossel de Frases HQ

## Movimento e contrato de execução

at continua significando chegada ao centro; não é o começo do movimento. O desenho considera apenas a janela próxima de frases. Medidas permanecem estáveis durante a animação. A faixa e os três níveis foram preservados.

Instalação manual: copiar **CarrosselFrasesHQ.tsx** e **HQComicPage.tsx** para a mesma pasta custom-scenes. A Galeria prepara esses arquivos automaticamente, sem sobrescrever versões diferentes. Auxiliares idênticos são compartilhados uma única vez no projeto. Todos os sons continuam no plano; não há áudio automático. Anton sem sombra/contorno; Bangers mantém acabamento HQ.

Enumeração vertical de frases, com três níveis visuais: **próxima**, **atual** e **anterior**. Responsivo a 16:9 e 9:16. Útil para argumentos sucessivos, listas faladas e contrastes. Não é digitação, legenda automática ou lista que gira infinitamente.

## O que aparece e como se move

A próxima frase espera menor, cinza e semitransparente no terço superior. Ela fica alinhada verticalmente para baixo, perto do limite entre os terços. Quando chega sua vez, desce e cresce até o centro do terço central, recuperando a cor e a opacidade. A frase anterior desce para o terço inferior, alinhada para cima junto ao limite entre os terços, menor e apagada. Na troca seguinte, ela sai por baixo e desaparece; uma nova frase entra no alto. Não se desenha um grid visível.

As frases alinham à esquerda por padrão, ou à direita se solicitado. As escalas se apoiam nessa mesma borda: não centralizam o texto involuntariamente. O texto é sempre maiúsculo, ajustado para até duas linhas sem cortar palavras. Prefira frases curtas: textos enormes podem ficar pequenos ou ser recusados se exigirem mais de duas linhas. Há uma faixa cinza translúcida fixa atrás da frase central, sem borda ou sombra. As frases superior e inferior continuam sem faixa. Não há título extra, moldura, caixa ou imagem obrigatória.

Na última frase, não existe texto novo no alto. A anterior permanece embaixo até terminar a cena; a atual fica no meio. Não há saída geral nem retorno ao primeiro item. Uma lista com um item também funciona.

## Instalação

Copie `CarrosselFrasesHQ.tsx` para `custom-scenes/` do projeto. O arquivo inclui os fundos procedurais e usa HQComicPage.tsx para a página transparente; copie também esse auxiliar. Requer o runtime React/Remotion/@remotion/fonts já usado pelo Content Lab. Declare a fonte em **customComponent.assets**, fora de props:

- Bangers: `bangers: "builtin://fonts/Bangers-Regular.ttf"`.
- Anton: `anton: "builtin://fonts/Anton-Regular.ttf"`.

Use module `project://custom-scenes/CarrosselFrasesHQ.tsx`. Anton é texto puro, sem sombra nem contorno. Bangers usa sombra/contorno escuros. Não há fonte embutida ou fallback silencioso.

## Parâmetros completos

| Prop | Padrão / unidade / uso |
| --- | --- |
| `phrases` | Obrigatória: um ou mais itens ordenados. |
| `phrases[].text` | Texto não vazio. Converte para maiúsculas. |
| `phrases[].at` | **Chegada ao meio**, em segundos relativos ao início da cena; não é o começo da entrada. Deve ser >= 0 e menor que a duração total. |
| `phrases[].color` | Cor #RRGGBB opcional para o destaque dessa frase; herda activeColor. Não altera a cor inativa. |
| `fontFamily` | Bangers (padrão) ou Anton. Declare a fonte correspondente em assets. |
| `align` | left (padrão) ou right; alinhamento horizontal de todos os níveis. |
| `activeColor` | #F4C542, cor da frase atual. |
| `activeBandColor` | #A0A0A0, cor da faixa central. |
| `activeBandOpacity` | 0–1, padrão 0.12 (12%). Zero desliga a faixa. Independente de backgroundOpacity. |
| `inactiveColor` | #9698A2, cor das frases anterior/próxima. |
| `inactiveOpacity` | 0–1, padrão 0.38. Não é percentual. |
| `inactiveScale` | 0.3–0.85, padrão 0.60 do tamanho calculado da mesma frase em destaque. |
| `motionDuration` | 0.45 segundo por troca. Zero = corte instantâneo entre estados. |
| `textScale` | 0.25–1, padrão 1; reduz o maior tamanho legível calculado por frase. Não são pixels. |
| `backgroundStyle` | halftone (padrão), solid, stars, film, paper ou grid. |
| `backgroundColor` | #10131E; somente halftone/solid. |
| `backgroundOpacity` | **0–100%**, padrão 100; afeta somente o fundo, não as frases. |
| `paperTone` | light (padrão) ou dark; somente paper. |
| `gridBackgroundColor` | #10101A; somente grid. |
| `gridLineColor` | #858595; somente grid. |

Não existem props de posição manual, grid variável, blur, tamanho em pixels, texto digitado, duração por palavra ou animação de saída. Os três terços são parte do layout. Cada frase tem ajuste próprio de tamanho, preservado durante seu movimento. O tempo de exposição resulta da diferença entre chegadas; não há `hold` por item.

## Tempo, duração e sincronismo

A duração total vem de `timeline[].end - start`. Os `at` devem ser estritamente crescentes, e cada intervalo entre chegadas precisa ser >= motionDuration. O primeiro at pode ser 0 (primeira frase já aparece no meio, sem entrada) ou >= motionDuration. Antes da primeira entrada ela aguarda no alto. A troca começa em `at - motionDuration` e **termina em at**: alinhe at à palavra-chave no transcript final. Não distribui frases por tempos iguais nem lê transcript.json automaticamente.

No exemplo de 10 segundos:

| Frase | Movimento | Chegada ao centro |
| --- | --- | --- |
| Herói NÃO É JUIZ | 0.35–0.80 s | 0.80 s |
| Herói NÃO É JÚRI | 2.55–3.00 s | 3.00 s |
| NEM O CARRASCO | 4.75–5.20 s | 5.20 s |
| ONDE FICA O LIMITE? | 6.95–7.40 s | 7.40 s |

Se a frase estiver no áudio aos 23 s e a cena começar aos 20 s, passe at 3, não 23. Se precisar que ela já esteja pronta antes da fala, antecipe ligeiramente essa chegada. Deixe tempo para ler a última frase. O FPS limita o instante exibido ao primeiro quadro disponível. A animação é calculada pelo frame, sem timers, e permite buscar diretamente um instante na prévia.

## Camadas e transparência

Use **replace** para a composição inteira com fundo próprio. Para mostrar vídeo/imagem comum por trás, use **overlay**, mantenha essa mídia na cena base e passe backgroundOpacity 0 ou uma porcentagem intermediária. Em replace, transparência não recupera uma cena base removida. O TSX não carrega clipes, não altera seu áudio nem aplica CRT na composição toda. A redução da opacidade do fundo nunca apaga as frases nem a faixa central; inactiveOpacity e activeBandOpacity são independentes. A faixa ocupa 28% da altura, centralizada e de borda a borda, sem acompanhar os textos durante as trocas. Sua cor/opacidade não alteram o tamanho ou o relógio da animação.

Os fundos seguem BACKGROUNDS_HQ.md: estrelas e filme têm aparência fixa; papel alterna poses; grade desliza continuamente para a direita. Não há controle de velocidade desses fundos.

## Sons

O TSX **não toca áudio automaticamente**. `exemplo-cena.json` inclui quatro whooshes variados de 0.24 s, preset subtle, trimDb -28 e fadeOut 0.04. Seus horários centralizam o trecho sonoro no meio de cada movimento:

`sfx.at = start absoluto da cena + frase.at - motionDuration / 2 - duração útil do som / 2`.

Os começos no exemplo são 0.455, 2.655, 4.855 e 7.055 s. Recalcule ao mudar start, at, duração do movimento ou duração do som; confira o ataque real depois do corte de silêncio. Um movimento instantâneo não precisa de whoosh. Não usar teclado: não há escrita letra por letra. Ganho trimDb não garante loudness relativo à narração; escute com a voz antes de aprovar.

## Exemplos e prévias

- exemplo-cena.json: Bangers, fundo halftone, alinhamento esquerdo e sons no plano.
- exemplo-anton-overlay.json: Anton, alinhamento direito e fundo transparente; silencioso de propósito. A base usa uma cor demonstrativa: substitua por um clipe real para visualizar a sobreposição.

São objetos de **cena**, não edit plans completos. Insira em timeline preservando configurações globais e narração. Os sons usam tempos absolutos; props usam tempos relativos. Não é necessário asset de personagem.

As imagens mostram estados estáticos. O Studio local permite conferir o movimento; exemplos não certificam mixagem com voz real nem constituem aprovação visual do criador.

Voltar ao catálogo · Fontes

## Validação realizada

Compilação estrita e 60 verificações automatizadas passaram. Gerados 12 frames entre horizontal, vertical e Anton transparente/alinhada à direita. Os dois JSONs passaram na definição de cena do schema atual do Content Lab. Confira VALIDACAO.md para limites e frames críticos; não houve render de produção nem mixagem com voz.

## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type Phrase={text:string;at:number;color?:string};
type Props=HQBackgroundOptions & {phrases:Phrase[];fontFamily?:HQFont;align?:'left'|'right';
  activeColor?:string;inactiveColor?:string;inactiveOpacity?:number;inactiveScale?:number;
  activeBandColor?:string;activeBandOpacity?:number;
  motionDuration?:number;textScale?:number;assets?:{bangers?:string;anton?:string}};
type Layout={lines:string[];size:number;height:number};
type HQBackgroundOptions = {
  backgroundStyle?: 'comic_page' | 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQFont = 'Bangers' | 'Anton';
```

## Instalação oficial

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/CarrosselFrasesHQ.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-anton-overlay.json](exemplo-anton-overlay.json)
- [exemplo-cena.json](exemplo-cena.json)

## Página HQ transparente — fundo adicional

Use `backgroundStyle: "comic_page"` e `backgroundOpacity: 0–100` (100 por padrão). Usa exatamente o PNG bannerSemFundo_3, com divisórias e transparência. Não pinta cor atrás: use `mode: "overlay"` para manter a cena base. A opacidade afeta só a arte; a opacidade global do componente continua valendo.

16:9 e 9:16 sem deformar, com `cover` central (recorta laterais no vertical). As divisórias são decoração, não slots automáticos. O visual anterior permanece quando a opção não é escolhida.

**Instalação:** a Galeria prepara o TSX e `HQComicPage.tsx` em `custom-scenes/`. Manualmente, copie ambos da mesma pasta. Todos os presets compartilham uma cópia idêntica do auxiliar no projeto; preserve cópias diferentes. O PNG já está embutido, sem asset extra nem rede. Exemplo de props adicionais: `{"backgroundStyle":"comic_page","backgroundOpacity":70}`. Preserve as demais props/assets obrigatórias do guia.
