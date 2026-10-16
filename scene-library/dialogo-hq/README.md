# Diálogo HQ

## O que aparece

Um participante fica à esquerda e o outro à direita. Sem falar, a imagem recua até seu centro estar na borda da tela, ficando aproximadamente metade para fora, em cinza, mais escura e discreta. Quando fala, avança para dentro da tela e recupera suas cores, brilho e opacidade originais. Não modifica o arquivo da imagem.

Uma luz em degradê acompanha o participante ativo: da esquerda para a direita para o da esquerda, e da direita para a esquerda para o da direita. Ela desaparece do participante anterior durante a troca. A fala fica no lado oposto, mais escuro. Não há balão nem caixa de diálogo obrigatória.

**16:9:** participantes nas laterais e fala no lado oposto ao ativo. **9:16:** participantes nas laterais inferiores e falas acima, para evitar esmagar o texto em uma coluna estreita. Os fundos são responsivos, não uma versão horizontal esticada.

## Instalação e assets

Copie `DialogoHQ.tsx` para `custom-scenes/` do projeto e adapte `exemplo-cena.json`. O arquivo é independente, sem helpers/imports relativos externos. Use `customComponent.module: "project://custom-scenes/DialogoHQ.tsx"`.

Declare imagens e fonte em **customComponent.assets**, não dentro de props. `left.asset` e `right.asset` são chaves desse mapa. PNGs transparentes preservam o recorte do personagem; fotografias permanecem retangulares. A margem transparente é detectada e desconsiderada para posicionar a imagem visível. Imagens totalmente transparentes geram erro.

Os exemplos usam um escudo azul e uma máscara vermelha locais, apenas para demonstrar a disposição, não imagens oficiais de Herói/Rival. Copie os SVGs de exemplos-assets para assets/dialogo ou substitua pelos PNGs que desejar.

## Props dos participantes

| Campo | Uso / padrão |
| --- | --- |
| left, right | Obrigatórios; definem os participantes esquerdo e direito. |
| left.asset / right.asset | Chave da imagem no mapa de assets. |
| left.name / right.name | Nome opcional, exibido acima da fala em maiúsculas; omitido se vazio. |
| left.color / right.color | Cor do degradê e do nome em #RRGGBB; padrões #2676E8 e #EF3F49. Não recolorem a imagem. |
| left.scale / right.scale | 0.5–1, padrão 1. Escala relativa ao maior enquadramento permitido, preservando proporção. |

## Falas e sincronização

`turns` é uma lista obrigatória. Cada fala exige:

| Campo | Uso / padrão |
| --- | --- |
| speaker | left ou right. Pode repetir o mesmo participante em falas consecutivas. |
| text | Texto da fala; convertido para maiúsculas e ajustado para caber, sem quebrar palavras ao meio. |
| at | Início em segundos relativos à cena. |
| duration | Duração positiva em segundos; precisa terminar até o fim da cena. |
| animation | escrita (padrão) ou none. none mostra a fala inteira; escrita revela letra a letra, mantendo seu lugar no layout. |
| writeDuration | Duração da escrita. Padrão: menor entre 1.2 s e 55% do tempo disponível depois de textDelay. Se explícito, precisa caber. Sem efeito visual quando animation é none. |
| textDelay | Espera para mostrar/escrever a fala depois de at, padrão 0. Precisa ser menor que duration. |
| textColor | Cor opcional só desta fala, #RRGGBB; herda a cor global se omitida. |

As falas devem ser ordenadas e não podem se sobrepor. Não existe limite fixo de quantidade. Lacunas são permitidas: o texto some e os dois participantes recuam, sem degradê ativo. Ao fim da última fala eles também recuam, se sobrar tempo na cena. Sem lacuna, a troca entre participantes é contínua. Falas seguidas do mesmo lado não fazem a imagem recuar e voltar desnecessariamente.

O horário at inicia tanto o avanço do participante quanto o relógio da fala. O movimento termina at + motionDuration. Para o participante já estar enquadrado quando começar a fala narrada, antecipe at e use textDelay equivalente. Ajuste os tempos com o transcript real: este componente não distribui palavras nem reconhece áudio automaticamente.

## Fonte e movimento

| Campo | Uso / padrão |
| --- | --- |
| fontFamily | Bangers (padrão) ou Anton. |
| textColor | #FFFFFF por padrão, para falas. Escolha contraste com o fundo. |
| motionDuration | Segundos de avanço/recuo e troca do degradê, padrão 0.45. Zero = troca instantânea. Falas menores que esse tempo podem trocar antes de concluir o avanço; reduza-o nesses casos. |
| highlightOpacity | 0–100%, padrão 85. Intensidade máxima do degradê colorido. Zero desliga só esse degradê. |

Use `assets.bangers: "builtin://fonts/Bangers-Regular.ttf"` ou `assets.anton: "builtin://fonts/Anton-Regular.ttf"`. Só a fonte selecionada é necessária. Anton não tem sombra nem contorno; Bangers tem acabamento HQ escuro. Textos e nomes são medidos depois de a fonte carregar. A escrita não muda o tamanho do texto durante a revelação.

## Fundo atrás da conversa

| Campo | Uso / padrão |
| --- | --- |
| backgroundStyle | halftone (padrão), solid, stars, film, paper ou grid. |
| backgroundColor | #10131E, usado em solid/halftone. |
| backgroundOpacity | 0–100%, padrão 100. Controla o fundo base **e os degradês**, não imagens ou texto. |
| paperTone | light (padrão) ou dark. |
| gridBackgroundColor | #10101A. |
| gridLineColor | #858595. |

Estrelas e filme têm aparência fixa. Papel troca poses em stop-motion; grade move para a direita. Velocidades são fixas. Não há vídeos de background obrigatórios. Consulte BACKGROUNDS_HQ.md da biblioteca.

Mode replace mostra esta composição inteira. Para deixar um clipe comum atrás, use mode overlay e reduza backgroundOpacity: em zero, o fundo base e as luzes não cobrem o vídeo, mas os participantes e falas continuam visíveis. Transparência em replace não recupera uma cena base removida.

## Som

O TSX não toca narração, voz de personagem, música, digitação ou whoosh automaticamente. A fala é visual, sem animação de boca. Configure os sons no edit plan: whoosh baixo no meio da troca (at + motionDuration/2), variando os arquivos; som de escrita baixo somente de at + textDelay até esse instante + writeDuration. Para animation none, não coloque som de digitação. Som deve acompanhar o movimento, sem competir com a narração. Em mode overlay, preserve o áudio da base conforme o plano; este TSX não o modifica.

## Duração, prévias e aprovação

A duração total vem de end - start. Todas as falas e escritas precisam caber nela. Os valores de at aqui são relativos; eventos sonoros da timeline devem somar o start absoluto da cena. A animação é determinística por frame/FPS, inclusive ao saltar na timeline.


## Consulta e exemplos disponíveis

Voltar ao catálogo e à instalação. Este guia descreve o contrato atual; não é necessário aplicar atualizações antigas em sequência.

- exemplo-cena.json

Os JSONs são **cenas para inserir em `timeline`**, não planos completos. Preserve as configurações globais do projeto e adapte `id`, `start`, `end`, caminhos e SFX absolutos. Arquivos `project://` são relativos à raiz do projeto de edição, não à pasta desta biblioteca. Imagens/clipes/fontes precisam existir no destino; exemplos não baixam assets nem transcrição. A orientação vem da resolução do projeto, sem prop `aspectRatio`. Nenhum TSX toca sons automaticamente. PNGs documentam um instante, não o movimento ou a mixagem; prévias antigas não certificam todas as opções atuais.


## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type Speaker='left'|'right';
type Participant={asset:string;name?:string;color?:string;scale?:number};
type Turn={speaker:Speaker;text:string;at:number;duration:number;animation?:'escrita'|'none';writeDuration?:number;textDelay?:number;textColor?:string};
type Props=HQBackgroundOptions & {left:Participant;right:Participant;turns:Turn[];fontFamily?:HQFont;
  textColor?:string;motionDuration?:number;highlightOpacity?:number;assets?:Record<string,string>};
type Bounds={x:number;y:number;width:number;height:number;sourceWidth:number;sourceHeight:number};
type TextLayout={lines:string[];size:number};
type HQBackgroundOptions = {
  backgroundStyle?: 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQFont = 'Bangers' | 'Anton';
```

## Instalação oficial

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/DialogoHQ.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-cena.json](exemplo-cena.json)
